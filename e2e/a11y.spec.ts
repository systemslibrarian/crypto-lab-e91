import { expect, test, type Page } from '@playwright/test';
import { NARROW, boot, expectNoHorizontalOverflow, scan, settle } from './gate';

/**
 * WCAG regression gate.
 *
 * Deploys are already gated on the engine vectors by claims.spec.ts; this gates
 * them on accessibility the same way. See gate.ts for the three rules this file
 * obeys — nothing injected, content asserted before every scan, and `violations`
 * treated as one oracle among four.
 *
 * The page is scanned in both themes, in every state a visitor can actually
 * reach, at a 1280px desktop viewport and at a 380px phone one. Almost none of
 * the interesting states are the first-paint rendering: the compromised and
 * inconclusive verdicts recolour the whole results block, the transcript adds a
 * 720px-wide table, the copy chips repaint on confirmation, and both skip links
 * are off-screen until focused.
 */

const THEMES = ['dark', 'light'] as const;

/**
 * A state worth scanning: how to reach it from a booted page, and what has to
 * be true once you are there. The assertion is not decoration — it is what
 * stops a scan from passing over a panel that never redrew.
 */
interface State {
  label: string;
  drive: (page: Page) => Promise<void>;
}

const STATES: State[] = [
  {
    // The default mount: ideal channel, |S| at Tsirelson's bound, secure.
    label: 'ideal channel / secure verdict',
    drive: async (page) => {
      await expect(page.locator('#e91-output .verdict--secure')).toBeVisible();
      await expect(page.locator('#e91-output .verdict-headline')).toHaveText('Secure');
    },
  },
  {
    // Driven the way a visitor drives it. Recolours the verdict block to
    // --warning-fg on --warning-bg and flips the icon and key-agreement line to
    // the invalid palette, none of which the secure rendering exercises.
    label: 'intercept-resend Eve / compromised verdict',
    drive: async (page) => {
      await page.locator('.scenario-chip[data-scenario="eve"]').click();
      await expect(page.locator('.scenario-chip[data-scenario="eve"]')).toHaveAttribute(
        'aria-selected',
        'true'
      );
      await expect(page.locator('#e91-output .verdict-headline')).toHaveText('Compromised');
      await expect(page.locator('#e91-output .bit-cell--miss').first()).toBeVisible();
    },
  },
  {
    // The third verdict palette. Only reachable with a sample size small enough
    // that the interval straddles the classical bound, so no click sequence from
    // the defaults produces it.
    label: 'borderline / inconclusive verdict',
    drive: async (page) => {
      await page.goto('.#s=misaligned&r=3000&seed=2&misalignRad=0.39269908169872414');
      await expect(page.locator('#e91-output .verdict-headline')).toHaveText('Inconclusive');
      await expect(page.locator('#e91-output .verdict--inconclusive')).toBeVisible();
    },
  },
  {
    // A scenario that renders the knob: a range input, its label and its live
    // value readout, none of which exist in the ideal/eve/lossy cards.
    label: 'noisy channel / slider knob raised',
    drive: async (page) => {
      await page.locator('.scenario-chip[data-scenario="noisy"]').click();
      const knob = page.locator('#scenario-knob');
      await expect(knob).toBeVisible();
      // 0.5 is the slider's maximum: p = 0.5 halves every correlation, which is
      // well past the 0.293 where the Bell violation is lost.
      await knob.fill('0.5');
      await knob.dispatchEvent('change');
      await expect(page.locator('#scenario-knob-display')).toHaveText('0.50');
      await expect(page.locator('#e91-output .verdict-headline')).toHaveText('Compromised');
    },
  },
  {
    // Adds the 50-row transcript table (min-width: 720px) and the CHSH/key
    // bucket tags, which are the only place `.bucket-tag--*` is painted.
    label: 'round transcript enabled',
    drive: async (page) => {
      await page.locator('#e91-transcript').check();
      await expect(page.locator('.transcript-table tbody tr')).toHaveCount(50);
      await expect(page.locator('.bucket-tag--chsh').first()).toBeVisible();
      await expect(page.locator('.bucket-tag--key').first()).toBeVisible();
    },
  },
  {
    // The one <details> on the page. Its body is display:none until opened, so
    // a first-paint scan checks none of it.
    label: 'BB84 comparison disclosure open',
    drive: async (page) => {
      await page.locator('.why-details summary').click();
      await expect(page.locator('.why-details')).toHaveAttribute('open', '');
      await expect(page.locator('.why-details p code')).toBeVisible();
    },
  },
  {
    // Both copy chips repaint to `.copy-chip--ok` for 1.4s after a successful
    // copy. That is a distinct foreground/background pair on a real, reachable
    // state, and it reverts on a timer, so it is only ever scannable here.
    label: 'copy confirmation chips',
    drive: async (page) => {
      await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
      await page.locator('#e91-copy-link').click();
      await page.locator('#e91-copy-csv').click();
      await expect(page.locator('#e91-copy-link.copy-chip--ok')).toBeVisible();
      await expect(page.locator('#e91-copy-csv.copy-chip--ok')).toBeVisible();
    },
  },
  {
    // Both skip links are parked off-screen until focus. The contrast walk
    // deliberately skips text that paints no pixels, so the only way their
    // colours are ever measured is to focus them for real.
    label: 'skip links focused',
    drive: async (page) => {
      await page.locator('.cl-skip-link').focus();
      await expect(page.locator('.cl-skip-link')).toBeFocused();
      const shared = await page
        .locator('.cl-skip-link')
        .evaluate((el) => el.getBoundingClientRect().bottom > 0);
      expect(shared, 'the shared skip link must slide into view on focus').toBe(true);
      await page.locator('.skip-link').focus();
      await expect(page.locator('.skip-link')).toBeFocused();
      const own = await page
        .locator('.skip-link')
        .evaluate((el) => el.getBoundingClientRect().right > 0);
      expect(own, "the lab's own skip link must slide into view on focus").toBe(true);
    },
  },
];

for (const theme of THEMES) {
  for (const state of STATES) {
    test(`${theme} — ${state.label}`, async ({ page }) => {
      await boot(page, theme);
      await state.drive(page);
      await scan(page, `${theme} / ${state.label} / 1280px`);

      // Same state, phone width. Reflow (1.4.10) has no axe rule and this page
      // positions its gauge labels by percentage with `white-space: nowrap`, so
      // how far they overhang is a function of the run, not of the stylesheet.
      await page.setViewportSize(NARROW);
      await settle(page);
      await scan(page, `${theme} / ${state.label} / ${NARROW.width}px`);
    });
  }
}

/**
 * WCAG 2.1.1 (Keyboard). A container that scrolls must be operable from the
 * keyboard. If it holds no focusable content, it needs `tabindex="0"` so it
 * becomes a focus target that arrow keys can then scroll.
 *
 * This page has three: the correlation table (min-width 560px), the E91-vs-BB84
 * comparison (720px) and the transcript (720px), each wrapped in a
 * `.table-shell { overflow-x: auto }`. None contains a link or a control, so
 * without a tabindex a keyboard-only reader cannot reach the columns scrolled
 * out of view — and those tables overflow at 1280px, let alone at 380px.
 *
 * `tabindex="0"` alone, deliberately: adding `role="region"` + `aria-label`
 * would turn wrappers that are re-created on every simulation run into
 * landmarks, and the resulting accessibility-tree churn is a measured source of
 * flake elsewhere in the fleet.
 */
test('every horizontally scrolling region is keyboard reachable', async ({ page }) => {
  await boot(page, 'dark');
  await page.locator('#e91-transcript').check();
  await expect(page.locator('.transcript-table tbody tr')).toHaveCount(50);

  for (const width of [1280, NARROW.width]) {
    await page.setViewportSize({ width, height: 800 });
    await settle(page);
    const unreachable = await page.evaluate(() => {
      const FOCUSABLE = 'a[href],button,input,select,textarea,[tabindex]:not([tabindex="-1"])';
      return Array.from(document.querySelectorAll<HTMLElement>('body *'))
        .filter((el) => el.scrollWidth > el.clientWidth + 1)
        .filter((el) => {
          const o = getComputedStyle(el).overflowX;
          return o === 'auto' || o === 'scroll';
        })
        .filter((el) => el.tabIndex < 0 && !el.querySelector(FOCUSABLE))
        .map(
          (el) =>
            `${el.tagName.toLowerCase()}.${(el.getAttribute('class') ?? '').trim()}` +
            ` (${el.scrollWidth}px in ${el.clientWidth}px)`
        );
    });
    expect(unreachable, `scrolling regions with no keyboard route at ${width}px`).toEqual([]);
  }
});

/**
 * The scrolling tables must be reachable by Tab in document order too — a
 * `tabindex` on an element the sequential walk never arrives at is no better
 * than none.
 */
test('the scrolling tables are reachable by Tab', async ({ page }) => {
  await boot(page, 'dark');
  const total = await page.locator('.table-shell').count();
  expect(total).toBeGreaterThan(0);

  const reached = new Set<number>();
  for (let i = 0; i < 200 && reached.size < total; i++) {
    await page.keyboard.press('Tab');
    const hit = await page.evaluate(() =>
      Array.from(document.querySelectorAll('.table-shell')).indexOf(
        document.activeElement as Element
      )
    );
    if (hit >= 0) reached.add(hit);
  }
  expect(reached.size, 'every .table-shell must be reachable by Tab').toBe(total);
});

/**
 * The gauge is the one component whose geometry is computed from the run rather
 * than fixed by the stylesheet: the marker and tick labels are `white-space:
 * nowrap` spans centred on a percentage position along the track. How far they
 * overhang depends entirely on the |S| the run produced, so sweep the extremes
 * explicitly rather than trusting the default run to hit them.
 */
test('the gauge does not push the page sideways at any |S|', async ({ page }) => {
  await boot(page, 'dark');
  await page.setViewportSize(NARROW);
  for (const hash of [
    '#s=ideal&r=10000&seed=1', // |S| ~ 2.83, marker at ~94% of the track
    '#s=eve&r=10000&seed=1', // |S| ~ 1.41, marker at ~47%
    '#s=noisy&r=10000&seed=1&noiseP=0.9', // |S| ~ 0.28, marker hard left
  ]) {
    await page.goto(`.${hash}`);
    await expect(page.locator('#e91-output .s-gauge-marker-label')).toContainText('|S| =');
    await settle(page);
    await expectNoHorizontalOverflow(page, `gauge at ${hash} / ${NARROW.width}px`);
  }
});
