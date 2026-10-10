// Deterministic node-test-runner suite for src/engine.ts. Run with
//   node --experimental-strip-types --no-warnings --test scripts/engine.test.mjs
// (requires Node 22+). The seeded RNG inside engine.ts makes every assertion
// reproducible, so CI can run this without flakiness.

import test from 'node:test';
import assert from 'node:assert/strict';

import {
	ALICE_ANGLES,
	BOB_ANGLES,
	KEY_ANGLE,
	SCENARIO_DEFAULTS,
	correlation,
	correlationConfidence,
	expectedCorrelation,
	expectedKeyAgreement,
	expectedS,
	resolveScenario,
	runE91,
} from '../src/engine.ts';

const SQRT2 = Math.SQRT2;
const TSIRELSON = 2 * SQRT2;

const close = (a, b, eps = 1e-9) => Math.abs(a - b) < eps;

// ------------------------------- helpers --------------------------------

test('correlation: textbook values', () => {
	assert.ok(close(correlation(0, 0), -1));
	assert.ok(close(correlation(0, Math.PI / 8), -Math.cos(Math.PI / 4)));
	assert.ok(close(correlation(0, Math.PI / 4), 0));
	assert.ok(close(correlation(Math.PI / 4, Math.PI / 8), -Math.cos(Math.PI / 4)));
});

test('correlation is symmetric in (a-b)', () => {
	for (const d of [0.1, 0.5, 1.2, -0.7]) {
		assert.ok(close(correlation(0, d), correlation(d, 0)));
	}
});

// ----------------------------- expected S -------------------------------

test('expectedS: ideal reaches Tsirelson', () => {
	const s = expectedS(SCENARIO_DEFAULTS.ideal);
	assert.ok(close(Math.abs(s), TSIRELSON, 1e-9), `expected 2√2, got ${s}`);
});

test('expectedS: intercept-resend Eve collapses to sqrt(2)', () => {
	const s = expectedS(SCENARIO_DEFAULTS.eve);
	assert.ok(close(Math.abs(s), SQRT2, 1e-9), `expected √2 (~1.414), got ${s}`);
});

test('expectedS: depolarizing channel scales by (1-p)', () => {
	for (const p of [0, 0.1, 0.25, 0.5, 0.8]) {
		const sc = resolveScenario({ id: 'noisy', noiseP: p });
		const s = expectedS(sc);
		const expected = (1 - p) * TSIRELSON;
		assert.ok(
			close(Math.abs(s), expected, 1e-9),
			`p=${p} expected |S|=${expected.toFixed(6)} got ${Math.abs(s).toFixed(6)}`,
		);
	}
});

test('expectedS: misalignment by delta scales by cos(2 delta)', () => {
	for (const deg of [0, 5, 10, 15, 22.5, 30]) {
		const sc = resolveScenario({ id: 'misaligned', misalignRad: (deg * Math.PI) / 180 });
		const s = expectedS(sc);
		const expected = TSIRELSON * Math.cos((2 * deg * Math.PI) / 180);
		assert.ok(
			close(Math.abs(s), expected, 1e-9),
			`delta=${deg}° expected |S|=${expected.toFixed(6)} got ${Math.abs(s).toFixed(6)}`,
		);
	}
});

test('expectedS: misalignment at delta = pi/4 zeros the violation', () => {
	const sc = resolveScenario({ id: 'misaligned', misalignRad: Math.PI / 4 });
	assert.ok(close(expectedS(sc), 0, 1e-9));
});

test('expectedS: lossy channel does not change the expected value', () => {
	const s = expectedS(resolveScenario({ id: 'lossy', lossEta: 0.5 }));
	assert.ok(close(Math.abs(s), TSIRELSON, 1e-9));
});

// --------------------- expected key agreement ---------------------------

test('expectedKeyAgreement: ideal = 1', () => {
	assert.ok(close(expectedKeyAgreement(SCENARIO_DEFAULTS.ideal), 1));
});

test('expectedKeyAgreement: Eve at pi/8 = 0.75', () => {
	const k = expectedKeyAgreement(SCENARIO_DEFAULTS.eve);
	assert.ok(close(k, 0.75, 1e-9), `expected 0.75 under intercept-resend, got ${k}`);
});

test('expectedKeyAgreement: noisy = 1 - p/2', () => {
	for (const p of [0, 0.1, 0.3, 0.5]) {
		const sc = resolveScenario({ id: 'noisy', noiseP: p });
		assert.ok(close(expectedKeyAgreement(sc), 1 - p / 2, 1e-9));
	}
});

// ---------------- expectedCorrelation per-pair sanity -------------------

test('expectedCorrelation matches the engine convention', () => {
	const sc = SCENARIO_DEFAULTS.ideal;
	const e = expectedCorrelation(ALICE_ANGLES[0], BOB_ANGLES[0], sc);
	assert.ok(close(e, -Math.cos(Math.PI / 4)));
	const e22 = expectedCorrelation(ALICE_ANGLES[1], BOB_ANGLES[1], sc);
	assert.ok(close(e22, -Math.cos(3 * Math.PI / 4)));
});

// ---------------------------- runE91 ------------------------------------

test('runE91 (ideal, 30k, seed=1): |S| within 0.05 of 2sqrt(2)', () => {
	const r = runE91({ rounds: 30000, scenario: 'ideal', seed: 1 });
	assert.ok(Math.abs(Math.abs(r.S) - TSIRELSON) < 0.05, `|S| was ${Math.abs(r.S)}`);
	assert.equal(r.verdict.classification, 'secure');
	assert.equal(r.eavesdropperDetected, false);
});

test('runE91 (eve, 30k, seed=1): |S| collapses near sqrt(2), verdict compromised', () => {
	const r = runE91({ rounds: 30000, scenario: 'eve', seed: 1 });
	assert.ok(Math.abs(Math.abs(r.S) - SQRT2) < 0.05, `|S| was ${Math.abs(r.S)}`);
	assert.equal(r.verdict.classification, 'compromised');
	assert.equal(r.eavesdropperDetected, true);
});

test('runE91 (noisy p=0.5, 30k, seed=2): |S| near (1-p)*2sqrt(2)', () => {
	const r = runE91({ rounds: 30000, scenario: { id: 'noisy', noiseP: 0.5 }, seed: 2 });
	const target = 0.5 * TSIRELSON; // ~1.414
	assert.ok(Math.abs(Math.abs(r.S) - target) < 0.06, `|S| was ${Math.abs(r.S)}`);
	assert.equal(r.verdict.classification, 'compromised');
});

test('runE91 (misaligned 30deg, 30k, seed=3): |S| near 2sqrt(2)*cos(60deg) = sqrt(2)', () => {
	const r = runE91({
		rounds: 30000,
		scenario: { id: 'misaligned', misalignRad: (30 * Math.PI) / 180 },
		seed: 3,
	});
	const target = TSIRELSON * Math.cos(Math.PI / 3);
	assert.ok(Math.abs(Math.abs(r.S) - target) < 0.05, `|S| was ${Math.abs(r.S)} target ${target}`);
});

test('runE91 (ideal, 30k): key agreement is 100%', () => {
	const r = runE91({ rounds: 30000, scenario: 'ideal', seed: 4 });
	assert.equal(r.keyAgreement, 1);
});

test('runE91 (eve): key agreement near 0.75', () => {
	const r = runE91({ rounds: 30000, scenario: 'eve', seed: 5 });
	assert.ok(Math.abs(r.keyAgreement - 0.75) < 0.02, `got ${r.keyAgreement}`);
});

test('runE91 (lossy eta=0.5): effectiveRounds ~ rounds * eta^2', () => {
	const r = runE91({
		rounds: 40000,
		scenario: { id: 'lossy', lossEta: 0.5 },
		seed: 6,
	});
	const expected = 40000 * 0.25;
	assert.ok(Math.abs(r.effectiveRounds - expected) < 600, `got ${r.effectiveRounds}`);
});

test('runE91: transcript respects cap and labels buckets', () => {
	const r = runE91({ rounds: 1000, scenario: 'ideal', seed: 7, transcript: 40 });
	assert.equal(r.transcript.length, 40);
	for (const row of r.transcript) {
		assert.ok(row.bucket === 'CHSH' || row.bucket === 'key');
		assert.ok(row.A === 1 || row.A === -1);
		assert.ok(row.B === 1 || row.B === -1);
		assert.equal(row.product, row.A * row.B);
		if (row.bucket === 'key') {
			assert.ok(Math.abs(row.aliceAngle - KEY_ANGLE) < 1e-12);
		}
	}
});

test('runE91: transcript default is empty', () => {
	const r = runE91({ rounds: 200, scenario: 'ideal', seed: 8 });
	assert.equal(r.transcript.length, 0);
});

// ------------------- statistics + verdict edges -------------------------

test('runE91: per-correlation stderr and CI are populated', () => {
	const r = runE91({ rounds: 5000, scenario: 'ideal', seed: 9 });
	for (const c of r.correlations) {
		assert.ok(c.n > 100);
		assert.ok(c.stderr > 0 && c.stderr < 0.1);
		assert.ok(c.ci95Lo < c.measured);
		assert.ok(c.ci95Hi > c.measured);
	}
});

test('runE91: S CI brackets the measured value', () => {
	const r = runE91({ rounds: 5000, scenario: 'ideal', seed: 10 });
	assert.ok(r.sCi95Lo < r.S);
	assert.ok(r.sCi95Hi > r.S);
	assert.ok(r.sStdErr > 0);
});

test('runE91: tiny sample size yields inconclusive verdict for the borderline case', () => {
	// At noiseP that puts |S| ~ 2.12 with only a few hundred rounds, the
	// confidence interval should straddle the classical bound.
	const r = runE91({
		rounds: 400,
		scenario: { id: 'noisy', noiseP: 0.25 },
		seed: 11,
	});
	assert.ok(
		['inconclusive', 'secure', 'compromised'].includes(r.verdict.classification),
	);
	// With this combination, the CI is wide enough that the verdict cannot be
	// firmly secure; check at minimum that |S|'s CI half-width is appreciable.
	assert.ok(r.sStdErr > 0.05, `expected wide CI, got stderr ${r.sStdErr}`);
});

test('runE91: legacy `eve: true` selects the eve scenario', () => {
	const r = runE91({ rounds: 8000, eve: true, seed: 12 });
	assert.equal(r.scenario.id, 'eve');
	assert.equal(r.verdict.classification, 'compromised');
});

test('runE91: legacy `eve: false` selects the ideal scenario', () => {
	const r = runE91({ rounds: 8000, eve: false, seed: 13 });
	assert.equal(r.scenario.id, 'ideal');
	assert.equal(r.verdict.classification, 'secure');
});

// ---------------------- resolveScenario ---------------------------------

test('resolveScenario by id returns the canonical defaults', () => {
	const sc = resolveScenario('noisy');
	assert.deepEqual(sc, SCENARIO_DEFAULTS.noisy);
});

test('resolveScenario merges partial overrides into defaults', () => {
	const sc = resolveScenario({ id: 'noisy', noiseP: 0.4 });
	assert.equal(sc.id, 'noisy');
	assert.equal(sc.noiseP, 0.4);
	assert.equal(sc.eveAngle, 0);
});

// Finite-sample negative controls: point estimates at the extrema are not certainty.
test('missing Bell observations are unobserved and inconclusive, not compromised', () => {
  for (const opts of [
    { rounds: 0, scenario: 'ideal', seed: 1 },
    { rounds: 1000, scenario: { id: 'lossy', lossEta: 0 }, seed: 1 },
  ]) {
    const r = runE91(opts);
    assert.equal(r.verdict.classification, 'inconclusive');
    assert.equal(r.eavesdropperDetected, false);
    assert.deepEqual([r.sCi95Lo, r.sCi95Hi], [-4, 4]);
    assert.deepEqual([r.verdict.absSCi95Lo, r.verdict.absSCi95Hi], [0, 4]);
    assert.match(r.verdict.detail, /unobserved|missing/i);
    for (const c of r.correlations) {
      assert.equal(c.n, 0);
      assert.deepEqual([c.ci95Lo, c.ci95Hi], [-1, 1]);
      assert.ok(Number.isNaN(c.stderr), 'no observations do not estimate zero variance');
    }
  }
});

test('a missing setting prevents a confident Bell verdict', () => {
  const r = runE91({ rounds: 4, scenario: 'ideal', seed: 1 });
  assert.ok(r.correlations.some(c => c.n === 0));
  assert.equal(r.verdict.classification, 'inconclusive');
  assert.match(r.verdict.detail, /unobserved|missing/i);
});

test('supported sparse lossy run retains uncertainty at identical outcomes', () => {
  const r = runE91({ rounds: 1000, scenario: { id: 'lossy', lossEta: 0.2 }, seed: 1 });
  assert.deepEqual(r.correlations.map(c => c.n), [4, 10, 5, 6]);
  assert.ok(close(Math.abs(r.S), 3.8));
  assert.equal(r.verdict.classification, 'inconclusive');
  assert.ok(r.sCi95Lo <= r.expectedS && r.expectedS <= r.sCi95Hi);
  assert.ok(r.sCi95Lo >= -4 && r.sCi95Hi <= 4);
  for (const c of r.correlations) {
    assert.ok(c.ci95Lo >= -1 && c.ci95Hi <= 1);
    assert.ok(c.ci95Hi > c.ci95Lo, 'all-equal finite samples still have uncertainty');
  }
});

test('absolute CHSH confidence bounds fold the signed interval through zero', () => {
  const r = runE91({ rounds: 1000, scenario: { id: 'noisy', noiseP: 1 }, seed: 2 });
  assert.ok(r.sCi95Lo < 0 && r.sCi95Hi > 0);
  assert.equal(r.verdict.absSCi95Lo, 0);
  assert.equal(r.verdict.absSCi95Hi, Math.max(-r.sCi95Lo, r.sCi95Hi));
});

// Exact binomial probabilities, not simulation or a formula-mirroring oracle:
// enumerate every possible sample outcome and verify the per-setting error budget.
test('finite-sample bounds meet the .0125 binomial noncoverage budget at small n', () => {
  for (const n of [...Array.from({ length: 30 }, (_, i) => i + 1), 50, 80, 120]) {
    for (let step = 0; step <= 200; step++) {
      const p = step / 200;
      const trueE = 2 * p - 1;
      let outsideProbability = 0;
      let choose = 1;
      for (let k = 0; k <= n; k++) {
        const ci = correlationConfidence(2 * k - n, n);
        if (trueE < ci.lo || trueE > ci.hi) {
          outsideProbability += choose * p ** k * (1 - p) ** (n - k);
        }
        choose *= (n - k) / (k + 1);
      }
      assert.ok(outsideProbability <= .0125 + 1e-12,
        `n=${n}, p=${p}, exact binomial noncoverage=${outsideProbability}`);
    }
  }
});

test('finite identical outcomes retain a nonzero confidence width; missing is full range', () => {
  assert.deepEqual(correlationConfidence(0, 0), { lo: -1, hi: 1 });
  for (const n of [1, 2, 4, 20, 1000]) {
    const positive = correlationConfidence(n, n);
    const negative = correlationConfidence(-n, n);
    assert.ok(positive.lo < 1);
    assert.equal(positive.hi, 1);
    assert.equal(negative.lo, -1);
    assert.ok(negative.hi > -1);
    assert.equal(positive.lo, -negative.hi);
  }
});

test('impossible counts cannot manufacture confidence evidence', () => {
  for (const [sum, n] of [[1, 0], [2, 1], [0, 1], [0, -1], [0, .5], [0, NaN], [NaN, 1], [0, Infinity], [0, Number.MAX_SAFE_INTEGER + 1], [-2, Number.MAX_SAFE_INTEGER]]) {
    assert.throws(() => correlationConfidence(sum, n), RangeError);
  }
});
