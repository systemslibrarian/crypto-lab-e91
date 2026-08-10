import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';
import { auditContrast, formatContrastFailures } from './contrast';
import { auditNonText } from './nontext';
import { NONTEXT_BASELINE } from './nontext-baseline';

export const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

/** Every channel model the scenario strip offers. */
export const SCENARIOS = ['ideal', 'eve', 'noisy', 'misaligned', 'lossy'] as const;
export type ScenarioId = (typeof SCENARIOS)[number];

/** A phone-width viewport, for the WCAG 1.4.10 reflow half of the gate. */
export const NARROW = { width: 380, height: 800 };

/**
 * Shared machinery for the WCAG gate.
 *
 * Three rules govern everything here:
 *
 *  1. NOTHING IS INJECTED INTO THE PAGE BEFORE A SCAN. The previous version of
 *     this gate pushed `.e91-output, .e91-output * { opacity: 1 !important }`
 *     plus a blanket `animation: none; transition: none` before running axe.
 *     That does not suppress a check, it fabricates the input: partial opacity
 *     is real rendering, and forcing it opaque hands axe a foreground colour the
 *     page never paints. Motion is settled honestly now (see `settle`) and the
 *     composite-aware arithmetic in contrast.ts measures the colours the page
 *     actually paints, at the opacity it actually paints them.
 *
 *  2. EVERY SCAN ASSERTS ITS CONTENT IS PRESENT FIRST, and there are scans well
 *     past first paint. axe over an empty container passes having checked
 *     nothing, and #e91-output is empty until the simulation has run. The states
 *     this page is interesting in — a compromised verdict, an inconclusive one,
 *     the round transcript, a focused skip link, a copy confirmation, 380px —
 *     are all reached by a click, and none of them is the first-paint rendering.
 *
 *  3. `violations` IS NOT THE WHOLE ORACLE. See `scan`.
 */

/**
 * Wait for every running animation and transition to drain.
 *
 * Transitions drain in waves, not in one batch, so a poll for "nothing running
 * right now" can exit through a gap between waves. Require quiescence to hold
 * for several consecutive frames instead.
 *
 * The 20s ceiling is deliberately generous rather than tight: on a loaded
 * machine the raf cadence stretches, and the correct response to that is a
 * longer wait, never a narrower scan.
 */
export async function settle(page: Page): Promise<void> {
  await page.waitForFunction(
    () => {
      const w = window as unknown as { __quietFrames?: number };
      const running = document.getAnimations().filter((a) => a.playState === 'running');
      w.__quietFrames = running.length === 0 ? (w.__quietFrames ?? 0) + 1 : 0;
      return w.__quietFrames >= 6;
    },
    undefined,
    { timeout: 20_000, polling: 'raf' }
  );
}

/**
 * Assert that reduced motion left the page visible, not merely un-animated.
 *
 * The failure mode this guards against is an element whose only route to its
 * visible state is an animation, in a stylesheet whose reduced-motion block
 * cancels animations without restoring their end state — the element then
 * renders at `opacity: 0` for every reader with the preference set, and a gate
 * that injects `opacity: 1` paints it back for the scanner alone.
 *
 * This lab's reduced-motion block fast-forwards (`animation-duration: 0.001ms`)
 * rather than cancelling, and its one keyframed rule (`.math-row`) fills
 * `forwards`, so the end state does survive — but that is a property of the
 * stylesheet today, not a guarantee, so it is asserted rather than assumed.
 */
async function expectNotBlank(page: Page, label: string): Promise<void> {
  const invisible = await page.evaluate(() => {
    const out: string[] = [];
    for (const el of Array.from(document.querySelectorAll('body *'))) {
      const own = Array.from(el.childNodes)
        .filter((n) => n.nodeType === Node.TEXT_NODE)
        .map((n) => n.textContent ?? '')
        .join('')
        .trim();
      if (!own) continue;
      // Deliberately hidden subtrees are not "blank", they are closed.
      if (!(el as HTMLElement).checkVisibility?.({ checkVisibilityCSS: true })) continue;
      let effective = 1;
      let node: Element | null = el;
      while (node) {
        effective *= parseFloat(getComputedStyle(node).opacity);
        node = node.parentElement;
      }
      if (effective === 0) {
        out.push(`${el.tagName.toLowerCase()}.${(el.getAttribute('class') ?? '').trim()}`);
      }
    }
    return Array.from(new Set(out));
  });
  expect(invisible, `no visible text may render at opacity 0 in state: ${label}`).toEqual([]);
}

/**
 * Load the page in a known theme with reduced motion actually in effect, and
 * assert the content every scan relies on is really on the page.
 *
 * `test.use({ reducedMotion })` silently does nothing on Playwright 1.61.1 — at
 * file level and inside `test.describe` alike — so the emulation is applied
 * imperatively and then *asserted* from inside the page. Without that assertion
 * a gate can believe it is testing a reduced-motion rendering while the page
 * happily animates.
 */
export async function boot(page: Page, theme: 'dark' | 'light'): Promise<void> {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  if (theme === 'light') {
    await page.addInitScript(() => localStorage.setItem('theme', 'light'));
  }
  await page.goto('.');
  expect(
    await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches),
    'reduced-motion emulation must actually be in effect'
  ).toBe(true);
  await expect(page.locator('html')).toHaveAttribute('data-theme', theme);

  // The whole page is injected by JS, and mountApp() runs the simulation once
  // on mount. Assert the parts every scan relies on are really there, so no
  // scan can pass over an empty shell or a results panel that has not filled.
  await expect(page.locator('main .hero-panel h1')).toHaveText('E91');
  await expect(page.locator('.scenario-chip')).toHaveCount(SCENARIOS.length);
  await expect(page.locator('#e91-output .verdict-headline')).toBeVisible();
  await expect(page.locator('#e91-output .s-gauge-marker-label')).toContainText('|S| =');
  await expect(page.locator('#e91-output .corr-table tbody tr')).toHaveCount(4);
  await expect(page.locator('#e91-output .bit-cell').first()).toBeVisible();
  // The hero plus the five numbered lab sections.
  await expect(page.locator('main > section')).toHaveCount(6);

  await settle(page);
  await expectNotBlank(page, `${theme} first paint`);
}

/**
 * Switch the scenario strip to `id` and wait for the results panel to redraw
 * with the verdict that scenario produces.
 */
export async function selectScenario(
  page: Page,
  id: ScenarioId,
  verdict: 'secure' | 'compromised' | 'inconclusive'
): Promise<void> {
  await page.locator(`.scenario-chip[data-scenario="${id}"]`).click();
  await expect(page.locator(`#e91-output .verdict--${verdict}`)).toBeVisible();
}

/**
 * Assert the page does not require horizontal scrolling.
 *
 * WCAG 1.4.10 (Reflow, AA). axe has no rule for this, and on this page it is
 * invisible at first paint: the gauge's `white-space: nowrap` marker and tick
 * labels are absolutely positioned by percentage along the track and centred
 * with `translateX(-50%)`, so how far they stick out past the panel depends
 * entirely on the |S| the run produced. Nothing about the default rendering
 * predicts the 380px one.
 */
export async function expectNoHorizontalOverflow(page: Page, label: string): Promise<void> {
  const overflow = await page.evaluate(() => {
    const doc = document.documentElement;
    if (doc.scrollWidth <= doc.clientWidth) return null;
    const widest = Array.from(document.querySelectorAll('body *'))
      .map((el) => ({ el, r: el.getBoundingClientRect() }))
      .filter((x) => x.r.width > 0 && x.r.right > doc.clientWidth + 1)
      .sort((a, b) => b.r.right - a.r.right)[0];
    return {
      scrollWidth: doc.scrollWidth,
      clientWidth: doc.clientWidth,
      widest: widest
        ? `${widest.el.tagName.toLowerCase()}${widest.el.id ? '#' + widest.el.id : ''}` +
          `${widest.el.getAttribute('class') ? '.' + widest.el.getAttribute('class')!.trim().split(/\s+/).join('.') : ''}` +
          ` @${Math.round(widest.r.width)}px right=${Math.round(widest.r.right)}`
        : '(none identified)',
    };
  });
  expect(overflow, `page must not scroll horizontally in state: ${label}`).toBeNull();
}

/**
 * Scan the page as it currently stands.
 *
 * Four assertions, because axe's `violations` array alone is not a complete
 * oracle:
 *
 *  - `violations` — the usual WCAG A/AA rule failures.
 *  - `incomplete` — axe's "could not decide" bucket, which never reaches the
 *    violations array. The one rule id allowed to remain incomplete is
 *    `color-contrast`, and only because the third assertion computes those
 *    ratios arithmetically. That exemption is doing all the work on this page:
 *    `:root` paints a three-layer background (two radial gradients over a
 *    linear one), so axe declines to compute a ratio for essentially every text
 *    node and files the lot under `incomplete`. Contrast had never reached the
 *    old gate's assertion at all.
 *  - arithmetic contrast — composite-aware WCAG 1.4.3 over every text node,
 *    measured against the surface the text is genuinely painted on, including
 *    SVG `<text>` (which takes its ink from `fill`, not `color`) and text faded
 *    by an ancestor's opacity.
 *  - reflow — WCAG 1.4.10, which axe has no rule for at all.
 */
/**
 * WCAG 1.4.11 and generated content, ratcheted against a per-repo baseline.
 *
 * Neither class has ANY other oracle: axe has no rule for non-text contrast,
 * and the arithmetic text walk cannot reach a control's boundary or a
 * `::before` glyph, because a pseudo-element is not an element and owns no text
 * node. Both were being found by hand-sampling screenshot pixels, which does
 * not regress-test.
 *
 * The backlog is real, so this does not block on it — but a check that merely
 * logs is not a gate, and this sweep has spent its whole length deleting checks
 * that could not fail. So it ratchets instead: anything NOT in the baseline
 * fails, anything in the baseline that got WORSE fails, and anything in the
 * baseline that has been FIXED fails until its entry is deleted. That last rule
 * is what stops the allowlist becoming a permanent exemption.
 */
const nonTextSeen = new Set<string>();

export async function expectNoNewNonTextFailures(page: Page, label: string): Promise<void> {
  const found = await auditNonText(page);
  // Capture mode: emit every finding and assert nothing, so a baseline can be
  // generated by the SAME path that checks it. Opt-in via env, and the run is
  // deliberately left failing at the end by `expectBaselineNotStale` so a
  // capture pass can never be mistaken for a passing gate.
  if (process.env.NT_BASELINE_CAPTURE) {
    for (const f of found) {
      console.log(`NTCAP|${f.kind}|${f.selector}|${f.ratio}|${f.required}|${/POSITIONED/.test(f.detail)}`);
    }
    return;
  }
  const problems: string[] = [];
  for (const f of found) {
    const key = `${f.kind}|${f.selector}`;
    nonTextSeen.add(key);
    const base = NONTEXT_BASELINE[key];
    if (!base) {
      problems.push(`NEW ${f.ratio}:1 (needs ${f.required}:1) [${f.kind}] ${f.selector} — ${f.detail}`);
    } else if (f.ratio < base.ratio - 0.01) {
      problems.push(
        `WORSE ${f.selector}: ${f.ratio}:1, baseline recorded ${base.ratio}:1`
      );
    }
  }
  expect(problems, `new or worsened non-text contrast in state: ${label}`).toEqual([]);
}

/**
 * Fail if a baselined finding never appeared during the whole drive.
 *
 * It has either been fixed — in which case delete the entry, which is the point
 * — or the drive stopped reaching the state that shows it, which is a coverage
 * regression worth knowing about. Call once, after `driveAllStates`.
 */
export function expectBaselineNotStale(): void {
  const unseen = Object.keys(NONTEXT_BASELINE).filter((k) => !nonTextSeen.has(k));
  expect(
    unseen,
    'baselined non-text findings that no longer appear — delete them from nontext-baseline.ts (or restore the drive state that showed them)'
  ).toEqual([]);
}

export async function scan(page: Page, label: string): Promise<void> {
  await settle(page);
  const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();

  const violations = results.violations.map((v) => ({
    state: label,
    id: v.id,
    impact: v.impact,
    help: v.help,
    nodes: v.nodes.map((n) => n.target.join(' ')).slice(0, 8),
  }));
  expect(violations, `axe violations in state: ${label}`).toEqual([]);

  const unexplainedIncomplete = results.incomplete
    .filter((v) => v.id !== 'color-contrast')
    .map((v) => ({
      state: label,
      id: v.id,
      nodes: v.nodes.map((n) => n.target.join(' ')).slice(0, 8),
    }));
  expect(unexplainedIncomplete, `axe incomplete results in state: ${label}`).toEqual([]);

  const contrast = formatContrastFailures(await auditContrast(page));
  expect(contrast, `measured contrast failures in state: ${label}`).toEqual([]);

  await expectNoNewNonTextFailures(page, label);
  await expectNoHorizontalOverflow(page, label);
}
