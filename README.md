# crypto-lab-e91

## What It Is

An interactive simulation of **E91 (Ekert 1991)**, the entanglement-based quantum key distribution protocol. A source emits polarization-entangled photon pairs in the singlet state; Alice and Bob each measure their half at independently chosen analyzer angles; the joint statistics are checked against the **CHSH form of Bell's inequality**. Quantum mechanics allows |S| to reach the **Tsirelson bound 2√2 ≈ 2.828**, while any classical (local hidden-variable) theory is stuck at |S| ≤ 2. An intercept-resend eavesdropper destroys the entanglement and collapses S back into the classical regime — that is the eavesdropper alarm. The protocol is the cousin of BB84 in the sibling [`crypto-lab-bb84`](https://systemslibrarian.github.io/crypto-lab-bb84/) demo, but it leans on a fundamentally different security argument: **Bell-inequality violation, not no-cloning**. Everything in the engine is implemented from scratch in TypeScript using the standard textbook quantum-mechanical predictions for the singlet state; it is an **idealized simulation for education**, not a model of real photon-counting hardware. There is no detector noise, no channel loss, no finite-statistics correction. The math you see is the math.

## When to Use It

- **Teaching how entanglement detects eavesdroppers** — the singlet's correlation exceeds anything a classical theory can produce, and Eve's measurement is the thing that drags it back to classical.
- **Showing why E91 ≠ BB84** — same problem, different physics. BB84's alarm is QBER from Heisenberg disturbance; E91's alarm is a missing 2√2 from broken entanglement. Both are in the suite; the comparison is half the point.
- **Introducing CHSH and Bell's inequality** — the demo computes |S| live, marks the classical bound at 2 and Tsirelson's bound at 2√2, and lets you watch where the measured value sits.
- **Setting up device-independent QKD intuition** — DI-QKD descends directly from E91; the same Bell-test-as-security-certificate idea drives loophole-free Bell experiments and entanglement-based satellite QKD.
- **Do NOT** use this as a model of a real quantum channel. It has no noise model beyond idealized intercept-resend and is not a substitute for reading the experimental papers.
- **Do NOT** confuse QKD with post-quantum cryptography. QKD addresses *key distribution* over a quantum channel; it does not replace the larger PQC migration story (see the rest of the suite for that).

## Live Demo

[**https://systemslibrarian.github.io/crypto-lab-e91/**](https://systemslibrarian.github.io/crypto-lab-e91/)

Inside: a one-click "Run E91" button with a **rounds** input (1k–50k entangled pairs) and an **Eavesdropper present** toggle. The result panel shows the measured CHSH parameter |S| on a gauge marked with the classical bound 2 and Tsirelson's bound 2√2, the four correlations E(aᵢ,bⱼ), a secure/eavesdropper-detected verdict, and the sifted key (Alice vs Bob bits with per-bit agreement highlighting). The "Bell test explained" section renders the singlet correlation curve E(Δ) = −cos(2Δ) with the four CHSH measurement points marked, walks through the five-step protocol, and compares E91 against BB84 in a single table. A real-world timeline closes the page: Bell (1964), Aspect (1982), Ekert (1991), loophole-free Bell tests (2015), and the Micius satellite (2017).

## How to Run Locally

```bash
git clone https://github.com/systemslibrarian/crypto-lab-e91.git
cd crypto-lab-e91
npm install
npm run dev        # local dev server with HMR
npm run build      # type-check + production build to dist/
npm run preview    # serve the built dist/ locally
```

No environment variables, no API keys, no servers. Everything runs client-side in the browser. The engine self-test fires in the dev console on every page load — it asserts |S| ≈ 2√2 with no Eve and that the eavesdropper is flagged when Eve is on.

## Part of the Crypto-Lab Suite

This is one demo in a wider portfolio of interactive cryptography labs — see [systemslibrarian.github.io/crypto-lab](https://systemslibrarian.github.io/crypto-lab/) for the rest, including the five PQC families overview, hybrid TLS, harvest-now-decrypt-later timelines, and deep-dives on individual schemes.

---

"So whether you eat or drink or whatever you do, do it all for the glory of God." — 1 Corinthians 10:31
