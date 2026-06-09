// data.ts — copy/content for the E91 demo. No physics here; the engine owns
// the math. Everything below is rendered by ui.ts.

import type { ScenarioId } from './engine.ts';

export interface CompareRow {
	aspect: string;
	bb84: string;
	e91: string;
}

export interface ConceptCard {
	title: string;
	body: string;
}

export interface ProtocolStep {
	step: number;
	title: string;
	detail: string;
}

export interface RealWorldNote {
	year: string;
	title: string;
	body: string;
}

export interface ScenarioCopy {
	id: ScenarioId;
	emoji: string;
	intro: string; // one-line label for the chip
	story: string; // 1–2 sentence physical description
	expectation: string; // what should happen to |S| and key agreement
	knob?: {
		label: string;
		field: 'noiseP' | 'misalignRad' | 'lossEta';
		min: number;
		max: number;
		step: number;
		unit: string;
		toDisplay: (v: number) => string;
		fromDisplay: (v: number) => number;
	};
}

export interface Reference {
	tag: string; // e.g., 'Ekert 1991'
	authors: string;
	title: string;
	venue: string;
	year: string;
	url?: string;
}

// --- BB84 vs E91 -----------------------------------------------------------
// The sibling demo is crypto-lab-bb84. The two protocols solve the same
// problem (key distribution with an eavesdropper alarm built into physics)
// but lean on fundamentally different principles.
export const E91_VS_BB84: CompareRow[] = [
	{
		aspect: 'Year & author',
		bb84: 'Bennett & Brassard, 1984',
		e91: 'Artur Ekert, 1991',
	},
	{
		aspect: 'Mechanism',
		bb84: 'Prepare-and-measure: Alice sends single photons, Bob measures in a random basis.',
		e91: 'Entanglement-based: a source distributes singlet pairs, both parties measure.',
	},
	{
		aspect: 'Security argument',
		bb84:
			'No-cloning theorem + measurement disturbance (Heisenberg). Eve cannot copy an unknown qubit and must guess a basis.',
		e91:
			"Violation of Bell's inequality. Entangled correlations exceed any classical (local hidden-variable) theory; an eavesdropper breaks them.",
	},
	{
		aspect: 'Eavesdropper signal',
		bb84: 'Elevated QBER (quantum bit-error rate) on sifted bits.',
		e91:
			"Drop in the CHSH parameter |S| below the quantum value 2√2 toward the classical bound 2.",
	},
	{
		aspect: 'Trusted source?',
		bb84: "Trusts Alice's preparation device.",
		e91: 'The Bell test itself certifies the source — the seed of device-independent QKD.',
	},
	{
		aspect: 'Sibling demo',
		bb84: 'crypto-lab-bb84 (live in the suite).',
		e91: 'This demo.',
	},
];

// --- Bell concepts: cards rendered in "The Bell test explained" -----------
export const BELL_CONCEPTS: ConceptCard[] = [
	{
		title: 'Entanglement and the singlet state',
		body:
			"A polarization-entangled photon pair in the singlet state |Ψ⁻⟩ = (|HV⟩ − |VH⟩)/√2 has no definite polarization for either photon — only the relationship is defined. Measure one in any basis and the other instantly correlates: at aligned analyzers the outcomes are perfectly anti-correlated.",
	},
	{
		title: 'Local hidden variables and |S| ≤ 2',
		body:
			'A "local hidden-variable" theory says each photon already carries the answers to all measurements before it is measured, and no signal travels faster than light. Bell (1964) and CHSH (1969) showed that for any such theory the combination S = E(a₁,b₁) + E(a₁,b₂) + E(a₂,b₁) − E(a₂,b₂) must satisfy |S| ≤ 2.',
	},
	{
		title: "Tsirelson's bound: 2√2 ≈ 2.828",
		body:
			"Quantum mechanics breaks the inequality. For the singlet at the right angles the correlation is E(a,b) = −cos(2(a−b)) and |S| reaches 2√2 — Tsirelson's bound. This is the maximum any quantum theory can achieve; observing it is evidence that the world is not locally classical.",
	},
	{
		title: 'Why these angles?',
		body:
			'Alice picks from {0°, 45°} and Bob from {22.5°, −22.5°} because plugging those into E(a,b) = −cos(2(a−b)) gives four values of ±1/√2 that combine into |S| = 2√2. Any rotation of all four settings together gives the same |S|; the specific choice is conventional but the differences are not.',
	},
	{
		title: 'How eavesdropping breaks the test',
		body:
			"An intercept-resend Eve measures each photon before Alice and Bob do. That measurement collapses the entanglement and replaces it with a classical mixture of product states. Downstream correlations now obey |S| ≤ 2, and the CHSH value falls toward the classical bound — Eve's presence shows up as a missing 2√2.",
	},
	{
		title: 'Noise and misalignment look similar',
		body:
			'In a real experiment, a missing 2√2 is not by itself proof of an eavesdropper — depolarizing noise or analyzer misalignment also lowers |S|. The lesson is that a Bell test answers a precise statistical question, not a binary one. Scenarios in the next section make this concrete.',
	},
];

// --- The protocol, step by step -------------------------------------------
export const PROTOCOL_STEPS: ProtocolStep[] = [
	{
		step: 1,
		title: 'Source emits entangled pairs',
		detail:
			"A central source (Alice's lab, Bob's lab, or a satellite) emits polarization-entangled photon pairs in the singlet state and sends one photon of each pair to Alice and one to Bob.",
	},
	{
		step: 2,
		title: 'Independent random measurements',
		detail:
			"For every pair, Alice independently chooses an analyzer angle from her set and Bob independently chooses from his. Each records a +1 or −1 outcome. Neither side controls the other's setting.",
	},
	{
		step: 3,
		title: 'Public basis announcement',
		detail:
			'After the run, Alice and Bob publicly announce which angle they picked for each round (but not the outcome). They sort the rounds into two piles: aligned-basis rounds (same angle on both sides) and CHSH-test rounds (the four combinations of two-and-two settings).',
	},
	{
		step: 4,
		title: 'Bell test on the CHSH-pile',
		detail:
			'They compute the four correlations E(aᵢ,bⱼ) on the CHSH rounds and combine them into S. If the 95% confidence interval for |S| sits clearly above 2, the entanglement survived the channel. If it sits clearly below 2, the channel was tampered with (or is too noisy/misaligned to use).',
	},
	{
		step: 5,
		title: 'Key from the aligned-basis pile',
		detail:
			'On the aligned-basis rounds the singlet gives perfectly anti-correlated outcomes, so Alice records her bit and Bob flips his. The result is a shared random bit string. The key is only kept if the Bell test in step 4 passed — otherwise it is discarded.',
	},
];

// --- Real-world context ----------------------------------------------------
export const REAL_WORLD: RealWorldNote[] = [
	{
		year: '1964',
		title: "Bell's theorem",
		body:
			'John Bell shows mathematically that any local hidden-variable theory must obey an inequality (later refined as CHSH, 1969) that quantum mechanics violates. The disagreement is testable in principle.',
	},
	{
		year: '1982',
		title: 'Aspect experiments',
		body:
			"Alain Aspect and collaborators perform the first convincing Bell tests with entangled photons, observing violations consistent with quantum mechanics. The result is statistically clean but leaves \"loopholes\" (locality, detection).",
	},
	{
		year: '1991',
		title: "Ekert's E91 proposal",
		body:
			'Artur Ekert proposes using Bell-inequality violation directly as the security check for key distribution: the protocol simulated here. Eavesdropping is detected by a measured value of |S| that has fallen below the quantum prediction.',
	},
	{
		year: '2015',
		title: 'Loophole-free Bell tests',
		body:
			'Three independent teams (Hensen et al. with NV centres in Delft; the NIST and Vienna photon experiments) close the locality and detection loopholes simultaneously, ruling out local hidden-variable theories with high confidence.',
	},
	{
		year: '2017',
		title: 'Micius satellite QKD',
		body:
			'Yin et al. perform entanglement-based QKD between ground stations more than 1,200 km apart using the Micius satellite. The same principle this demo simulates — but with real photons, real losses, and a real Bell test.',
	},
	{
		year: '2022',
		title: 'Device-independent QKD',
		body:
			"Two groups (Nadlinger et al.; Zhang et al.) demonstrate the first full device-independent QKD: the Bell-test outcome itself certifies the devices, so Alice and Bob need not trust the source or the analyzers. The lineage from Ekert 1991 is direct.",
	},
];

// --- Scenarios ------------------------------------------------------------
// One copy block per scenario, used by the chip strip and the active-scenario
// description card.
export const SCENARIO_COPY: Record<ScenarioId, ScenarioCopy> = {
	ideal: {
		id: 'ideal',
		emoji: '✨',
		intro: 'Pristine entangled channel',
		story:
			'The source emits a perfect singlet pair, the channel adds no noise, both analyzers are aligned and lossless. This is the textbook reference case.',
		expectation: 'Expected |S| ≈ 2√2 ≈ 2.828; key agreement = 100%. Verdict: secure.',
	},
	eve: {
		id: 'eve',
		emoji: '🎧',
		intro: 'Intercept-resend eavesdropper',
		story:
			'Eve sits in the middle of the channel and measures each photon in a fixed basis (π/8) before resending product states. Her measurement collapses the entanglement.',
		expectation:
			'Expected |S| ≈ √2 ≈ 1.414 — below the classical bound of 2; key agreement drops to ≈ 75%. Verdict: compromised.',
	},
	noisy: {
		id: 'noisy',
		emoji: '🌫️',
		intro: 'Noisy channel (depolarizing)',
		story:
			'A depolarizing channel: with probability p the entangled pair is replaced by independent uniform outcomes; with probability 1−p it arrives intact. No eavesdropper — just an imperfect channel.',
		expectation:
			'Expected |S| = (1−p)·2√2. Above ≈0.293 the violation is lost: noise alone can look like an eavesdropper. Verdict depends on p and rounds.',
		knob: {
			label: 'Depolarizing probability p',
			field: 'noiseP',
			min: 0,
			max: 0.5,
			step: 0.01,
			unit: '',
			toDisplay: (v) => v.toFixed(2),
			fromDisplay: (v) => v,
		},
	},
	misaligned: {
		id: 'misaligned',
		emoji: '📐',
		intro: 'Misaligned analyzer',
		story:
			"Bob's analyzer is rotated by a fixed offset δ relative to the design. The entanglement is intact; the angles just no longer maximize the violation.",
		expectation:
			'Expected |S| = 2√2 · cos(2δ). At δ = 22.5° the violation drops exactly to 2; beyond that it falls into the classical region — calibration error looking like an attack.',
		knob: {
			label: "Bob's analyzer offset δ",
			field: 'misalignRad',
			min: 0,
			max: (30 * Math.PI) / 180,
			step: (1 * Math.PI) / 180,
			unit: '°',
			toDisplay: (v) => `${Math.round((v * 180) / Math.PI)}°`,
			fromDisplay: (v) => (v * Math.PI) / 180,
		},
	},
	lossy: {
		id: 'lossy',
		emoji: '💨',
		intro: 'Lossy channel (photon loss)',
		story:
			'Each photon arrives independently with probability η. Only coincidences (both photons detected) contribute, at rate η². The underlying entanglement is intact when both arrive.',
		expectation:
			'Expected |S| ≈ 2√2 — but with fewer samples, so the 95% confidence interval is wider. Demonstrates how sample size, not just |S|, drives the verdict.',
		knob: {
			label: 'Detection efficiency η',
			field: 'lossEta',
			min: 0.2,
			max: 1,
			step: 0.05,
			unit: '',
			toDisplay: (v) => v.toFixed(2),
			fromDisplay: (v) => v,
		},
	},
};

export const SCENARIO_ORDER: ScenarioId[] = ['ideal', 'eve', 'noisy', 'misaligned', 'lossy'];

// --- References / further reading ----------------------------------------
export const REFERENCES: Reference[] = [
	{
		tag: 'Bell 1964',
		authors: 'J. S. Bell',
		title: 'On the Einstein Podolsky Rosen paradox',
		venue: 'Physics 1, 195–200',
		year: '1964',
	},
	{
		tag: 'CHSH 1969',
		authors: 'J. F. Clauser, M. A. Horne, A. Shimony, R. A. Holt',
		title: 'Proposed experiment to test local hidden-variable theories',
		venue: 'Physical Review Letters 23, 880',
		year: '1969',
		url: 'https://doi.org/10.1103/PhysRevLett.23.880',
	},
	{
		tag: 'Tsirelson 1980',
		authors: "B. S. Cirel'son",
		title: "Quantum generalizations of Bell's inequality",
		venue: 'Letters in Mathematical Physics 4, 93–100',
		year: '1980',
		url: 'https://doi.org/10.1007/BF00417500',
	},
	{
		tag: 'Aspect 1982',
		authors: 'A. Aspect, J. Dalibard, G. Roger',
		title: "Experimental test of Bell's inequalities using time-varying analyzers",
		venue: 'Physical Review Letters 49, 1804',
		year: '1982',
		url: 'https://doi.org/10.1103/PhysRevLett.49.1804',
	},
	{
		tag: 'Ekert 1991',
		authors: 'A. K. Ekert',
		title: "Quantum cryptography based on Bell's theorem",
		venue: 'Physical Review Letters 67, 661–663',
		year: '1991',
		url: 'https://doi.org/10.1103/PhysRevLett.67.661',
	},
	{
		tag: 'Hensen 2015',
		authors: 'B. Hensen et al.',
		title: 'Loophole-free Bell inequality violation using electron spins separated by 1.3 km',
		venue: 'Nature 526, 682–686',
		year: '2015',
		url: 'https://doi.org/10.1038/nature15759',
	},
	{
		tag: 'Yin 2017',
		authors: 'J. Yin et al.',
		title: 'Satellite-based entanglement distribution over 1200 kilometres',
		venue: 'Science 356, 1140–1144',
		year: '2017',
		url: 'https://doi.org/10.1126/science.aan3211',
	},
	{
		tag: 'Nadlinger 2022',
		authors: 'D. P. Nadlinger et al.',
		title: "Experimental quantum key distribution certified by Bell's theorem",
		venue: 'Nature 607, 682–686',
		year: '2022',
		url: 'https://doi.org/10.1038/s41586-022-04941-5',
	},
	{
		tag: 'Zhang 2022',
		authors: 'W. Zhang et al.',
		title: 'A device-independent quantum key distribution system for distant users',
		venue: 'Nature 607, 687–691',
		year: '2022',
		url: 'https://doi.org/10.1038/s41586-022-04891-y',
	},
];

export const FURTHER_READING: { label: string; url: string; note: string }[] = [
	{
		label: 'Nielsen & Chuang, Quantum Computation and Quantum Information',
		url: 'https://www.cambridge.org/9781107002173',
		note: 'Standard reference — Chapters 2 and 12 cover the CHSH inequality and QKD.',
	},
	{
		label: 'Renner, Security of QKD (2005 PhD thesis)',
		url: 'https://arxiv.org/abs/quant-ph/0512258',
		note: 'Information-theoretic security proofs for QKD beyond the textbook idealization.',
	},
	{
		label: 'Acín et al., Device-independent security of QKD against collective attacks',
		url: 'https://arxiv.org/abs/quant-ph/0702152',
		note: 'The theoretical lineage from E91 to modern device-independent QKD.',
	},
];
