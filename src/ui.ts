// ui.ts — E91 entanglement-based QKD interactive UI.
// Renders six lab-section panels using the shared style.css conventions.
// New component classes live in extra.css; no hardcoded colors anywhere.

import {
	ALICE_ANGLES,
	BOB_ANGLES,
	correlation,
	radToDeg,
	runE91,
	type E91Result,
} from './engine.ts';
import {
	BELL_CONCEPTS,
	E91_VS_BB84,
	PROTOCOL_STEPS,
	REAL_WORLD,
} from './data.ts';

function el<K extends keyof HTMLElementTagNameMap>(
	tag: K,
	className?: string,
	html?: string,
): HTMLElementTagNameMap[K] {
	const node = document.createElement(tag);
	if (className) node.className = className;
	if (html !== undefined) node.innerHTML = html;
	return node;
}

function clampInt(value: string, min: number, max: number, fallback: number): number {
	const n = parseInt(value, 10);
	if (!Number.isFinite(n)) return fallback;
	return Math.min(max, Math.max(min, n));
}

function fmt(n: number, digits = 3): string {
	if (!Number.isFinite(n)) return '—';
	return n.toFixed(digits);
}

// ---------- 1. Hero -------------------------------------------------------

function renderHero(): HTMLElement {
	const hero = el('section', 'hero-panel');
	hero.innerHTML = `
		<button id="theme-toggle" class="theme-toggle" type="button" aria-label="Switch to light mode">🌙</button>
		<div class="hero-copy">
			<p class="eyebrow">Quantum · E91 QKD</p>
			<h1>E91 — Entanglement-Based QKD</h1>
			<p class="hero-text">
				BB84 detects eavesdroppers because measuring a photon disturbs it. E91 detects them
				because entangled photons are correlated more strongly than any classical theory
				allows — and an eavesdropper breaks that correlation. Alice and Bob share a stream
				of entangled singlet pairs, run a CHSH Bell test on most of the rounds, and harvest
				the rest as a key. If the test passes, the channel is provably free of
				measurement; if it fails, they know to throw the key away.
			</p>
			<details class="why-details">
				<summary>How is this different from BB84?</summary>
				<p>
					BB84 (1984) is prepare-and-measure: Alice picks a polarization and a basis,
					sends a single photon, and Bob guesses the basis. Its security rests on the
					no-cloning theorem — Eve cannot copy a qubit she cannot identify — and shows
					up as a raised quantum bit-error rate. E91 (1991) is entanglement-based: a
					source emits a singlet pair, Alice and Bob each measure their half, and they
					run a Bell test on the joint statistics. Its security rests on the fact that
					quantum entanglement violates Bell\'s inequality, and any eavesdropper who
					listens forces the world back into a classical-correlation regime where the
					inequality holds. Same goal — different physics. See the sibling
					<code>crypto-lab-bb84</code> demo for the prepare-and-measure side.
				</p>
			</details>
		</div>
		<div class="hero-metric-card">
			<p class="hero-metric-label">Bell test</p>
			<p class="hero-metric-value">classical: |S| ≤ 2</p>
			<p class="hero-metric-value">quantum: |S| = 2√2 ≈ 2.828</p>
			<p class="hero-metric-note">An eavesdropper collapses entanglement and pushes S back below 2 — the signature this demo lets you watch live.</p>
		</div>
	`;
	return hero;
}

// ---------- 2. Run the protocol ------------------------------------------

function renderRunProtocol(): HTMLElement {
	const section = el('section', 'lab-section');
	section.id = 'run';
	section.setAttribute('aria-labelledby', 'run-heading');

	section.innerHTML = `
		<div class="section-heading-row">
			<div>
				<p class="section-kicker">Section · 1</p>
				<h2 id="run-heading">Run the protocol</h2>
				<p class="panel-copy">Pick a number of entangled pairs, decide whether Eve is intercepting, and run the CHSH Bell test. Watch |S| sit near 2√2 when the channel is clean and collapse toward 2 when it is not.</p>
			</div>
		</div>
		<div class="e91-inputs" role="group" aria-label="E91 inputs">
			<label>
				<span>Rounds (entangled pairs)</span>
				<input type="number" id="e91-rounds" min="1000" max="50000" step="1000" value="10000" />
			</label>
			<label class="e91-toggle">
				<input type="checkbox" id="e91-eve" />
				<span>Eavesdropper present (intercept-resend at π/8)</span>
			</label>
		</div>
		<div class="e91-actions">
			<button id="e91-run" class="tab-button" type="button">Run E91</button>
		</div>
		<div id="e91-output" class="e91-output" aria-live="polite"></div>
	`;

	const roundsInput = section.querySelector<HTMLInputElement>('#e91-rounds')!;
	const eveInput = section.querySelector<HTMLInputElement>('#e91-eve')!;
	const runBtn = section.querySelector<HTMLButtonElement>('#e91-run')!;
	const output = section.querySelector<HTMLElement>('#e91-output')!;

	function run(): void {
		const rounds = clampInt(roundsInput.value, 1000, 50000, 10000);
		const eve = eveInput.checked;
		const result = runE91({ rounds, eve });
		output.innerHTML = renderResult(result, eve);
	}

	runBtn.addEventListener('click', run);
	[roundsInput, eveInput].forEach((i) => i.addEventListener('change', run));

	run();
	return section;
}

function renderResult(r: E91Result, eveOn: boolean): string {
	const absS = Math.abs(r.S);
	const verdict = r.eavesdropperDetected
		? `<p class="scenario-status--invalid"><strong>✗ Eavesdropper detected.</strong> |S| = ${fmt(absS)} has collapsed toward the classical bound. Discard this key.</p>`
		: `<p class="scenario-status--valid"><strong>✓ Channel secure.</strong> |S| = ${fmt(absS)} sits in the quantum-secure region above 2 and near Tsirelson\'s bound. Keep this key.</p>`;

	return `
		${renderSGauge(r)}
		<div class="e91-grid">
			<div class="e91-side">
				<p class="hero-metric-label">CHSH parameter</p>
				<p class="mono-inline">|S| = <strong>${fmt(absS)}</strong>  ·  classical ≤ 2  ·  quantum = 2√2 ≈ ${fmt(r.tsirelsonBound)}</p>
				${verdict}
			</div>
			<div class="e91-side">
				<p class="hero-metric-label">Eve setting</p>
				<p class="mono-inline">${eveOn ? 'Intercept-resend at π/8 (22.5°)' : 'No eavesdropper'}</p>
				<p class="hero-metric-label" style="margin-top:12px;">Rounds</p>
				<p class="mono-inline">${r.rounds.toLocaleString()} entangled pairs · ${(r.keyBitsAlice.length).toLocaleString()} aligned-basis (key) · ${(r.rounds - r.keyBitsAlice.length).toLocaleString()} CHSH-test</p>
			</div>
		</div>
		${renderCorrelations(r)}
		${renderKey(r)}
	`;
}

function renderSGauge(r: E91Result): string {
	// Map |S| in [0, 3] onto a 100% wide bar. Mark 2 and 2√2.
	const absS = Math.abs(r.S);
	const max = 3;
	const pctOf = (v: number) => `${Math.min(100, (v / max) * 100)}%`;
	const region = r.eavesdropperDetected ? 'gauge-fill--bad' : 'gauge-fill--good';
	return `
		<div class="s-gauge" aria-label="CHSH parameter gauge">
			<div class="s-gauge-track">
				<div class="s-gauge-tick s-gauge-tick--classical" style="left: ${pctOf(2)};">
					<span class="s-gauge-tick-label">classical 2</span>
				</div>
				<div class="s-gauge-tick s-gauge-tick--tsirelson" style="left: ${pctOf(r.tsirelsonBound)};">
					<span class="s-gauge-tick-label">2√2 ≈ ${fmt(r.tsirelsonBound)}</span>
				</div>
				<div class="s-gauge-fill ${region}" style="width: ${pctOf(absS)};"></div>
				<div class="s-gauge-marker" style="left: ${pctOf(absS)};">
					<span class="s-gauge-marker-label">|S| = ${fmt(absS)}</span>
				</div>
			</div>
		</div>
	`;
}

function renderCorrelations(r: E91Result): string {
	const rows = r.correlations
		.map(
			(c) => `
				<tr>
					<td class="mono-cell">${c.label}</td>
					<td class="mono-cell">${fmt(c.value)}</td>
					<td class="mono-cell">${c.n.toLocaleString()}</td>
				</tr>
			`,
		)
		.join('');
	return `
		<div class="table-shell">
			<table class="math-table corr-table">
				<caption class="visually-hidden">Measured CHSH correlations</caption>
				<thead>
					<tr><th scope="col">Correlation</th><th scope="col">Value</th><th scope="col">Sample size</th></tr>
				</thead>
				<tbody>
					${rows}
				</tbody>
			</table>
		</div>
		<p class="section-footnote">S = E(a₁,b₁) + E(a₁,b₂) + E(a₂,b₁) − E(a₂,b₂). Quantum singlet at the chosen angles gives ±1/√2 for each term, so the magnitudes sum to 2√2.</p>
	`;
}

function renderKey(r: E91Result): string {
	const show = 64;
	const aliceBits = r.keyBitsAlice.slice(0, show).join('');
	const bobBits = r.keyBitsBob.slice(0, show).join('');
	const cells: string[] = [];
	for (let i = 0; i < Math.min(show, r.keyBitsAlice.length); i++) {
		const match = r.keyBitsAlice[i] === r.keyBitsBob[i];
		cells.push(`<span class="bit-cell ${match ? 'bit-cell--match' : 'bit-cell--miss'}">${r.keyBitsAlice[i]}</span>`);
	}
	const agreementPct = (r.keyAgreement * 100).toFixed(2);
	const statusClass = r.keyAgreement > 0.97 ? 'scenario-status--valid' : 'scenario-status--invalid';
	return `
		<div class="e91-key">
			<p class="hero-metric-label">Sifted key (aligned-basis rounds)</p>
			<p class="mono-inline">Alice : ${aliceBits}${r.keyBitsAlice.length > show ? '…' : ''}</p>
			<p class="mono-inline">Bob   : ${bobBits}${r.keyBitsBob.length > show ? '…' : ''}</p>
			<div class="bit-grid" aria-label="First ${show} key bits, coloured by Alice/Bob agreement">${cells.join('')}</div>
			<p class="${statusClass}">Key agreement: <strong>${agreementPct}%</strong> across ${r.keyBitsAlice.length.toLocaleString()} sifted bits.</p>
			<p class="section-footnote">When the channel is clean, the singlet gives perfectly anti-correlated outcomes at aligned bases — Bob flips his bits and they agree exactly. Under intercept-resend, Eve\'s measurements desynchronise the pair and agreement drops.</p>
		</div>
	`;
}

// ---------- 3. The Bell test explained ------------------------------------

function renderBellExplained(): HTMLElement {
	const section = el('section', 'lab-section');
	section.id = 'bell';
	section.setAttribute('aria-labelledby', 'bell-heading');

	const cards = BELL_CONCEPTS.map(
		(c) => `
			<div class="panel-card">
				<h3>${c.title}</h3>
				<p class="panel-copy">${c.body}</p>
			</div>
		`,
	).join('');

	const steps = PROTOCOL_STEPS.map(
		(s) => `
			<li class="proto-step">
				<span class="proto-step-num">${s.step}</span>
				<div class="proto-step-body">
					<h3>${s.title}</h3>
					<p class="panel-copy">${s.detail}</p>
				</div>
			</li>
		`,
	).join('');

	section.innerHTML = `
		<div class="section-heading-row">
			<div>
				<p class="section-kicker">Section · 2</p>
				<h2 id="bell-heading">The Bell test, explained</h2>
				<p class="panel-copy">Why entanglement makes eavesdropping visible: the inequality, the angles, and the protocol step by step.</p>
			</div>
		</div>
		<div class="bell-grid">${cards}</div>
		${renderCorrelationCurve()}
		<h3 class="proto-heading">Protocol flow</h3>
		<ol class="proto-list">${steps}</ol>
	`;
	return section;
}

function renderCorrelationCurve(): string {
	// Plot E(0, Δ) = -cos(2Δ) for Δ ∈ [-π/2, π/2].
	const N = 121;
	const xs: number[] = [];
	const ys: number[] = [];
	for (let i = 0; i < N; i++) {
		const t = i / (N - 1); // 0..1
		const delta = -Math.PI / 2 + t * Math.PI;
		xs.push(delta);
		ys.push(correlation(0, -delta)); // E(0, -delta) gives -cos(2 delta) too
	}
	const W = 640;
	const H = 220;
	const padL = 44;
	const padR = 16;
	const padT = 16;
	const padB = 36;
	const innerW = W - padL - padR;
	const innerH = H - padT - padB;
	const xScale = (d: number) => padL + ((d + Math.PI / 2) / Math.PI) * innerW;
	const yScale = (y: number) => padT + ((1 - y) / 2) * innerH;
	const path = xs
		.map((d, i) => {
			const x = xScale(d).toFixed(2);
			const y = yScale(ys[i]!).toFixed(2);
			return (i === 0 ? 'M' : 'L') + x + ',' + y;
		})
		.join(' ');

	// CHSH measurement points: for each (ai, bj), Δ = ai − bj.
	const dots: string[] = [];
	for (let i = 0; i < ALICE_ANGLES.length; i++) {
		for (let j = 0; j < BOB_ANGLES.length; j++) {
			const ai = ALICE_ANGLES[i]!;
			const bj = BOB_ANGLES[j]!;
			const delta = ai - bj;
			const E = correlation(ai, bj);
			dots.push(
				`<circle class="curve-dot" cx="${xScale(delta).toFixed(2)}" cy="${yScale(E).toFixed(2)}" r="5"><title>E(a${i + 1},b${j + 1}) = ${fmt(E)} at Δ = ${radToDeg(delta)}°</title></circle>`,
			);
		}
	}

	return `
		<div class="corr-curve">
			<h3 class="corr-curve-heading">E(Δ) = −cos(2Δ)</h3>
			<p class="panel-copy">The singlet\'s correlation function, with the four CHSH measurement angles marked. The two analyzer settings on each side are chosen so that the four points land at ±1/√2 — exactly where |S| reaches Tsirelson\'s bound.</p>
			<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Plot of E(Δ) = −cos(2Δ) with CHSH measurement points">
				<line class="curve-axis" x1="${padL}" y1="${yScale(0)}" x2="${padL + innerW}" y2="${yScale(0)}" />
				<line class="curve-axis" x1="${xScale(0)}" y1="${padT}" x2="${xScale(0)}" y2="${padT + innerH}" />
				<text class="curve-axis-label" x="${padL + innerW}" y="${yScale(0) + 14}" text-anchor="end">Δ</text>
				<text class="curve-axis-label" x="${padL - 8}" y="${yScale(1) + 4}" text-anchor="end">+1</text>
				<text class="curve-axis-label" x="${padL - 8}" y="${yScale(-1) + 4}" text-anchor="end">−1</text>
				<text class="curve-axis-label" x="${xScale(-Math.PI / 2)}" y="${padT + innerH + 18}" text-anchor="middle">−π/2</text>
				<text class="curve-axis-label" x="${xScale(0)}" y="${padT + innerH + 18}" text-anchor="middle">0</text>
				<text class="curve-axis-label" x="${xScale(Math.PI / 2)}" y="${padT + innerH + 18}" text-anchor="middle">+π/2</text>
				<path class="curve-line" d="${path}" />
				${dots.join('')}
			</svg>
		</div>
	`;
}

// ---------- 4. E91 vs BB84 ------------------------------------------------

function renderVsBb84(): HTMLElement {
	const section = el('section', 'lab-section');
	section.id = 'vs-bb84';
	section.setAttribute('aria-labelledby', 'vs-heading');

	const rows = E91_VS_BB84.map(
		(r) => `
			<tr>
				<th scope="row">${r.aspect}</th>
				<td>${r.bb84}</td>
				<td>${r.e91}</td>
			</tr>
		`,
	).join('');

	section.innerHTML = `
		<div class="section-heading-row">
			<div>
				<p class="section-kicker">Section · 3</p>
				<h2 id="vs-heading">E91 vs BB84</h2>
				<p class="panel-copy">Two protocols for the same goal — distribute a key whose secrecy is enforced by physics — but built on different principles. See the sibling <a class="deployment-link" href="https://systemslibrarian.github.io/crypto-lab-bb84/">crypto-lab-bb84</a> for the prepare-and-measure half.</p>
			</div>
		</div>
		<div class="table-shell">
			<table class="math-table compare-e91">
				<thead>
					<tr>
						<th scope="col">Aspect</th>
						<th scope="col">BB84 (1984)</th>
						<th scope="col">E91 (1991)</th>
					</tr>
				</thead>
				<tbody>${rows}</tbody>
			</table>
		</div>
	`;
	return section;
}

// ---------- 5. In the real world -----------------------------------------

function renderRealWorld(): HTMLElement {
	const section = el('section', 'lab-section');
	section.id = 'real-world';
	section.setAttribute('aria-labelledby', 'real-heading');

	const items = REAL_WORLD.map(
		(n) => `
			<li class="hist-item">
				<div class="hist-year">${n.year}</div>
				<div class="hist-body">
					<h3>${n.title}</h3>
					<p class="panel-copy">${n.body}</p>
				</div>
			</li>
		`,
	).join('');

	section.innerHTML = `
		<div class="section-heading-row">
			<div>
				<p class="section-kicker">Section · 4</p>
				<h2 id="real-heading">In the real world</h2>
				<p class="panel-copy">E91 outside the textbook: the Bell tests that grounded it, the satellites that scaled it, and the device-independent QKD it inspired.</p>
			</div>
		</div>
		<ul class="hist-list">${items}</ul>
	`;
	return section;
}

// ---------- 6. Footer (scripture) ----------------------------------------

function renderFooter(): HTMLElement {
	const footer = el('footer', 'lab-section');
	const reviewed = '2026-06';
	footer.innerHTML = `
		<div class="footer-meta">
			<div class="footer-meta-item">
				<p class="hero-metric-label">Last reviewed</p>
				<p class="mono-inline">${reviewed}</p>
			</div>
			<div class="footer-meta-item">
				<p class="hero-metric-label">Status</p>
				<p class="panel-copy">Educational simulation of the standard textbook E91 model. Idealized — no detector noise, no channel loss, no finite-statistics corrections. For the real thing, see entanglement-based satellite QKD and device-independent QKD research.</p>
			</div>
		</div>
		<p class="scripture">"So whether you eat or drink or whatever you do, do it all for the glory of God." — 1 Corinthians 10:31</p>
	`;
	return footer;
}

// ---------- mountApp ------------------------------------------------------

export function mountApp(root: HTMLDivElement): void {
	const shell = el('div', 'page-shell');
	shell.id = 'playground-heading';

	shell.appendChild(renderHero());
	shell.appendChild(renderRunProtocol());
	shell.appendChild(renderBellExplained());
	shell.appendChild(renderVsBb84());
	shell.appendChild(renderRealWorld());
	shell.appendChild(renderFooter());

	root.replaceChildren(shell);
}
