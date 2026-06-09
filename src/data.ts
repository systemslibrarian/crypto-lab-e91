// data.ts — copy/content for the E91 demo. No physics here; the engine owns
// the math. Everything below is rendered by ui.ts.

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
		bb84: 'No-cloning theorem + measurement disturbance (Heisenberg). Eve cannot copy an unknown qubit and must guess a basis.',
		e91: 'Violation of Bell\'s inequality. Entangled correlations exceed any classical (local hidden-variable) theory; an eavesdropper breaks them.',
	},
	{
		aspect: 'Eavesdropper signal',
		bb84: 'Elevated QBER (quantum bit-error rate) on sifted bits.',
		e91: 'Drop in the CHSH parameter |S| below the quantum value 2√2 toward the classical bound 2.',
	},
	{
		aspect: 'Trusted source?',
		bb84: 'Trusts Alice\'s preparation device.',
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
		body: 'A polarization-entangled photon pair in the singlet state |Ψ⁻⟩ = (|HV⟩ − |VH⟩)/√2 has no definite polarization for either photon — only the relationship is defined. Measure one in any basis and the other instantly correlates: at aligned analyzers the outcomes are perfectly anti-correlated.',
	},
	{
		title: 'Local hidden variables and |S| ≤ 2',
		body: 'A "local hidden-variable" theory says each photon already carries the answers to all measurements before it is measured, and no signal travels faster than light. Bell (1964) and CHSH (1969) showed that for any such theory the combination S = E(a₁,b₁) + E(a₁,b₂) + E(a₂,b₁) − E(a₂,b₂) must satisfy |S| ≤ 2.',
	},
	{
		title: 'Tsirelson\'s bound: 2√2 ≈ 2.828',
		body: 'Quantum mechanics breaks the inequality. For the singlet at the right angles the correlation is E(a,b) = −cos(2(a−b)) and S reaches 2√2 — Tsirelson\'s bound. This is the maximum any quantum theory can achieve; observing it is direct evidence that the world is not locally classical.',
	},
	{
		title: 'Why these angles?',
		body: 'Alice picks from {0°, 45°} and Bob from {22.5°, −22.5°} because plugging those into E(a,b) = −cos(2(a−b)) gives four values of ±1/√2 that combine into S = 2√2. Any rotation of all four settings together gives the same |S|; the specific choice is conventional but the differences are not.',
	},
	{
		title: 'How eavesdropping breaks the test',
		body: 'An intercept-resend Eve measures each photon before Alice and Bob do. That measurement collapses the entanglement and replaces it with a classical mixture of product states. Downstream correlations now obey |S| ≤ 2, and the CHSH value falls toward the classical bound — Eve\'s presence shows up as a missing 2√2.',
	},
];

// --- The protocol, step by step -------------------------------------------
export const PROTOCOL_STEPS: ProtocolStep[] = [
	{
		step: 1,
		title: 'Source emits entangled pairs',
		detail: 'A central source (Alice\'s lab, Bob\'s lab, or a satellite) emits polarization-entangled photon pairs in the singlet state and sends one photon of each pair to Alice and one to Bob.',
	},
	{
		step: 2,
		title: 'Independent random measurements',
		detail: 'For every pair, Alice independently chooses an analyzer angle from her set and Bob independently chooses from his. Each records a +1 or −1 outcome. Neither side controls the other\'s setting.',
	},
	{
		step: 3,
		title: 'Public basis announcement',
		detail: 'After the run, Alice and Bob publicly announce which angle they picked for each round (but not the outcome). They sort the rounds into two piles: aligned-basis rounds (same angle on both sides) and CHSH-test rounds (the four combinations of two-and-two settings).',
	},
	{
		step: 4,
		title: 'Bell test on the CHSH-pile',
		detail: 'They compute the four correlations E(aᵢ,bⱼ) on the CHSH rounds and combine them into S. If |S| sits near 2√2, the entanglement survived the channel — no one was listening. If |S| has collapsed toward 2, the channel was tampered with.',
	},
	{
		step: 5,
		title: 'Key from the aligned-basis pile',
		detail: 'On the aligned-basis rounds the singlet gives perfectly anti-correlated outcomes, so Alice records her bit and Bob flips his. The result is a shared random bit string that no eavesdropper can have learned without showing up in step 4.',
	},
];

// --- Real-world context ----------------------------------------------------
// Educational notes only. Every entry references public facts; no invented
// stats or vendor claims.
export const REAL_WORLD: RealWorldNote[] = [
	{
		year: '1964',
		title: 'Bell\'s theorem',
		body: 'John Bell shows mathematically that any local hidden-variable theory must obey an inequality (later refined as CHSH, 1969) that quantum mechanics violates. The disagreement is testable in principle.',
	},
	{
		year: '1982',
		title: 'Aspect experiments',
		body: 'Alain Aspect and collaborators perform the first convincing Bell tests with entangled photons, observing violations consistent with quantum mechanics. The result is statistically clean but leaves "loopholes" (locality, detection).',
	},
	{
		year: '1991',
		title: 'Ekert\'s E91 proposal',
		body: 'Artur Ekert proposes using Bell-inequality violation directly as the security check for key distribution: the protocol simulated here. Eavesdropping is detected by a measured value of S that has fallen below the quantum prediction.',
	},
	{
		year: '2015',
		title: 'Loophole-free Bell tests',
		body: 'Three independent teams (Hensen et al. with NV centres in Delft; the NIST and Vienna photon experiments) close the locality and detection loopholes simultaneously, ruling out local hidden-variable theories with high confidence.',
	},
	{
		year: '2017',
		title: 'Micius satellite QKD',
		body: 'A Chinese-led group performs entanglement-based QKD between ground stations more than 1,000 km apart using the Micius satellite. The same principle this demo simulates — but with real photons, real losses, and a real Bell test.',
	},
	{
		year: '2010s–today',
		title: 'Device-independent QKD',
		body: 'A family of protocols descended from E91 in which the Bell-inequality violation itself certifies the devices — Alice and Bob need not trust the source or the analyzers, only the measured statistics. Active research area; first full demonstrations appeared in 2022.',
	},
];
