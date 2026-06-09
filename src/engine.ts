// engine.ts — Ekert 1991 (E91) entanglement-based quantum key distribution.
// Security rests on QUANTUM ENTANGLEMENT and the violation of Bell's inequality,
// NOT on the no-cloning/measurement-disturbance argument of BB84.
//
// Physics modeled faithfully (in the standard idealized form):
//   * a source emits polarization-entangled photon pairs in the singlet state
//   * Alice and Bob each independently pick a measurement angle each round
//   * the quantum correlation for the singlet is  E(a,b) = -cos(2(a-b))
//     (angles in radians; the factor 2 is the photon-polarization convention)
//   * outcomes are +1/-1, sampled from the correct joint quantum probabilities
//   * the CHSH parameter S is computed from four angle combinations:
//       S = E(a1,b1) - E(a1,b2) + E(a2,b1) + E(a2,b2)
//     |S| <= 2 for any local hidden-variable (classical) theory;
//     quantum mechanics reaches S = 2*sqrt(2) ~= 2.828 (Tsirelson's bound).
//   * the secret key comes from rounds where Alice and Bob used ALIGNED bases
//     (perfectly anti-correlated for the singlet -> shared bits).
//   * an intercept-resend eavesdropper destroys entanglement and pushes S
//     back toward the classical limit -> detected by a too-low S.

export type Outcome = -1 | 1;

// --- angle settings -------------------------------------------------------
// Alice's analyzer angles and Bob's, chosen to maximize the CHSH violation.
// Standard E91 choice (in radians): Alice {0, pi/4}, Bob {pi/8, -pi/8}.
// We expose them so the UI can show why these specific angles are used.
export const ALICE_ANGLES = [0, Math.PI / 4]; // a1, a2
export const BOB_ANGLES = [Math.PI / 8, -Math.PI / 8]; // b1, b2
// A shared "key basis": one Alice angle and one Bob angle that are EQUAL, so
// outcomes are perfectly anti-correlated and yield key bits. We add a matching
// pair at angle pi/4 for both.
export const KEY_ANGLE = Math.PI / 4;

// quantum correlation for the singlet state at analyzer angles a, b
export function correlation(a: number, b: number): number {
    return -Math.cos(2 * (a - b));
}

// Sample a single entangled-pair measurement. Given the joint distribution for
// the singlet at angles (a,b): P(same) and P(diff) follow from E(a,b).
// For the singlet, P(equal outcomes) = (1 - E)/2... but E is the correlation
// of the +1/-1 products, so <AB> = E. We sample A uniformly +-1, then choose B
// so that the product equals +1 with prob (1+E)/2.
function samplePair(a: number, b: number, rng: () => number): { A: Outcome; B: Outcome } {
    const E = correlation(a, b);
    const A: Outcome = rng() < 0.5 ? 1 : -1;
    const productPositive = rng() < (1 + E) / 2; // P(A*B = +1) = (1+E)/2
    const B: Outcome = (productPositive ? A : -A) as Outcome;
    return { A, B };
}

// --- eavesdropper ----------------------------------------------------------
// Intercept-resend: Eve measures each photon in a fixed basis (angle eveAngle),
// collapsing it, then resends a definite-polarization photon. This destroys the
// entanglement: downstream correlations become a classical mixture and S drops.
function samplePairWithEve(
    a: number,
    b: number,
    eveAngle: number,
    rng: () => number,
): { A: Outcome; B: Outcome } {
    // Eve measures both photons in her basis, getting definite results e1,e2 that
    // are themselves anti-correlated (she intercepts the entangled pair). She then
    // resends product states. Alice's result is her photon measured at angle a
    // given it was prepared at eveAngle with value e; outcome follows Malus-law
    // probability cos^2(delta). We model Eve collapsing to a shared hidden value.
    const eVal: Outcome = rng() < 0.5 ? 1 : -1; // Eve's collapse on Alice-side photon
    const eValB: Outcome = -eVal as Outcome; // singlet: Bob-side opposite at her basis

    const measure = (prepared: Outcome, prepAngle: number, analyzeAngle: number): Outcome => {
        // probability of getting +1 aligned with 'prepared' = cos^2(analyze - prep)
        const pAlignedPlus = Math.cos(analyzeAngle - prepAngle) ** 2;
        const pOutcomePrepared = prepared === 1 ? pAlignedPlus : 1 - pAlignedPlus;
        return (rng() < pOutcomePrepared ? 1 : -1) as Outcome;
    };
    const A = measure(eVal, eveAngle, a);
    const B = measure(eValB, eveAngle, b);
    return { A, B };
}

// --- a full E91 run --------------------------------------------------------
export interface RoundData {
    aliceAngleIdx: number; // 0,1 for CHSH settings, 2 for key-basis
    bobAngleIdx: number;
    A: Outcome;
    B: Outcome;
}

export interface E91Result {
    S: number; // measured CHSH parameter
    classicalBound: number; // 2
    tsirelsonBound: number; // 2*sqrt(2)
    eavesdropperDetected: boolean;
    keyBitsAlice: number[]; // sifted key (key-basis rounds)
    keyBitsBob: number[];
    keyAgreement: number; // fraction of matching key bits (1.0 ideal, no Eve)
    rounds: number;
    correlations: { label: string; value: number; n: number }[];
}

function seededRng(seed: number): () => number {
    let s = seed >>> 0;
    return () => {
        s = (s * 1664525 + 1013904223) >>> 0;
        return s / 0xffffffff;
    };
}

export function runE91(opts: { rounds: number; eve: boolean; seed?: number }): E91Result {
    const rng = opts.seed !== undefined ? seededRng(opts.seed) : Math.random;
    const eveAngle = Math.PI / 8; // Eve's fixed intercept basis

    // accumulate sums for the four CHSH correlations E(ai,bj)
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

    for (let r = 0; r < opts.rounds; r++) {
        // ~half the rounds used for the CHSH test, ~half for key (key-basis aligned)
        const useForKey = rng() < 0.5;
        if (useForKey) {
            const pair = opts.eve
                ? samplePairWithEve(KEY_ANGLE, KEY_ANGLE, eveAngle, rng)
                : samplePair(KEY_ANGLE, KEY_ANGLE, rng);
            // singlet at aligned bases -> anti-correlated; key bit = (A==1?1:0),
            // Bob flips his to agree (standard E91 sifting).
            keyAlice.push(pair.A === 1 ? 1 : 0);
            keyBob.push(pair.B === -1 ? 1 : 0); // anti-correlated -> flip
        } else {
            const ai = rng() < 0.5 ? 0 : 1;
            const bj = rng() < 0.5 ? 0 : 1;
            const a = ALICE_ANGLES[ai];
            const b = BOB_ANGLES[bj];
            const pair = opts.eve ? samplePairWithEve(a, b, eveAngle, rng) : samplePair(a, b, rng);
            sums[ai][bj] += pair.A * pair.B;
            counts[ai][bj] += 1;
        }
    }

    const E = (i: number, j: number) => (counts[i][j] ? sums[i][j] / counts[i][j] : 0);
    // CHSH for the singlet at these angles: S = E(a1,b1)+E(a1,b2)+E(a2,b1)-E(a2,b2).
    // (Sign pattern chosen so the quantum value reaches Tsirelson's bound 2*sqrt(2).)
    const S = E(0, 0) + E(0, 1) + E(1, 0) - E(1, 1);

    let matches = 0;
    for (let i = 0; i < keyAlice.length; i++) if (keyAlice[i] === keyBob[i]) matches++;
    const keyAgreement = keyAlice.length ? matches / keyAlice.length : 0;

    const tsirelson = 2 * Math.sqrt(2);
    // detection rule: secure runs show |S| comfortably above the classical bound.
    // We flag eavesdropping if |S| has collapsed toward/below 2 (with margin).
    const eavesdropperDetected = Math.abs(S) < 2.3;

    return {
        S,
        classicalBound: 2,
        tsirelsonBound: tsirelson,
        eavesdropperDetected,
        keyBitsAlice: keyAlice,
        keyBitsBob: keyBob,
        keyAgreement,
        rounds: opts.rounds,
        correlations: [
            { label: 'E(a1,b1)', value: E(0, 0), n: counts[0][0] },
            { label: 'E(a1,b2)', value: E(0, 1), n: counts[0][1] },
            { label: 'E(a2,b1)', value: E(1, 0), n: counts[1][0] },
            { label: 'E(a2,b2)', value: E(1, 1), n: counts[1][1] },
        ],
    };
}

export function radToDeg(r: number): number {
    return Math.round((r * 180) / Math.PI);
}
