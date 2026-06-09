// engine.ts — Ekert 1991 (E91) entanglement-based quantum key distribution.
// Security rests on QUANTUM ENTANGLEMENT and the violation of Bell's inequality,
// NOT on the no-cloning/measurement-disturbance argument of BB84.
//
// Physics modeled faithfully (in the standard idealized form):
//   * a source emits polarization-entangled photon pairs in the singlet state
//   * Alice and Bob each independently pick a measurement angle each round
//   * the quantum correlation for the singlet is  E(a,b) = -cos(2(a-b))
//   * outcomes are +1/-1, sampled from the correct joint quantum probabilities
//   * the CHSH parameter S is computed from four angle combinations:
//       S = E(a1,b1) + E(a1,b2) + E(a2,b1) - E(a2,b2)
//     |S| <= 2 for any local hidden-variable (classical) theory;
//     quantum mechanics reaches |S| = 2*sqrt(2) ~= 2.828 (Tsirelson's bound).
//   * the secret key comes from rounds where Alice and Bob used ALIGNED bases.
//
// Scenarios modelled (textbook channel models):
//   * 'ideal'      — pristine entangled channel
//   * 'eve'        — intercept-resend eavesdropper at a fixed basis
//   * 'noisy'      — depolarizing channel (probability p of replacing the pair
//                    with independent uniform outcomes); E -> (1-p)*E
//   * 'misaligned' — Bob's analyzer offset by a fixed angle delta
//   * 'lossy'      — each photon arrives independently with probability eta;
//                    only coincidences contribute (rate eta^2)
//
// On top of the verified samplers we add: per-correlation standard errors,
// 95% confidence intervals, and a sample-size-aware verdict — so the security
// classification depends on the data and how much of it there is, not a fixed
// |S| threshold. The verified physics primitives (`samplePair`,
// `samplePairWithEve`, `correlation`) are preserved verbatim.

export type Outcome = -1 | 1;

// --- angle settings -------------------------------------------------------
export const ALICE_ANGLES = [0, Math.PI / 4]; // a1, a2
export const BOB_ANGLES = [Math.PI / 8, -Math.PI / 8]; // b1, b2
export const KEY_ANGLE = Math.PI / 4;
export const DEFAULT_EVE_ANGLE = Math.PI / 8;

// Quantum correlation for the singlet state at analyzer angles a, b.
export function correlation(a: number, b: number): number {
	return -Math.cos(2 * (a - b));
}

// --- verified physics primitives (UNCHANGED) -----------------------------

// Sample a single entangled-pair measurement at angles (a,b) from the singlet
// state. Returns +-1 outcomes with <A*B> = -cos(2(a-b)).
function samplePair(a: number, b: number, rng: () => number): { A: Outcome; B: Outcome } {
	const E = correlation(a, b);
	const A: Outcome = rng() < 0.5 ? 1 : -1;
	const productPositive = rng() < (1 + E) / 2; // P(A*B = +1) = (1+E)/2
	const B: Outcome = (productPositive ? A : -A) as Outcome;
	return { A, B };
}

// Intercept-resend Eve: measures each photon in a fixed basis (eveAngle),
// collapsing the entanglement, then resends product states. Downstream
// correlations become a classical mixture and |S| drops back toward 2.
function samplePairWithEve(
	a: number,
	b: number,
	eveAngle: number,
	rng: () => number,
): { A: Outcome; B: Outcome } {
	const eVal: Outcome = rng() < 0.5 ? 1 : -1; // Eve's collapse on Alice-side photon
	const eValB: Outcome = -eVal as Outcome; // singlet: Bob-side opposite at her basis

	const measure = (prepared: Outcome, prepAngle: number, analyzeAngle: number): Outcome => {
		// Malus law: P(+1 aligned with 'prepared') = cos^2(analyze - prep).
		const pAlignedPlus = Math.cos(analyzeAngle - prepAngle) ** 2;
		const pOutcomePrepared = prepared === 1 ? pAlignedPlus : 1 - pAlignedPlus;
		return (rng() < pOutcomePrepared ? 1 : -1) as Outcome;
	};
	const A = measure(eVal, eveAngle, a);
	const B = measure(eValB, eveAngle, b);
	return { A, B };
}

// --- additional textbook channel models ----------------------------------

// Depolarizing channel: with probability p, replace the entangled pair with
// uniformly random independent outcomes; otherwise sample the singlet. Result:
// E_noisy(a,b) = (1-p) * E_singlet(a,b).
function samplePairNoisy(
	a: number,
	b: number,
	p: number,
	rng: () => number,
): { A: Outcome; B: Outcome } {
	if (rng() < p) {
		const A: Outcome = rng() < 0.5 ? 1 : -1;
		const B: Outcome = rng() < 0.5 ? 1 : -1;
		return { A, B };
	}
	return samplePair(a, b, rng);
}

// --- scenarios -----------------------------------------------------------

export type ScenarioId = 'ideal' | 'eve' | 'noisy' | 'misaligned' | 'lossy';

export interface Scenario {
	id: ScenarioId;
	noiseP: number; // depolarizing probability (0..1)
	misalignRad: number; // Bob's analyzer offset (radians)
	lossEta: number; // detection efficiency per photon (0..1)
	eveAngle: number; // Eve's intercept basis (radians)
}

export const SCENARIO_DEFAULTS: Record<ScenarioId, Scenario> = {
	ideal: { id: 'ideal', noiseP: 0, misalignRad: 0, lossEta: 1, eveAngle: 0 },
	eve: { id: 'eve', noiseP: 0, misalignRad: 0, lossEta: 1, eveAngle: DEFAULT_EVE_ANGLE },
	noisy: { id: 'noisy', noiseP: 0.2, misalignRad: 0, lossEta: 1, eveAngle: 0 },
	misaligned: {
		id: 'misaligned',
		noiseP: 0,
		misalignRad: (15 * Math.PI) / 180,
		lossEta: 1,
		eveAngle: 0,
	},
	lossy: { id: 'lossy', noiseP: 0, misalignRad: 0, lossEta: 0.5, eveAngle: 0 },
};

export const SCENARIO_LABELS: Record<ScenarioId, { name: string; shortName: string }> = {
	ideal: { name: 'Ideal entangled channel', shortName: 'Ideal' },
	eve: { name: 'Intercept-resend eavesdropper', shortName: 'Eve' },
	noisy: { name: 'Noisy channel (depolarizing)', shortName: 'Noisy' },
	misaligned: { name: 'Misaligned analyzer', shortName: 'Misaligned' },
	lossy: { name: 'Lossy channel (photon loss)', shortName: 'Lossy' },
};

export function resolveScenario(input: ScenarioId | Partial<Scenario>): Scenario {
	if (typeof input === 'string') return { ...SCENARIO_DEFAULTS[input] };
	const base = input.id ? SCENARIO_DEFAULTS[input.id] : SCENARIO_DEFAULTS.ideal;
	return { ...base, ...input } as Scenario;
}

function samplePairForScenario(
	a: number,
	b: number,
	scenario: Scenario,
	rng: () => number,
): { A: Outcome; B: Outcome } {
	switch (scenario.id) {
		case 'ideal':
			return samplePair(a, b, rng);
		case 'eve':
			return samplePairWithEve(a, b, scenario.eveAngle, rng);
		case 'noisy':
			return samplePairNoisy(a, b, scenario.noiseP, rng);
		case 'misaligned':
			return samplePair(a, b + scenario.misalignRad, rng);
		case 'lossy':
			return samplePair(a, b, rng); // loss handled in the main loop
	}
}

// --- theoretical predictions --------------------------------------------

// E(a, b) predicted by quantum mechanics under the chosen channel model.
// Used as the "expected" column in the UI.
export function expectedCorrelation(a: number, b: number, scenario: Scenario): number {
	switch (scenario.id) {
		case 'ideal':
			return correlation(a, b);
		case 'eve':
			return (
				-Math.cos(2 * (a - scenario.eveAngle)) * Math.cos(2 * (b - scenario.eveAngle))
			);
		case 'noisy':
			return (1 - scenario.noiseP) * correlation(a, b);
		case 'misaligned':
			return correlation(a, b + scenario.misalignRad);
		case 'lossy':
			return correlation(a, b);
	}
}

// Expected CHSH parameter S at the standard angles for the given scenario.
export function expectedS(scenario: Scenario): number {
	const e = (i: number, j: number) =>
		expectedCorrelation(ALICE_ANGLES[i]!, BOB_ANGLES[j]!, scenario);
	return e(0, 0) + e(0, 1) + e(1, 0) - e(1, 1);
}

// Expected key-bit agreement after Bob flips his outcome (so anti-correlated
// outcomes become matching key bits). Ideal singlet at aligned bases gives 1.
export function expectedKeyAgreement(scenario: Scenario): number {
	let eAligned: number;
	switch (scenario.id) {
		case 'ideal':
			eAligned = -1;
			break;
		case 'eve': {
			const c = Math.cos(2 * (KEY_ANGLE - scenario.eveAngle));
			eAligned = -(c * c);
			break;
		}
		case 'noisy':
			eAligned = -(1 - scenario.noiseP);
			break;
		case 'misaligned':
			eAligned = -Math.cos(2 * scenario.misalignRad);
			break;
		case 'lossy':
			eAligned = -1;
			break;
	}
	// Agreement after Bob flips = P(A = -B) = (1 - <AB>)/2.
	return (1 - eAligned) / 2;
}

// --- statistics ----------------------------------------------------------

export interface CorrelationStat {
	label: string;
	expected: number;
	measured: number;
	n: number;
	stderr: number;
	ci95Lo: number;
	ci95Hi: number;
	// legacy alias retained so older UI code keeps working:
	value: number;
}

const Z95 = 1.959963984540054; // normal 97.5% quantile

function correlationStat(
	label: string,
	sum: number,
	n: number,
	expected: number,
): CorrelationStat {
	const measured = n > 0 ? sum / n : 0;
	// Var(A*B) = 1 - E^2, estimated from the measured E.
	const variance = Math.max(0, 1 - measured * measured);
	const stderr = n > 0 ? Math.sqrt(variance / n) : 0;
	return {
		label,
		expected,
		measured,
		n,
		stderr,
		ci95Lo: measured - Z95 * stderr,
		ci95Hi: measured + Z95 * stderr,
		value: measured,
	};
}

// --- verdict -------------------------------------------------------------

export type Classification = 'secure' | 'compromised' | 'inconclusive';

export interface Verdict {
	classification: Classification;
	summary: string;
	detail: string;
	absSCi95Lo: number;
	absSCi95Hi: number;
}

function computeVerdict(S: number, sStdErr: number, scenarioId: ScenarioId): Verdict {
	const absS = Math.abs(S);
	const absSLo = Math.max(0, absS - Z95 * sStdErr);
	const absSHi = absS + Z95 * sStdErr;

	let classification: Classification;
	let summary: string;
	let detail: string;

	const range = `[${absSLo.toFixed(3)}, ${absSHi.toFixed(3)}]`;
	if (absSLo > 2) {
		classification = 'secure';
		summary = 'Channel passes the Bell test — consistent with intact entanglement.';
		detail = `The 95% confidence interval for |S| is ${range}, entirely above the classical bound of 2. The observed statistics are inconsistent with any local hidden-variable model.`;
	} else if (absSHi < 2) {
		classification = 'compromised';
		summary =
			scenarioId === 'eve'
				? 'Bell violation lost — consistent with an intercept-resend eavesdropper.'
				: 'Bell violation lost — the channel does not pass the quantum test.';
		detail = `The 95% confidence interval for |S| is ${range}, entirely below the classical bound of 2. In an experiment this signature can be produced by an eavesdropper or by sufficiently strong noise/misalignment — you cannot tell which from |S| alone, so the key must be discarded.`;
	} else {
		classification = 'inconclusive';
		summary = 'Inconclusive — confidence interval straddles the classical bound.';
		detail = `The 95% confidence interval for |S| is ${range}, which spans the classical bound of 2. The available statistics cannot distinguish a quantum channel from a classical one; run more rounds.`;
	}
	return { classification, summary, detail, absSCi95Lo: absSLo, absSCi95Hi: absSHi };
}

// --- round transcript ----------------------------------------------------

export interface RoundData {
	round: number;
	bucket: 'CHSH' | 'key';
	aliceAngleIdx: number; // 0/1 for CHSH settings, -1 for key-basis rounds
	bobAngleIdx: number;
	aliceAngle: number; // radians (Alice's chosen analyzer angle)
	bobAngle: number; // radians (Bob's actual angle, including misalignment)
	A: Outcome;
	B: Outcome;
	product: number; // A*B
}

// --- result type ---------------------------------------------------------

export interface E91Result {
	S: number;
	sStdErr: number;
	sCi95Lo: number;
	sCi95Hi: number;
	expectedS: number;
	classicalBound: number; // 2
	tsirelsonBound: number; // 2*sqrt(2)
	eavesdropperDetected: boolean; // alias for verdict.classification === 'compromised'
	verdict: Verdict;
	keyBitsAlice: number[];
	keyBitsBob: number[];
	keyAgreement: number;
	expectedKeyAgreement: number;
	rounds: number;
	effectiveRounds: number; // rounds that produced a coincidence (== rounds except under loss)
	correlations: CorrelationStat[];
	scenario: Scenario;
	transcript: RoundData[];
}

// --- seeded RNG ----------------------------------------------------------

function seededRng(seed: number): () => number {
	let s = seed >>> 0;
	return () => {
		s = (s * 1664525 + 1013904223) >>> 0;
		return s / 0xffffffff;
	};
}

// --- main entry ----------------------------------------------------------

export interface RunE91Opts {
	rounds: number;
	/** Legacy flag from the original engine — true picks the 'eve' scenario. */
	eve?: boolean;
	/** New scenario selector. Overrides `eve` if both are given. */
	scenario?: ScenarioId | Partial<Scenario>;
	seed?: number;
	/** Max transcript rows to record (defaults to 0 — no transcript). */
	transcript?: number;
}

export function runE91(opts: RunE91Opts): E91Result {
	const scenario: Scenario =
		opts.scenario !== undefined
			? resolveScenario(opts.scenario)
			: resolveScenario(opts.eve ? 'eve' : 'ideal');
	const rng = opts.seed !== undefined ? seededRng(opts.seed) : Math.random;
	const transcriptCap = Math.max(0, Math.floor(opts.transcript ?? 0));

	const sums = [
		[0, 0],
		[0, 0],
	];
	const counts = [
		[0, 0],
		[0, 0],
	];
	const keyAlice: number[] = [];
	const keyBob: number[] = [];
	const transcript: RoundData[] = [];

	let effectiveRounds = 0;

	for (let r = 0; r < opts.rounds; r++) {
		// Lossy channel: drop the round entirely with prob 1 - eta^2.
		if (scenario.id === 'lossy') {
			const eta = scenario.lossEta;
			if (rng() > eta * eta) continue;
		}
		effectiveRounds++;

		const useForKey = rng() < 0.5;
		if (useForKey) {
			const aliceAngle = KEY_ANGLE;
			const bobAngle =
				scenario.id === 'misaligned' ? KEY_ANGLE + scenario.misalignRad : KEY_ANGLE;
			const pair = samplePairForScenario(KEY_ANGLE, KEY_ANGLE, scenario, rng);
			keyAlice.push(pair.A === 1 ? 1 : 0);
			keyBob.push(pair.B === -1 ? 1 : 0);
			if (transcript.length < transcriptCap) {
				transcript.push({
					round: r + 1,
					bucket: 'key',
					aliceAngleIdx: -1,
					bobAngleIdx: -1,
					aliceAngle,
					bobAngle,
					A: pair.A,
					B: pair.B,
					product: pair.A * pair.B,
				});
			}
		} else {
			const ai = rng() < 0.5 ? 0 : 1;
			const bj = rng() < 0.5 ? 0 : 1;
			const aliceAngle = ALICE_ANGLES[ai]!;
			const bobAngleNominal = BOB_ANGLES[bj]!;
			const bobAngle =
				scenario.id === 'misaligned' ? bobAngleNominal + scenario.misalignRad : bobAngleNominal;
			const pair = samplePairForScenario(aliceAngle, bobAngleNominal, scenario, rng);
			sums[ai]![bj]! += pair.A * pair.B;
			counts[ai]![bj]! += 1;
			if (transcript.length < transcriptCap) {
				transcript.push({
					round: r + 1,
					bucket: 'CHSH',
					aliceAngleIdx: ai,
					bobAngleIdx: bj,
					aliceAngle,
					bobAngle,
					A: pair.A,
					B: pair.B,
					product: pair.A * pair.B,
				});
			}
		}
	}

	const labels = [
		['E(a1,b1)', 'E(a1,b2)'],
		['E(a2,b1)', 'E(a2,b2)'],
	];
	const stats: CorrelationStat[] = [];
	for (let i = 0; i < 2; i++) {
		for (let j = 0; j < 2; j++) {
			stats.push(
				correlationStat(
					labels[i]![j]!,
					sums[i]![j]!,
					counts[i]![j]!,
					expectedCorrelation(ALICE_ANGLES[i]!, BOB_ANGLES[j]!, scenario),
				),
			);
		}
	}

	const stat = (i: number, j: number) => stats[i * 2 + j]!;
	// CHSH sign pattern matches the engine convention: maximally negative for
	// the singlet at the chosen angles, so |S| reaches 2*sqrt(2).
	const S =
		stat(0, 0).measured + stat(0, 1).measured + stat(1, 0).measured - stat(1, 1).measured;
	const sVariance =
		stat(0, 0).stderr ** 2 +
		stat(0, 1).stderr ** 2 +
		stat(1, 0).stderr ** 2 +
		stat(1, 1).stderr ** 2;
	const sStdErr = Math.sqrt(sVariance);
	const sCi95Lo = S - Z95 * sStdErr;
	const sCi95Hi = S + Z95 * sStdErr;

	let matches = 0;
	for (let i = 0; i < keyAlice.length; i++) {
		if (keyAlice[i] === keyBob[i]) matches++;
	}
	const keyAgreement = keyAlice.length ? matches / keyAlice.length : 0;

	const verdict = computeVerdict(S, sStdErr, scenario.id);

	return {
		S,
		sStdErr,
		sCi95Lo,
		sCi95Hi,
		expectedS: expectedS(scenario),
		classicalBound: 2,
		tsirelsonBound: 2 * Math.sqrt(2),
		eavesdropperDetected: verdict.classification === 'compromised',
		verdict,
		keyBitsAlice: keyAlice,
		keyBitsBob: keyBob,
		keyAgreement,
		expectedKeyAgreement: expectedKeyAgreement(scenario),
		rounds: opts.rounds,
		effectiveRounds,
		correlations: stats,
		scenario,
		transcript,
	};
}

export function radToDeg(r: number): number {
	return Math.round((r * 180) / Math.PI);
}

// --- references ----------------------------------------------------------
// Implementation follows the standard textbook idealization of E91 with the
// CHSH inequality. Key sources:
//   * Ekert, A. K. (1991). Quantum cryptography based on Bell's theorem.
//     Physical Review Letters 67, 661.
//   * Clauser, J. F., Horne, M. A., Shimony, A., Holt, R. A. (1969).
//     Proposed experiment to test local hidden-variable theories. PRL 23, 880.
//   * Bell, J. S. (1964). On the Einstein-Podolsky-Rosen paradox. Physics 1, 195.
//   * Cirel'son, B. S. (1980). Quantum generalizations of Bell's inequality.
//     Letters in Mathematical Physics 4, 93.
// Channel models (depolarizing noise, analyzer misalignment, photon loss)
// follow standard quantum-information textbook treatments.
