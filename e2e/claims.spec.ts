import { expect, test, type Page } from '@playwright/test';

/**
 * Functional gate for the claims this page makes on screen.
 *
 * The a11y spec proves the page is reachable; this one proves it is RIGHT.
 * Every assertion below is checked against numbers the page itself computed
 * and rendered — the verdict is re-derived from the confidence interval the
 * page printed, |S| is re-summed from the correlation table the page printed,
 * the standard errors are recomputed from the measured values and sample
 * sizes, and the counters are required to add up. Hard-coded constants appear
 * only where the physics fixes them (the classical bound 2, Tsirelson's 2√2,
 * the closed-form |S| per scenario).
 *
 * Runs are driven through the URL hash, which is also the demo's advertised
 * "shareable run" feature, so every test doubles as a check that a shared link
 * reproduces its run.
 */

const TSIRELSON = 2 * Math.sqrt(2);
const SQRT2 = Math.SQRT2;
const Z95 = 1.96;
const DEG = Math.PI / 180;

// Values are printed with toFixed(3)/toFixed(4), so agreement between two
// independently rounded quantities is only ever guaranteed to ~1e-3.
const ROUND_TOL = 2e-3;

function num(s: string): number {
  return parseFloat(s.replace(/,/g, '').replace(/−/g, '-'));
}

interface Row {
  label: string;
  expected: number;
  measured: number;
  ciLo: number;
  ciHi: number;
  se: number;
  n: number;
  badged: boolean;
}

interface Snapshot {
  headline: string;
  summary: string;
  detail: string;
  gauge: string;
  sideChsh: string;
  sideRun: string;
  rows: Row[];
  keyLine: string;
  aliceBits: string;
  bobBits: string;
  bitGridLabel: string;
  cellStates: boolean[];
  transcript: string[][];
  tickLabels: string[];
  markerLeft: string;
  ciLeft: string;
}

async function snapshot(page: Page): Promise<Snapshot> {
  const raw = await page.evaluate(() => {
    const text = (sel: string): string =>
      document.querySelector(sel)?.textContent?.trim() ?? '';
    const rows = Array.from(document.querySelectorAll('.corr-table tbody tr')).map((tr) => {
      const tds = Array.from(tr.querySelectorAll('td')).map((td) => td.textContent!.trim());
      return { cells: tds, badged: !!tr.querySelector('.corr-warn') };
    });
    const keyPs = Array.from(document.querySelectorAll('.e91-key p')).map((p) =>
      p.textContent!.trim(),
    );
    return {
      headline: text('.verdict-headline'),
      summary: text('.verdict-summary'),
      detail: text('.verdict-detail'),
      gauge: document.querySelector('.s-gauge')?.getAttribute('aria-label') ?? '',
      sideChsh: (document.querySelectorAll('.e91-side')[0] as HTMLElement | undefined)?.innerText ?? '',
      sideRun: (document.querySelectorAll('.e91-side')[1] as HTMLElement | undefined)?.innerText ?? '',
      rows,
      keyPs,
      bitGridLabel: document.querySelector('.bit-grid')?.getAttribute('aria-label') ?? '',
      cellStates: Array.from(document.querySelectorAll('.bit-cell')).map((c) =>
        c.classList.contains('bit-cell--match'),
      ),
      transcript: Array.from(document.querySelectorAll('.transcript-table tbody tr')).map((tr) =>
        Array.from(tr.querySelectorAll('td')).map((td) => td.textContent!.trim()),
      ),
      tickLabels: Array.from(document.querySelectorAll('.s-gauge-tick-label')).map((t) =>
        t.textContent!.trim(),
      ),
      markerLeft: (document.querySelector('.s-gauge-marker') as HTMLElement | null)?.style.left ?? '',
      ciLeft: (document.querySelector('.s-gauge-ci') as HTMLElement | null)?.style.left ?? '',
    };
  });

  const rows: Row[] = raw.rows.map((r) => {
    const ci = r.cells[3]!.replace(/[[\]]/g, '').split(',');
    return {
      label: r.cells[0]!,
      expected: num(r.cells[1]!),
      measured: num(r.cells[2]!.replace('!', '')),
      ciLo: num(ci[0]!),
      ciHi: num(ci[1]!),
      se: num(r.cells[4]!),
      n: num(r.cells[5]!),
      badged: r.badged,
    };
  });

  return {
    headline: raw.headline,
    summary: raw.summary,
    detail: raw.detail,
    gauge: raw.gauge,
    sideChsh: raw.sideChsh,
    sideRun: raw.sideRun,
    rows,
    keyLine: raw.keyPs.find((p) => p.startsWith('Key agreement')) ?? '',
    aliceBits: (raw.keyPs.find((p) => p.startsWith('Alice')) ?? '').replace(/^Alice\s*:\s*/, ''),
    bobBits: (raw.keyPs.find((p) => p.startsWith('Bob')) ?? '').replace(/^Bob\s*:\s*/, ''),
    bitGridLabel: raw.bitGridLabel,
    cellStates: raw.cellStates,
    transcript: raw.transcript,
    tickLabels: raw.tickLabels,
    markerLeft: raw.markerLeft,
    ciLeft: raw.ciLeft,
  };
}

/** Numbers the page printed about |S|, pulled out of three separate places. */
function sNumbers(s: Snapshot) {
  const side = /\|S\| measured = ([\d.]+)[\s\S]*?\|S\| expected = ([\d.]+)[\s\S]*?95% CI for \|S\| = \[([\d.]+), ([\d.]+)\][\s\S]*?SE\(S\) = ([\d.]+)/.exec(
    s.sideChsh,
  );
  expect(side, `could not parse CHSH summary card:\n${s.sideChsh}`).not.toBeNull();
  const detail = /confidence interval for \|S\| is \[([\d.]+), ([\d.]+)\]/.exec(s.detail);
  expect(detail, `could not parse verdict detail:\n${s.detail}`).not.toBeNull();
  const gauge = /\|S\| = ([\d.]+), 95% CI \[([\d.]+), ([\d.]+)\]/.exec(s.gauge);
  expect(gauge, `could not parse gauge label:\n${s.gauge}`).not.toBeNull();
  return {
    absS: num(side![1]!),
    expectedAbsS: num(side![2]!),
    ciLo: num(side![3]!),
    ciHi: num(side![4]!),
    seS: num(side![5]!),
    detailLo: num(detail![1]!),
    detailHi: num(detail![2]!),
    gaugeAbsS: num(gauge![1]!),
    gaugeLo: num(gauge![2]!),
    gaugeHi: num(gauge![3]!),
  };
}

/** Counters printed in the "Run" card. */
function runCounters(s: Snapshot) {
  const m = /([\d,]+) requested · ([\d,]+) coincidences[\s\S]*?([\d,]+) aligned-basis \(key\) · ([\d,]+) CHSH-test/.exec(
    s.sideRun,
  );
  expect(m, `could not parse run card:\n${s.sideRun}`).not.toBeNull();
  return {
    requested: num(m![1]!),
    coincidences: num(m![2]!),
    keyRounds: num(m![3]!),
    chshRounds: num(m![4]!),
  };
}

function keyNumbers(s: Snapshot) {
  const m = /Key agreement: ([\d.]+)% measured · ([\d.]+)% expected · ([\d,]+) sifted bits/.exec(
    s.keyLine,
  );
  expect(m, `could not parse key line:\n${s.keyLine}`).not.toBeNull();
  return { measuredPct: num(m![1]!), expectedPct: num(m![2]!), siftedBits: num(m![3]!) };
}

async function run(page: Page, hash: string): Promise<Snapshot> {
  await page.goto('.' + hash);
  await expect(page.locator('#e91-output')).not.toBeEmpty();
  await expect(page.locator('.verdict-headline')).toBeVisible();
  return snapshot(page);
}

/**
 * The one rule that defines the verdict: where the 95% CI for |S| sits
 * relative to the classical bound of 2. Re-derived here from the interval the
 * page printed, so the headline can never drift away from its own statistics.
 */
function expectedHeadline(ciLo: number, ciHi: number): string {
  if (ciLo > 2) return 'Secure';
  if (ciHi < 2) return 'Compromised';
  return 'Inconclusive';
}

function assertVerdictMatchesItsOwnInterval(s: Snapshot): void {
  const n = sNumbers(s);
  // The three places |S| is printed must agree with each other.
  expect(n.gaugeAbsS).toBeCloseTo(n.absS, 3);
  expect(n.gaugeLo).toBeCloseTo(n.ciLo, 3);
  expect(n.gaugeHi).toBeCloseTo(n.ciHi, 3);
  expect(Math.abs(n.detailLo - n.ciLo)).toBeLessThan(ROUND_TOL);
  expect(Math.abs(n.detailHi - n.ciHi)).toBeLessThan(ROUND_TOL);
  // The interval must actually bracket the point estimate...
  expect(n.ciLo).toBeLessThanOrEqual(n.absS + ROUND_TOL);
  expect(n.ciHi).toBeGreaterThanOrEqual(n.absS - ROUND_TOL);
  // ...and be exactly |S| +- 1.96 SE(S) (clamped at 0).
  expect(n.ciLo).toBeCloseTo(Math.max(0, n.absS - Z95 * n.seS), 2);
  expect(n.ciHi).toBeCloseTo(n.absS + Z95 * n.seS, 2);
  // The headline is the CI-vs-2 rule and nothing else.
  expect(s.headline, `verdict "${s.headline}" contradicts its own CI [${n.ciLo}, ${n.ciHi}]`).toBe(
    expectedHeadline(n.ciLo, n.ciHi),
  );
  // ...and the prose says which side of the bound it landed on.
  if (s.headline === 'Secure') {
    expect(s.detail).toContain('entirely above the classical bound of 2');
    expect(s.summary).toContain('passes the Bell test');
  } else if (s.headline === 'Compromised') {
    expect(s.detail).toContain('entirely below the classical bound of 2');
    expect(s.summary).toContain('Bell violation lost');
  } else {
    expect(s.detail).toContain('spans the classical bound of 2');
    expect(s.summary).toContain('straddles the classical bound');
  }
}

/** S = E(a1,b1) + E(a1,b2) + E(a2,b1) - E(a2,b2), rebuilt from the table. */
function assertCorrelationTableIsSelfConsistent(s: Snapshot): void {
  const n = sNumbers(s);
  expect(s.rows).toHaveLength(4);
  expect(s.rows.map((r) => r.label)).toEqual([
    'E(a1,b1)',
    'E(a1,b2)',
    'E(a2,b1)',
    'E(a2,b2)',
  ]);

  const sumS =
    s.rows[0]!.measured + s.rows[1]!.measured + s.rows[2]!.measured - s.rows[3]!.measured;
  expect(
    Math.abs(Math.abs(sumS) - n.absS),
    `|S| = ${n.absS} does not equal the CHSH sum of the printed correlations (${sumS})`,
  ).toBeLessThan(0.005);

  let varS = 0;
  for (const r of s.rows) {
    expect(r.n).toBeGreaterThan(0);
    // SE(E) = sqrt((1 - E^2)/n)
    const se = Math.sqrt(Math.max(0, 1 - r.measured * r.measured) / r.n);
    expect(Math.abs(r.se - se), `SE for ${r.label} is not sqrt((1-E^2)/n)`).toBeLessThan(1e-3);
    // CI = measured +- 1.96 SE
    expect(Math.abs(r.ciLo - (r.measured - Z95 * r.se))).toBeLessThan(ROUND_TOL);
    expect(Math.abs(r.ciHi - (r.measured + Z95 * r.se))).toBeLessThan(ROUND_TOL);
    expect(r.measured).toBeGreaterThanOrEqual(-1);
    expect(r.measured).toBeLessThanOrEqual(1);
    varS += r.se * r.se;
  }
  // SE(S) combines the four as independent measurements.
  expect(
    Math.abs(n.seS - Math.sqrt(varS)),
    `SE(S) = ${n.seS} is not the root-sum-square of the per-correlation SEs`,
  ).toBeLessThan(1e-3);
}

/** Every round is accounted for exactly once. */
function assertCountersSum(s: Snapshot): void {
  const c = runCounters(s);
  const k = keyNumbers(s);
  const nSum = s.rows.reduce((acc, r) => acc + r.n, 0);
  expect(nSum, 'correlation sample sizes do not sum to the CHSH-test round count').toBe(
    c.chshRounds,
  );
  expect(c.keyRounds + c.chshRounds, 'key + CHSH rounds do not sum to the coincidence count').toBe(
    c.coincidences,
  );
  expect(c.coincidences).toBeLessThanOrEqual(c.requested);
  expect(k.siftedBits, 'sifted-bit count disagrees with the aligned-basis round count').toBe(
    c.keyRounds,
  );
}

/** The rendered bit grid must agree with the rendered bit strings. */
function assertKeyPanelIsSelfConsistent(s: Snapshot): void {
  const k = keyNumbers(s);
  const alice = s.aliceBits.replace(/…$/, '');
  const bob = s.bobBits.replace(/…$/, '');
  expect(alice.length).toBe(bob.length);
  expect(alice.length).toBe(Math.min(64, k.siftedBits));
  expect(s.cellStates).toHaveLength(alice.length);
  for (let i = 0; i < alice.length; i++) {
    expect(
      s.cellStates[i],
      `bit ${i} coloured ${s.cellStates[i] ? 'match' : 'miss'} but Alice=${alice[i]} Bob=${bob[i]}`,
    ).toBe(alice[i] === bob[i]);
  }
  // The grid's accessible name must describe the grid that was actually drawn.
  expect(s.bitGridLabel).toContain(`First ${alice.length} key bits`);
  expect(s.bitGridLabel).toContain(`${k.measuredPct.toFixed(2)}% agree`);
  // Truncation marker appears only when there is more key than shown.
  expect(s.aliceBits.endsWith('…')).toBe(k.siftedBits > 64);
}

// --- 1. the headline verdict on a successful run ---------------------------

test('ideal channel: verdict, |S| and key agreement all follow the numbers on screen', async ({
  page,
}) => {
  const s = await run(page, '#s=ideal&r=10000&seed=1');
  assertVerdictMatchesItsOwnInterval(s);
  assertCorrelationTableIsSelfConsistent(s);
  assertCountersSum(s);
  assertKeyPanelIsSelfConsistent(s);

  const n = sNumbers(s);
  expect(s.headline).toBe('Secure');
  // The quantum prediction: |S| at Tsirelson's bound, and the page says so.
  expect(n.expectedAbsS).toBeCloseTo(TSIRELSON, 2);
  expect(Math.abs(n.absS - TSIRELSON)).toBeLessThan(0.1);
  expect(n.ciLo).toBeGreaterThan(2);

  // Ideal singlet at aligned bases: perfect anti-correlation -> perfect key.
  const k = keyNumbers(s);
  expect(k.expectedPct).toBe(100);
  expect(k.measuredPct).toBe(100);
  expect(s.cellStates.every((m) => m)).toBe(true);

  // Each individual correlation sits at +-1/sqrt(2).
  for (const r of s.rows) {
    expect(Math.abs(Math.abs(r.expected) - 1 / SQRT2)).toBeLessThan(0.001);
    expect(Math.abs(r.measured - r.expected)).toBeLessThan(0.06);
  }
  expect(s.rows.map((r) => Math.sign(r.expected))).toEqual([-1, -1, -1, 1]);
});

test('the gauge draws the number it reports', async ({ page }) => {
  const s = await run(page, '#s=ideal&r=10000&seed=1');
  const n = sNumbers(s);
  // The gauge is a 0..3 scale; marker and CI box must be placed from |S|.
  expect(num(s.markerLeft)).toBeCloseTo((n.absS / 3) * 100, 1);
  expect(num(s.ciLeft)).toBeCloseTo((Math.max(0, n.ciLo) / 3) * 100, 1);
  expect(s.tickLabels).toContain('classical 2');
  expect(s.tickLabels.some((t) => t.includes('2√2') && t.includes('2.828'))).toBe(true);
});

// --- 2. every failure / tamper path the page offers ------------------------

test('failure path — intercept-resend Eve collapses the Bell violation', async ({ page }) => {
  await page.goto('.');
  await expect(page.locator('#e91-output')).not.toBeEmpty();
  // Drive it the way a visitor does: click the Eve chip.
  await page.locator('button[data-scenario="eve"]').click();
  await expect(page.locator('.scenario-chip.is-active .scenario-chip-name')).toHaveText('Eve');
  await expect(page.locator('.scenario-chip[data-scenario="eve"]')).toHaveAttribute(
    'aria-selected',
    'true',
  );
  const s = await snapshot(page);

  assertVerdictMatchesItsOwnInterval(s);
  assertCorrelationTableIsSelfConsistent(s);
  assertCountersSum(s);
  assertKeyPanelIsSelfConsistent(s);

  expect(s.headline).toBe('Compromised');
  // ...and it says WHY: this scenario names the eavesdropper.
  expect(s.summary).toContain('intercept-resend eavesdropper');
  expect(s.detail).toContain('the key must be discarded');

  const n = sNumbers(s);
  // Textbook value under intercept-resend at pi/8: |S| = sqrt(2).
  expect(n.expectedAbsS).toBeCloseTo(SQRT2, 2);
  expect(Math.abs(n.absS - SQRT2)).toBeLessThan(0.15);
  expect(n.ciHi).toBeLessThan(2);
  // Eve's measurement also degrades the sifted key to 75%.
  const k = keyNumbers(s);
  expect(k.expectedPct).toBeCloseTo(75, 1);
  expect(Math.abs(k.measuredPct - 75)).toBeLessThan(2);
  expect(s.cellStates.some((m) => !m)).toBe(true);
});

test('failure path — depolarizing noise alone destroys the violation, without blaming Eve', async ({
  page,
}) => {
  const p = 0.5;
  const s = await run(page, `#s=noisy&r=10000&seed=1&noiseP=${p}`);
  assertVerdictMatchesItsOwnInterval(s);
  assertCorrelationTableIsSelfConsistent(s);
  assertCountersSum(s);
  assertKeyPanelIsSelfConsistent(s);

  expect(s.headline).toBe('Compromised');
  // The lesson of the demo: a missing 2sqrt(2) is NOT proof of an eavesdropper.
  expect(s.summary).toContain('the channel does not pass the quantum test');
  expect(s.summary).not.toContain('eavesdropper');
  expect(s.detail).toContain('sufficiently strong noise/misalignment');

  const n = sNumbers(s);
  // E -> (1-p)E, so |S| -> (1-p) 2sqrt(2).
  expect(n.expectedAbsS).toBeCloseTo((1 - p) * TSIRELSON, 2);
  expect(Math.abs(n.absS - (1 - p) * TSIRELSON)).toBeLessThan(0.15);
  for (const r of s.rows) {
    expect(Math.abs(Math.abs(r.expected) - (1 - p) / SQRT2)).toBeLessThan(0.001);
  }
  const k = keyNumbers(s);
  expect(k.expectedPct).toBeCloseTo(100 * (1 - p / 2), 1);
});

test('failure path — analyzer misalignment past 22.5 degrees looks exactly like an attack', async ({
  page,
}) => {
  const delta = 30 * DEG;
  const s = await run(page, `#s=misaligned&r=10000&seed=1&misalignRad=${delta}`);
  assertVerdictMatchesItsOwnInterval(s);
  assertCorrelationTableIsSelfConsistent(s);
  assertCountersSum(s);
  assertKeyPanelIsSelfConsistent(s);

  expect(s.headline).toBe('Compromised');
  expect(s.summary).toContain('Bell violation lost');
  expect(s.summary).not.toContain('eavesdropper');

  const n = sNumbers(s);
  // |S| = 2sqrt(2) cos(2 delta); at 30 degrees that is sqrt(2).
  expect(n.expectedAbsS).toBeCloseTo(TSIRELSON * Math.cos(2 * delta), 2);
  expect(Math.abs(n.absS - SQRT2)).toBeLessThan(0.15);
  const k = keyNumbers(s);
  expect(k.expectedPct).toBeCloseTo(50 * (1 + Math.cos(2 * delta)), 1);
});

test('failure path — the borderline case stays inconclusive and asks for more rounds', async ({
  page,
}) => {
  // delta = 22.5 degrees puts the true |S| exactly on the classical bound, so
  // with 3k rounds the interval has to straddle it.
  const s = await run(page, `#s=misaligned&r=3000&seed=2&misalignRad=${22.5 * DEG}`);
  assertVerdictMatchesItsOwnInterval(s);
  assertCorrelationTableIsSelfConsistent(s);
  assertCountersSum(s);

  expect(s.headline).toBe('Inconclusive');
  expect(s.detail).toContain('run more rounds');
  const n = sNumbers(s);
  expect(n.expectedAbsS).toBeCloseTo(2, 3);
  expect(n.ciLo).toBeLessThan(2);
  expect(n.ciHi).toBeGreaterThan(2);
});

test('failure path — photon loss starves the statistics instead of breaking them', async ({
  page,
}) => {
  const eta = 0.5;
  const lossy = await run(page, `#s=lossy&r=10000&seed=1&lossEta=${eta}`);
  assertVerdictMatchesItsOwnInterval(lossy);
  assertCorrelationTableIsSelfConsistent(lossy);
  assertCountersSum(lossy);
  assertKeyPanelIsSelfConsistent(lossy);

  const lc = runCounters(lossy);
  // Only coincidences count, at rate eta^2 (the README's headline claim).
  expect(lc.requested).toBe(10000);
  expect(Math.abs(lc.coincidences - lc.requested * eta * eta)).toBeLessThan(
    0.05 * lc.requested * eta * eta,
  );

  // Entanglement is intact, so |S| stays quantum...
  const ln = sNumbers(lossy);
  expect(ln.expectedAbsS).toBeCloseTo(TSIRELSON, 2);
  expect(Math.abs(ln.absS - TSIRELSON)).toBeLessThan(0.2);

  // ...but the interval is wider than the lossless run at the same rounds.
  const ideal = await run(page, '#s=ideal&r=10000&seed=1');
  const inum = sNumbers(ideal);
  expect(ln.seS).toBeGreaterThan(inum.seS);
  expect(ln.ciHi - ln.ciLo).toBeGreaterThan(inum.ciHi - inum.ciLo);
  expect(runCounters(ideal).coincidences).toBe(10000);
});

test('a key shorter than the grid is described by the grid it actually drew', async ({ page }) => {
  // Heavy loss (eta = 0.2) over the minimum 1000 rounds sifts only a couple of
  // dozen key bits — fewer than the 64-cell grid. Regression pin: the grid's
  // accessible name used to hard-code 64 no matter how many cells existed.
  const s = await run(page, '#s=lossy&r=1000&seed=1&lossEta=0.2');
  const k = keyNumbers(s);
  expect(k.siftedBits).toBeGreaterThan(0);
  expect(k.siftedBits).toBeLessThan(64);
  assertCountersSum(s);
  assertKeyPanelIsSelfConsistent(s);
  expect(s.cellStates).toHaveLength(k.siftedBits);
  expect(s.bitGridLabel).toContain(`First ${k.siftedBits} key bits`);
  expect(s.aliceBits).not.toContain('…');
});

// --- 3. the 3-sigma outlier badge -----------------------------------------

test('the ! badge marks exactly the rows more than 3 sigma from expected', async ({ page }) => {
  // Seed chosen because one correlation lands ~3.9 sigma off; every other
  // seeded run in this suite must stay clean.
  const s = await run(page, '#s=ideal&r=10000&seed=1498');
  assertCorrelationTableIsSelfConsistent(s);
  let badged = 0;
  for (const r of s.rows) {
    const sigma = Math.abs((r.measured - r.expected) / r.se);
    expect(
      r.badged,
      `${r.label} is ${sigma.toFixed(2)} sigma off but badged=${r.badged}`,
    ).toBe(sigma > 3);
    if (r.badged) badged++;
  }
  expect(badged).toBe(1);

  const clean = await run(page, '#s=ideal&r=10000&seed=1');
  expect(clean.rows.every((r) => !r.badged)).toBe(true);
});

// --- 4. round-by-round transcript -----------------------------------------

test('transcript rows are internally consistent and off by default', async ({ page }) => {
  const off = await run(page, '#s=ideal&r=10000&seed=1');
  expect(off.transcript).toHaveLength(0);

  const on = await run(page, `#s=misaligned&r=10000&seed=1&t=1&misalignRad=${15 * DEG}`);
  expect(on.transcript).toHaveLength(50); // the advertised cap

  let prevRound = 0;
  let chsh = 0;
  let key = 0;
  for (const row of on.transcript) {
    const [roundStr, bucket, aliceCell, bobCell, aStr, bStr, prodStr] = row as [
      string,
      string,
      string,
      string,
      string,
      string,
      string,
    ];
    const round = num(roundStr);
    expect(round).toBeGreaterThan(prevRound);
    prevRound = round;
    expect(round).toBeLessThanOrEqual(10000);

    const A = num(aStr);
    const B = num(bStr);
    const product = num(prodStr);
    expect([1, -1]).toContain(A);
    expect([1, -1]).toContain(B);
    expect(product, `row ${round}: A*B does not match the product column`).toBe(A * B);

    if (bucket === 'CHSH') {
      chsh++;
      expect(aliceCell).toMatch(/^a[12] · (0|45)°$/);
      // Bob's column shows his ACTUAL angle, i.e. nominal + 15 degrees.
      expect(bobCell).toMatch(/^b[12] · (37|-8)°$/);
    } else {
      key++;
      expect(bucket).toBe('key');
      expect(aliceCell).toBe('key · 45°');
      expect(bobCell).toBe('key · 60°'); // 45 + 15 misalignment
    }
  }
  expect(chsh + key).toBe(50);
  expect(chsh).toBeGreaterThan(0);
  expect(key).toBeGreaterThan(0);
});

// --- 5. shareable runs: hash, copy link, CSV ------------------------------

test('the copied link reproduces the exact run', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('.');
  await expect(page.locator('#e91-output')).not.toBeEmpty();
  await page.locator('button[data-scenario="noisy"]').click();
  await page.locator('#e91-seed').fill('7');
  await page.locator('#e91-run').click();
  const before = await snapshot(page);

  await page.locator('#e91-copy-link').click();
  await expect(page.locator('#e91-copy-link')).toContainText('Link copied');
  const link = await page.evaluate(() => navigator.clipboard.readText());
  expect(link).toContain('#s=noisy');
  expect(link).toContain('seed=7');
  expect(link).toContain('noiseP=');

  const fresh = await page.context().newPage();
  await fresh.goto(link);
  await expect(fresh.locator('#e91-output')).not.toBeEmpty();
  const after = await snapshot(fresh);
  await fresh.close();

  expect(after.headline).toBe(before.headline);
  expect(sNumbers(after).absS).toBe(sNumbers(before).absS);
  expect(after.rows.map((r) => r.measured)).toEqual(before.rows.map((r) => r.measured));
  expect(after.keyLine).toBe(before.keyLine);
});

test('the exported CSV carries the same numbers the page shows', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const s = await run(page, '#s=eve&r=10000&seed=7');
  await page.locator('#e91-copy-csv').click();
  await expect(page.locator('#e91-copy-csv')).toContainText('CSV copied');
  const csv = await page.evaluate(() => navigator.clipboard.readText());

  const field = (name: string): string => {
    const m = new RegExp(`^${name},(.*)$`, 'm').exec(csv);
    expect(m, `CSV is missing ${name}:\n${csv.slice(0, 400)}`).not.toBeNull();
    return m![1]!.trim();
  };
  expect(field('scenario')).toBe('eve');
  expect(field('verdict')).toBe('compromised');
  expect(s.headline).toBe('Compromised');

  const n = sNumbers(s);
  const c = runCounters(s);
  expect(num(field('rounds_requested'))).toBe(c.requested);
  expect(num(field('effective_rounds'))).toBe(c.coincidences);
  expect(Math.abs(num(field('S_measured')))).toBeCloseTo(n.absS, 3);
  expect(num(field('S_stderr'))).toBeCloseTo(n.seS, 4);
  expect(num(field('classical_bound'))).toBe(2);
  expect(num(field('tsirelson_bound'))).toBeCloseTo(TSIRELSON, 9);
  expect(100 * num(field('key_agreement'))).toBeCloseTo(keyNumbers(s).measuredPct, 2);

  // One CSV row per correlation, matching the rendered table.
  for (const row of s.rows) {
    const m = new RegExp(`^${row.label.replace(/[()]/g, '\\$&')},([^,]+),([^,]+),([^,]+),([^,]+),`, 'm').exec(csv);
    expect(m, `CSV is missing correlation row ${row.label}`).not.toBeNull();
    expect(num(m![2]!)).toBeCloseTo(row.measured, 3);
    expect(num(m![3]!)).toBeCloseTo(row.se, 4);
    expect(num(m![4]!)).toBe(row.n);
  }
});

// --- 6. the controls actually control something ---------------------------

test('scenario strip offers all five channel models and each re-runs the sim', async ({ page }) => {
  await page.goto('.');
  await expect(page.locator('#e91-output')).not.toBeEmpty();
  const chips = page.locator('.scenario-chip');
  await expect(chips).toHaveCount(5);
  await expect(chips).toHaveText([/Ideal/, /Eve/, /Noisy/, /Misaligned/, /Lossy/]);

  const expectations: Record<string, { heading: RegExp; knob: boolean }> = {
    ideal: { heading: /Ideal entangled channel/, knob: false },
    eve: { heading: /Intercept-resend eavesdropper/, knob: false },
    noisy: { heading: /Noisy channel/, knob: true },
    misaligned: { heading: /Misaligned analyzer/, knob: true },
    lossy: { heading: /Lossy channel/, knob: true },
  };
  for (const [id, exp] of Object.entries(expectations)) {
    await page.locator(`button[data-scenario="${id}"]`).click();
    await expect(page.locator('#scenario-card h3')).toHaveText(exp.heading);
    await expect(page.locator('#scenario-knob')).toHaveCount(exp.knob ? 1 : 0);
    await expect(page.locator('.scenario-expectation')).not.toBeEmpty();
    const s = await snapshot(page);
    assertVerdictMatchesItsOwnInterval(s);
    assertCorrelationTableIsSelfConsistent(s);
    assertCountersSum(s);
    expect(s.sideRun).toContain('scenario:');
  }
});

test('the noise slider moves the verdict from secure to compromised', async ({ page }) => {
  await page.goto('.');
  await expect(page.locator('#e91-output')).not.toBeEmpty();
  await page.locator('button[data-scenario="noisy"]').click();
  const before = await snapshot(page);
  expect(before.headline).toBe('Secure'); // default p = 0.2 still violates

  const knob = page.locator('#scenario-knob');
  await knob.fill('0.5');
  await knob.dispatchEvent('change');
  await expect(page.locator('#scenario-knob-display')).toHaveText('0.50');
  const after = await snapshot(page);
  assertVerdictMatchesItsOwnInterval(after);
  expect(after.headline).toBe('Compromised');
  expect(sNumbers(after).absS).toBeLessThan(sNumbers(before).absS);
  expect(page.url()).toContain('noiseP=0.5');
});

test('the rounds control changes the sample size and tightens the interval', async ({ page }) => {
  await page.goto('.');
  await expect(page.locator('#e91-output')).not.toBeEmpty();
  await page.locator('#e91-rounds').fill('2000');
  await page.locator('#e91-run').click();
  const small = await snapshot(page);
  assertCountersSum(small);
  expect(runCounters(small).requested).toBe(2000);

  await page.locator('#e91-rounds').fill('20000');
  await page.locator('#e91-run').click();
  const big = await snapshot(page);
  assertCountersSum(big);
  expect(runCounters(big).requested).toBe(20000);
  expect(sNumbers(big).seS).toBeLessThan(sNumbers(small).seS);

  // Out-of-range input is clamped rather than producing a garbage run.
  await page.locator('#e91-rounds').fill('10');
  await page.locator('#e91-run').click();
  const clamped = await snapshot(page);
  expect(runCounters(clamped).requested).toBe(1000);
  assertCountersSum(clamped);
});

// --- 7. static claims a reader can check by eye ---------------------------

test('the explainer matches the engine: curve points, protocol steps, comparison table', async ({
  page,
}) => {
  await page.goto('.');
  await expect(page.locator('#e91-output')).not.toBeEmpty();

  // The four CHSH points marked on E(delta) = -cos(2 delta) must carry the
  // same values the correlation table calls "expected" in the ideal case.
  const dots = await page.locator('.curve-dot title').allTextContents();
  expect(dots).toHaveLength(4);
  const dotValues = dots.map((t) => num(/= (-?[\d.]+) at/.exec(t)![1]!));
  const ideal = await snapshot(page);
  expect(dotValues).toEqual(ideal.rows.map((r) => r.expected));
  for (const v of dotValues) expect(Math.abs(Math.abs(v) - 1 / SQRT2)).toBeLessThan(0.001);

  // Five-step protocol flow, six-row E91-vs-BB84 table (README promises both).
  await expect(page.locator('.proto-list .proto-step')).toHaveCount(5);
  const compare = page.locator('.compare-e91 tbody tr');
  await expect(compare).toHaveCount(6);
  await expect(compare.filter({ hasText: 'Security argument' })).toContainText(
    "Violation of Bell's inequality",
  );
  await expect(compare.filter({ hasText: 'Eavesdropper signal' })).toContainText('CHSH parameter');

  // Real-world timeline and references are present with their years.
  await expect(page.locator('.hist-list .hist-item')).toHaveCount(6);
  for (const year of ['1964', '1982', '1991', '2015', '2017', '2022']) {
    await expect(page.locator('.hist-list').filter({ hasText: year })).toHaveCount(1);
  }
  await expect(page.locator('.refs-list .ref-row')).toHaveCount(12); // 9 primary + 3 further
  await expect(page.locator('.caveat-box')).toContainText('Does not model');
});
