import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/**
 * WCAG regression gate. Deploys are already gated on the NIST/engine vectors;
 * this gates them on accessibility the same way. Scans the full page with
 * every <details> expanded and every collapsible/class-toggled region revealed,
 * in both themes, with animations neutralized.
 *
 * This lab renders a single scrolling page (#app) with one native <details>
 * ("why-details"), a scenario tablist, and result panels that appear after a
 * run. We run the E91 simulation first so the verdict/gauge/tables/key panels
 * are present in the DOM, then reveal any hidden regions before scanning.
 */

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

async function neutralizeMotion(page: Page): Promise<void> {
  await page.addStyleTag({
    content:
      '*, *::before, *::after { animation: none !important; transition: none !important; }\n' +
      '.e91-output, .e91-output * { opacity: 1 !important; }',
  });
}

async function revealAll(page: Page): Promise<void> {
  await page.evaluate(() => {
    for (const details of document.querySelectorAll('details')) {
      (details as HTMLDetailsElement).open = true;
    }
    // Reveal any display:none inline regions and remove [hidden].
    for (const el of document.querySelectorAll<HTMLElement>('[hidden]')) {
      el.removeAttribute('hidden');
    }
    for (const el of document.querySelectorAll<HTMLElement>('*')) {
      if (el.style && el.style.display === 'none') el.style.display = '';
    }
  });
}

async function runSimulation(page: Page): Promise<void> {
  // Populate the result panels (verdict, gauge, correlation table, sifted key)
  // so they are in scope for the scan.
  await page.locator('#e91-run').click();
  await expect(page.locator('#e91-output')).not.toBeEmpty();
}

async function scan(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  const summary = results.violations.map((v) => ({
    id: v.id,
    impact: v.impact,
    help: v.help,
    nodes: v.nodes.map((n) => n.target.join(' ')).slice(0, 5),
  }));
  expect(summary).toEqual([]);
}

async function runSuite(page: Page): Promise<void> {
  await runSimulation(page);
  await revealAll(page);
  await neutralizeMotion(page);
  await scan(page);
}

test('no WCAG A/AA violations in dark theme', async ({ page }) => {
  await page.goto('.');
  await runSuite(page);
});

test('no WCAG A/AA violations in light theme', async ({ page }) => {
  await page.goto('.');
  await page.locator('#cl-theme-toggle').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await runSuite(page);
});
