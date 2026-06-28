# crypto-lab-e91

## What It Is

An interactive simulation of **E91 (Ekert 1991)**, the entanglement-based quantum key distribution protocol. A source emits polarization-entangled photon pairs in the singlet state; Alice and Bob each measure their half at independently chosen analyzer angles; the joint statistics are checked against the **CHSH form of Bell's inequality**. Quantum mechanics allows |S| to reach the **Tsirelson bound 2√2 ≈ 2.828**, while any classical (local hidden-variable) theory is stuck at |S| ≤ 2. An intercept-resend eavesdropper destroys the entanglement and collapses S back into the classical regime — that is the eavesdropper alarm.

The protocol is the cousin of BB84 in the sibling [`crypto-lab-bb84`](https://systemslibrarian.github.io/crypto-lab-bb84/) demo, but it leans on a fundamentally different security argument: **Bell-inequality violation, not no-cloning**. The engine is implemented from scratch in TypeScript using the standard textbook quantum-mechanical predictions for the singlet state, plus three additional channel models (depolarizing noise, analyzer misalignment, photon loss) so the demo can show **that a missing 2√2 is not by itself proof of an eavesdropper** — noise and calibration error can produce the same signature.

This is an **idealized educational simulation**, not a model of real photon-counting hardware. There is no detector dark-count model, no finite-key correction, no decoy-state analysis, no side-channel attacks. The math you see is the standard textbook math, decorated with sample-size-aware statistics (per-correlation standard errors and a 95% CI on |S|) so the security verdict depends on the data rather than a hard-coded threshold.

## When to Use It

- **Teaching how entanglement detects eavesdroppers** — the singlet's correlation exceeds anything a classical theory can produce, and Eve's measurement drags it back to classical.
- **Showing why E91 ≠ BB84** — same problem, different physics. BB84's alarm is QBER from Heisenberg disturbance; E91's alarm is a missing 2√2 from broken entanglement.
- **Introducing CHSH, Tsirelson's bound, and Bell-test statistics** — including the lesson that the answer is a confidence interval, not a single number.
- **Distinguishing attack from ordinary degradation** — the noisy, misaligned, and lossy scenarios produce reduced |S| for benign reasons; the demo makes this explicit instead of pretending |S| < 2 always means "Eve."
- **Setting up device-independent QKD intuition** — DI-QKD descends directly from E91; the same Bell-test-as-security-certificate idea drives loophole-free Bell experiments and entanglement-based satellite QKD.
- **Do NOT** use this as a model of a real quantum channel. It is faithful to the textbook idealization, not to lab hardware.
- **Do NOT** confuse QKD with post-quantum cryptography. QKD addresses *key distribution* over a quantum channel; it does not replace the larger PQC migration story (see the rest of the suite for that).

## Live Demo

**[systemslibrarian.github.io/crypto-lab-e91](https://systemslibrarian.github.io/crypto-lab-e91/)**

Inside the page:

- **Scenario chip strip** — five channel models you can flip between: ideal, intercept-resend Eve, depolarizing noise, misaligned analyzer, lossy channel. Each scenario has a one-line story and an expectation for |S| and key agreement; the parameterised ones (noise level, misalignment angle, detection efficiency) expose a slider.
- **Statistical verdict panel** — secure / compromised / inconclusive, with the 95% CI for |S| spelled out.
- **CHSH gauge with confidence band** — visual marker for the measured |S|, dashed CI box, and labelled ticks at the classical bound (2) and Tsirelson's bound (2√2).
- **Expected vs measured correlation table** — the four E(aᵢ,bⱼ) with their theoretical value, measured value, 95% CI, standard error, and sample size. A `!` badge appears on rows more than 3σ from expected.
- **Sifted key panel** — Alice / Bob bit strings, per-bit agreement coloring, measured vs expected agreement percentage.
- **Round-by-round transcript (optional)** — first 50 rounds with bucket (CHSH / key), analyzer indices, angles in degrees, ±1 outcomes, and the product A·B.
- **The Bell test explained** — concept cards, the singlet correlation curve E(Δ) = −cos(2Δ) with CHSH points marked, and the five-step protocol flow.
- **E91 vs BB84** — six-row comparison table linking the sibling demo.
- **In the real world** — Bell (1964), Aspect (1982), Ekert (1991), loophole-free Bell (2015), Micius (2017), device-independent QKD (2022).
- **Sources & further reading** — primary references with DOIs, plus a "what this simulation does and does not model" caveat box.

**Shareable runs**: the rounds, scenario, scenario knob value, seed, and transcript flag are mirrored to the URL hash. The "Copy link to this run" button gives you a deterministic URL that reproduces the exact run; "Copy results (CSV)" exports the summary and transcript to clipboard.

## What Can Go Wrong

- **A missing 2√2 is ambiguous.** A measured |S| below the classical bound can be caused by an eavesdropper *or* by ordinary noise, misalignment, or loss; from |S| alone you cannot tell which, so a degraded key is discarded either way.
- **Finite-key effects.** Real E91 needs finite-key security corrections and enough rounds for the CI to tighten; a small sample can leave the verdict inconclusive or misleading (this demo models the statistics but not full finite-key proofs).
- **Detector side-channels (real hardware).** Physical implementations face detector-blinding, timing, and efficiency-loophole attacks that an idealized simulation does not capture.
- **Unauthenticated classical channel.** The public discussion/sifting channel must be authenticated; without it, a man-in-the-middle can defeat QKD regardless of the Bell test.
- **The detection-efficiency (loss) loophole.** Low detection efficiency can let a local hidden-variable model fake a Bell violation, so loss must be accounted for in any real security claim.

## Real-World Usage

- **Device-independent QKD.** E91 is the conceptual ancestor of DI-QKD, where security is certified by an observed Bell-inequality violation rather than trust in the devices.
- **Entanglement-based QKD experiments.** Laboratory and field demonstrations distribute entangled photon pairs and verify CHSH violation as the security test.
- **Satellite QKD.** The Micius satellite distributed entangled photons over ~1200 km, demonstrating entanglement-based key distribution at intercontinental scale.
- **Loophole-free Bell tests.** Experiments such as Hensen et al. (2015) closed the detection and locality loopholes, underpinning the security argument E91 relies on.
- **Bell-test-certified randomness.** The same Bell-violation certificate used in E91 is used to certify randomness in device-independent randomness expansion.

## How to Run Locally

```bash
git clone https://github.com/systemslibrarian/crypto-lab-e91
cd crypto-lab-e91
npm install
npm run dev
```

## Related Demos

- [crypto-lab-bb84](https://systemslibrarian.github.io/crypto-lab-bb84/) — the sibling QKD protocol whose alarm is QBER from no-cloning, not a Bell violation.
- [crypto-lab-shor](https://systemslibrarian.github.io/crypto-lab-shor/) — Shor's algorithm, the quantum attack that motivates quantum-safe key distribution.
- [crypto-lab-grover](https://systemslibrarian.github.io/crypto-lab-grover/) — Grover's algorithm and quantum search against symmetric keys.
- [crypto-lab-pq-families](https://systemslibrarian.github.io/crypto-lab-pq-families/) — the five post-quantum families, the computational alternative to QKD.

## Statistical interpretation of S

The CHSH parameter `S = E(a₁,b₁) + E(a₁,b₂) + E(a₂,b₁) − E(a₂,b₂)` is computed from four sample means, each over its own subset of rounds. Each `E(aᵢ,bⱼ)` has standard error `SE = √((1 − E²)/n)`; the four are independent, so `Var(S)` is the sum of variances, and `SE(S) = √Σ SE(Eᵢⱼ)²`. The 95% confidence interval is `|S| ± 1.96·SE(S)`.

The simulator's verdict is **based on where the |S| CI falls relative to the classical bound of 2**, not on a fixed threshold:

- `secure` — the entire 95% CI for |S| is above 2; the result is statistically inconsistent with any local hidden-variable model.
- `compromised` — the entire 95% CI is below 2; the Bell violation has been lost. (Could be Eve; could be sufficiently strong noise or misalignment. From |S| alone you cannot tell which, so the key is discarded either way.)
- `inconclusive` — the CI straddles 2. Run more rounds.

This is why the demo exposes a "rounds" knob and a "lossy channel" scenario: you can watch a borderline case sit in the inconclusive region until enough data tightens the CI.

## Testing

`scripts/engine.test.mjs` is the source of truth. It covers:

- The singlet correlation function returns textbook values.
- The theoretical S for each scenario matches the textbook closed form (`2√2`, `√2` under intercept-resend at π/8, `(1−p)·2√2` under depolarizing noise, `2√2·cos(2δ)` under misalignment, and unchanged under loss).
- The theoretical key agreement at aligned bases matches its closed form per scenario.
- `runE91` converges to the predicted |S| within 0.05 for 30k seeded rounds across all five scenarios.
- The confidence-aware verdict classifies seeded runs as `secure` / `compromised` correctly, and the legacy `eve: true / false` flag still selects the right scenario.
- The transcript respects its cap, labels CHSH vs key buckets, and records consistent product = A·B.
- Per-correlation standard errors and the S CI are populated and bracket the measured value.
- `effectiveRounds` for the lossy channel matches `rounds · η²` to within sampling noise.
- `resolveScenario` accepts both ID strings and partial-override objects.

CI (`.github/workflows/ci.yml`) runs `npm run build && npm test` on every push and PR. The deploy workflow (`.github/workflows/deploy.yml`) ships `dist/` to GitHub Pages on push to `main`.

## Sources

Primary references are also listed on the live page with DOIs. The most load-bearing:

- J. S. Bell. *On the Einstein Podolsky Rosen paradox.* Physics 1, 195 (1964).
- J. F. Clauser, M. A. Horne, A. Shimony, R. A. Holt. *Proposed experiment to test local hidden-variable theories.* PRL 23, 880 (1969).
- B. S. Cirel'son. *Quantum generalizations of Bell's inequality.* Lett. Math. Phys. 4, 93 (1980).
- A. K. Ekert. *Quantum cryptography based on Bell's theorem.* PRL 67, 661 (1991).
- B. Hensen et al. *Loophole-free Bell inequality violation.* Nature 526, 682 (2015).
- J. Yin et al. *Satellite-based entanglement distribution over 1200 km.* Science 356, 1140 (2017).
- D. P. Nadlinger et al. *Experimental QKD certified by Bell's theorem.* Nature 607, 682 (2022).
- W. Zhang et al. *A device-independent QKD system for distant users.* Nature 607, 687 (2022).

Standard textbook treatment: Nielsen & Chuang, *Quantum Computation and Quantum Information* (Cambridge), Chapters 2 and 12. For QKD security proofs beyond the idealization, see Renner's 2005 thesis [`arxiv.org/abs/quant-ph/0512258`](https://arxiv.org/abs/quant-ph/0512258).

---

*One of 120+ browser demos in the [Crypto Lab](https://crypto-lab.systemslibrarian.dev/) suite.*

*"So whether you eat or drink or whatever you do, do it all for the glory of God." — 1 Corinthians 10:31*
