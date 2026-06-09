// ui.ts — E91 entanglement-based QKD interactive UI.
// Six lab-section panels using the shared style.css conventions; new
// component classes are defined in extra.css and source all colors from
// CSS variables.

import {
	ALICE_ANGLES,
	BOB_ANGLES,
	SCENARIO_DEFAULTS,
	SCENARIO_LABELS,
	correlation,
	radToDeg,
	resolveScenario,
	runE91,
	type CorrelationStat,
	type E91Result,
	type Scenario,
	type ScenarioId,
} from './engine.ts';
import {
	BELL_CONCEPTS,
	E91_VS_BB84,
	FURTHER_READING,
	PROTOCOL_STEPS,
	REAL_WORLD,
	REFERENCES,
	SCENARIO_COPY,
	SCENARIO_ORDER,
	type ScenarioCopy,
} from './data.ts';

const TRANSCRIPT_CAP = 50;
const Z95 = 1.96;

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

function escapeHtml(s: string): string {
	return s
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}

// --- shared run state ------------------------------------------------------

interface RunState {
	rounds: number;
	scenario: Scenario;
	seed: number;
	transcriptEnabled: boolean;
}

function defaultRunState(): RunState {
	return {
		rounds: 10000,
		scenario: { ...SCENARIO_DEFAULTS.ideal },
		seed: 1,
		transcriptEnabled: false,
	};
}

// URL hash <-> RunState. Encodes only the meaningful per-scenario knob.
function encodeStateHash(state: RunState): string {
	const params = new URLSearchParams();
	params.set('s', state.scenario.id);
	params.set('r', String(state.rounds));
	params.set('seed', String(state.seed));
	const copy = SCENARIO_COPY[state.scenario.id];
	if (copy.knob) {
		const v = state.scenario[copy.knob.field];
		params.set(copy.knob.field, String(v));
	}
	if (state.transcriptEnabled) params.set('t', '1');
	return `#${params.toString()}`;
}

function decodeStateHash(hash: string): RunState {
	const state = defaultRunState();
	const raw = hash.startsWith('#') ? hash.slice(1) : hash;
	if (!raw) return state;
	const params = new URLSearchParams(raw);
	const id = params.get('s') as ScenarioId | null;
	if (id && id in SCENARIO_DEFAULTS) {
		state.scenario = resolveScenario(id);
	}
	const r = parseInt(params.get('r') ?? '', 10);
	if (Number.isFinite(r) && r >= 1000 && r <= 50000) state.rounds = r;
	const seed = parseInt(params.get('seed') ?? '', 10);
	if (Number.isFinite(seed)) state.seed = seed;
	for (const field of ['noiseP', 'misalignRad', 'lossEta'] as const) {
		const v = params.get(field);
		if (v !== null) {
			const n = parseFloat(v);
			if (Number.isFinite(n)) state.scenario[field] = n;
		}
	}
	if (params.get('t') === '1') state.transcriptEnabled = true;
	return state;
}

// --- 1. Hero --------------------------------------------------------------

function renderHero(): HTMLElement {
	const hero = el('section', 'hero-panel');
	hero.innerHTML = `
		<button id="theme-toggle" class="theme-toggle" type="button" aria-label="Switch to light mode">🌙</button>
		<div class="hero-copy">
			<p class="eyebrow">Quantum · E91 QKD</p>
			<h1>E91 — Entanglement-Based QKD</h1>
			<p class="hero-text">
				BB84 detects eavesdroppers because measuring a photon disturbs it. E91 detects
				them because entangled photons are correlated more strongly than any classical
				theory allows — and an eavesdropper breaks that correlation. Alice and Bob share
				a stream of entangled singlet pairs, run a CHSH Bell test on most of the rounds,
				and harvest the rest as a key. The verdict is statistical: if the 95% confidence
				interval for |S| sits clearly above the classical bound of 2, the channel is
				consistent with intact entanglement under this model; if it sits below, the
				key must be discarded.
			</p>
			<details class="why-details">
				<summary>How is this different from BB84?</summary>
				<p>
					BB84 (1984) is prepare-and-measure: Alice picks a polarization and a basis,
					sends a single photon, and Bob guesses the basis. Its security rests on the
					no-cloning theorem and shows up as raised QBER. E91 (1991) is
					entanglement-based: a source emits a singlet pair, Alice and Bob each
					measure their half, and they run a Bell test on the joint statistics. Its
					security rests on Bell-inequality violation, and any eavesdropper who
					listens forces the world back into a classical-correlation regime. Same
					goal — different physics. See the sibling
					<code>crypto-lab-bb84</code> demo for the prepare-and-measure side.
				</p>
			</details>
		</div>
		<div class="hero-metric-card">
			<p class="hero-metric-label">Bell test</p>
			<p class="hero-metric-value">classical: |S| ≤ 2</p>
			<p class="hero-metric-value">quantum: |S| = 2√2 ≈ 2.828</p>
			<p class="hero-metric-note">
				This is an idealized educational simulation of the textbook E91 model with five
				selectable channel scenarios. No detector noise, no finite-key corrections — see
				the references for the real-experiment story.
			</p>
		</div>
	`;
	return hero;
}

// --- 2. Run the protocol --------------------------------------------------

function renderRunProtocol(initial: RunState): { node: HTMLElement; api: RunPanelApi } {
	const section = el('section', 'lab-section');
	section.id = 'run';
	section.setAttribute('aria-labelledby', 'run-heading');

	section.innerHTML = `
		<div class="section-heading-row">
			<div>
				<p class="section-kicker">Section · 1</p>
				<h2 id="run-heading">Run the protocol</h2>
				<p class="panel-copy">
					Pick a scenario, choose a number of entangled pairs, optionally enable the
					round transcript, and run. The verdict is sample-size-aware: the 95%
					confidence interval for |S| has to clear the classical bound of 2 before the
					channel is called secure.
				</p>
			</div>
		</div>
		<div class="scenario-strip" role="tablist" aria-label="Channel scenario"></div>
		<div class="scenario-card" id="scenario-card"></div>
		<div class="e91-inputs" role="group" aria-label="E91 inputs">
			<label>
				<span>Rounds (entangled pairs)</span>
				<input type="number" id="e91-rounds" min="1000" max="50000" step="1000" value="${initial.rounds}" />
			</label>
			<label>
				<span>Random seed</span>
				<input type="number" id="e91-seed" min="0" max="99999" step="1" value="${initial.seed}" />
			</label>
			<label class="e91-toggle">
				<input type="checkbox" id="e91-transcript" ${initial.transcriptEnabled ? 'checked' : ''} />
				<span>Show round-by-round transcript (first ${TRANSCRIPT_CAP})</span>
			</label>
		</div>
		<div class="e91-actions">
			<button id="e91-run" class="tab-button" type="button">Run E91</button>
			<button id="e91-copy-link" class="copy-chip" type="button">🔗 Copy link to this run</button>
			<button id="e91-copy-csv" class="copy-chip" type="button">📋 Copy results (CSV)</button>
		</div>
		<div id="e91-output" class="e91-output" aria-live="polite"></div>
	`;

	const strip = section.querySelector<HTMLElement>('.scenario-strip')!;
	const card = section.querySelector<HTMLElement>('#scenario-card')!;
	const roundsInput = section.querySelector<HTMLInputElement>('#e91-rounds')!;
	const seedInput = section.querySelector<HTMLInputElement>('#e91-seed')!;
	const transcriptInput = section.querySelector<HTMLInputElement>('#e91-transcript')!;
	const runBtn = section.querySelector<HTMLButtonElement>('#e91-run')!;
	const copyLinkBtn = section.querySelector<HTMLButtonElement>('#e91-copy-link')!;
	const copyCsvBtn = section.querySelector<HTMLButtonElement>('#e91-copy-csv')!;
	const output = section.querySelector<HTMLElement>('#e91-output')!;

	const state: RunState = { ...initial, scenario: { ...initial.scenario } };
	let latest: E91Result | null = null;
	const onStateChange: Array<(s: RunState) => void> = [];

	function emitState(): void {
		for (const cb of onStateChange) cb(state);
	}

	function setScenario(id: ScenarioId): void {
		state.scenario = resolveScenario(id);
		renderStrip();
		renderCard();
		run();
		emitState();
	}

	function renderStrip(): void {
		strip.innerHTML = SCENARIO_ORDER.map((sid) => {
			const copy = SCENARIO_COPY[sid];
			const active = state.scenario.id === sid;
			return `
				<button type="button" class="scenario-chip ${active ? 'is-active' : ''}" role="tab" aria-selected="${active}" data-scenario="${sid}">
					<span class="scenario-chip-emoji" aria-hidden="true">${copy.emoji}</span>
					<span class="scenario-chip-name">${SCENARIO_LABELS[sid].shortName}</span>
				</button>
			`;
		}).join('');
		strip.querySelectorAll<HTMLButtonElement>('button[data-scenario]').forEach((btn) => {
			btn.addEventListener('click', () => setScenario(btn.dataset.scenario as ScenarioId));
		});
	}

	function renderCard(): void {
		const copy = SCENARIO_COPY[state.scenario.id];
		const knobHtml = copy.knob ? renderKnob(copy) : '';
		card.innerHTML = `
			<div class="scenario-card-head">
				<span class="scenario-card-emoji" aria-hidden="true">${copy.emoji}</span>
				<div>
					<h3>${SCENARIO_LABELS[state.scenario.id].name}</h3>
					<p class="panel-copy">${copy.story}</p>
					<p class="scenario-expectation">${copy.expectation}</p>
				</div>
			</div>
			${knobHtml}
		`;
		if (copy.knob) {
			const slider = card.querySelector<HTMLInputElement>('#scenario-knob')!;
			const display = card.querySelector<HTMLElement>('#scenario-knob-display')!;
			slider.addEventListener('input', () => {
				const v = parseFloat(slider.value);
				state.scenario[copy.knob!.field] = v;
				display.textContent = copy.knob!.toDisplay(v);
			});
			slider.addEventListener('change', () => {
				run();
				emitState();
			});
		}
	}

	function renderKnob(copy: ScenarioCopy): string {
		const knob = copy.knob!;
		const value = state.scenario[knob.field];
		return `
			<div class="scenario-knob">
				<label for="scenario-knob"><strong>${knob.label}</strong></label>
				<input
					id="scenario-knob"
					type="range"
					min="${knob.min}"
					max="${knob.max}"
					step="${knob.step}"
					value="${value}"
				/>
				<span class="scenario-knob-value" id="scenario-knob-display">${knob.toDisplay(value)}</span>
			</div>
		`;
	}

	function read(): void {
		state.rounds = clampInt(roundsInput.value, 1000, 50000, 10000);
		state.seed = clampInt(seedInput.value, 0, 99999, 1);
		state.transcriptEnabled = transcriptInput.checked;
	}

	function run(): void {
		read();
		const result = runE91({
			rounds: state.rounds,
			scenario: state.scenario,
			seed: state.seed,
			transcript: state.transcriptEnabled ? TRANSCRIPT_CAP : 0,
		});
		latest = result;
		output.innerHTML = renderResult(result);
		emitState();
	}

	runBtn.addEventListener('click', run);
	[roundsInput, seedInput].forEach((i) =>
		i.addEventListener('change', () => {
			run();
		}),
	);
	transcriptInput.addEventListener('change', () => run());

	copyLinkBtn.addEventListener('click', () => {
		const url = `${location.origin}${location.pathname}${encodeStateHash(state)}`;
		void navigator.clipboard.writeText(url).then(
			() => flashCopy(copyLinkBtn, '✓ Link copied'),
			() => flashCopy(copyLinkBtn, '✗ Failed'),
		);
	});
	copyCsvBtn.addEventListener('click', () => {
		if (!latest) return;
		void navigator.clipboard.writeText(resultToCsv(latest)).then(
			() => flashCopy(copyCsvBtn, '✓ CSV copied'),
			() => flashCopy(copyCsvBtn, '✗ Failed'),
		);
	});

	renderStrip();
	renderCard();
	run();

	const api: RunPanelApi = {
		applyState(newState) {
			state.rounds = newState.rounds;
			state.seed = newState.seed;
			state.transcriptEnabled = newState.transcriptEnabled;
			state.scenario = { ...newState.scenario };
			roundsInput.value = String(state.rounds);
			seedInput.value = String(state.seed);
			transcriptInput.checked = state.transcriptEnabled;
			renderStrip();
			renderCard();
			run();
		},
		onStateChange(cb) {
			onStateChange.push(cb);
		},
	};
	return { node: section, api };
}

interface RunPanelApi {
	applyState(state: RunState): void;
	onStateChange(cb: (state: RunState) => void): void;
}

function flashCopy(btn: HTMLButtonElement, label: string): void {
	const original = btn.innerHTML;
	btn.innerHTML = label;
	btn.classList.add('copy-chip--ok');
	setTimeout(() => {
		btn.innerHTML = original;
		btn.classList.remove('copy-chip--ok');
	}, 1400);
}

function resultToCsv(r: E91Result): string {
	const lines: string[] = [];
	lines.push('# E91 simulation results');
	lines.push(`scenario,${r.scenario.id}`);
	lines.push(`rounds_requested,${r.rounds}`);
	lines.push(`effective_rounds,${r.effectiveRounds}`);
	lines.push(`S_measured,${r.S}`);
	lines.push(`S_stderr,${r.sStdErr}`);
	lines.push(`S_ci95_lo,${r.sCi95Lo}`);
	lines.push(`S_ci95_hi,${r.sCi95Hi}`);
	lines.push(`S_expected,${r.expectedS}`);
	lines.push(`classical_bound,${r.classicalBound}`);
	lines.push(`tsirelson_bound,${r.tsirelsonBound}`);
	lines.push(`verdict,${r.verdict.classification}`);
	lines.push(`key_agreement,${r.keyAgreement}`);
	lines.push(`key_agreement_expected,${r.expectedKeyAgreement}`);
	lines.push('');
	lines.push('# correlations');
	lines.push('label,expected,measured,stderr,n,ci95_lo,ci95_hi');
	for (const c of r.correlations) {
		lines.push(
			`${c.label},${c.expected},${c.measured},${c.stderr},${c.n},${c.ci95Lo},${c.ci95Hi}`,
		);
	}
	if (r.transcript.length > 0) {
		lines.push('');
		lines.push('# transcript (first rounds)');
		lines.push('round,bucket,alice_angle_deg,bob_angle_deg,A,B,product');
		for (const row of r.transcript) {
			lines.push(
				`${row.round},${row.bucket},${radToDeg(row.aliceAngle)},${radToDeg(row.bobAngle)},${row.A},${row.B},${row.product}`,
			);
		}
	}
	return lines.join('\n');
}

// ---- result rendering ----------------------------------------------------

function renderResult(r: E91Result): string {
	return `
		${renderVerdict(r)}
		${renderSGauge(r)}
		${renderSummaryCards(r)}
		${renderCorrelations(r)}
		${renderKey(r)}
		${r.transcript.length > 0 ? renderTranscript(r) : ''}
	`;
}

function renderVerdict(r: E91Result): string {
	const cls = r.verdict.classification;
	const statusClass =
		cls === 'secure'
			? 'scenario-status--valid'
			: cls === 'compromised'
				? 'scenario-status--invalid'
				: 'scenario-status--pending';
	const icon = cls === 'secure' ? '✓' : cls === 'compromised' ? '✗' : '?';
	const headline = cls === 'secure' ? 'Secure' : cls === 'compromised' ? 'Compromised' : 'Inconclusive';
	return `
		<div class="verdict verdict--${cls}">
			<div class="verdict-head">
				<span class="verdict-icon ${statusClass}">${icon}</span>
				<div>
					<p class="verdict-headline ${statusClass}">${headline}</p>
					<p class="verdict-summary">${escapeHtml(r.verdict.summary)}</p>
				</div>
			</div>
			<p class="verdict-detail">${escapeHtml(r.verdict.detail)}</p>
		</div>
	`;
}

function renderSGauge(r: E91Result): string {
	const absS = Math.abs(r.S);
	const max = 3;
	const pctOf = (v: number) => `${Math.min(100, Math.max(0, (v / max) * 100))}%`;
	const ciLo = Math.max(0, absS - Z95 * r.sStdErr);
	const ciHi = absS + Z95 * r.sStdErr;
	const region =
		r.verdict.classification === 'secure'
			? 'gauge-fill--good'
			: r.verdict.classification === 'compromised'
				? 'gauge-fill--bad'
				: 'gauge-fill--meh';
	return `
		<div class="s-gauge" aria-label="CHSH parameter gauge with 95% confidence band">
			<div class="s-gauge-track">
				<div class="s-gauge-fill ${region}" style="width: ${pctOf(absS)};"></div>
				<div class="s-gauge-ci" style="left: ${pctOf(ciLo)}; width: calc(${pctOf(ciHi)} - ${pctOf(ciLo)});" title="95% CI: [${fmt(ciLo)}, ${fmt(ciHi)}]"></div>
				<div class="s-gauge-tick s-gauge-tick--classical" style="left: ${pctOf(2)};">
					<span class="s-gauge-tick-label">classical 2</span>
				</div>
				<div class="s-gauge-tick s-gauge-tick--tsirelson" style="left: ${pctOf(r.tsirelsonBound)};">
					<span class="s-gauge-tick-label">2√2 ≈ ${fmt(r.tsirelsonBound)}</span>
				</div>
				<div class="s-gauge-marker" style="left: ${pctOf(absS)};">
					<span class="s-gauge-marker-label">|S| = ${fmt(absS)}</span>
				</div>
			</div>
		</div>
	`;
}

function renderSummaryCards(r: E91Result): string {
	const expectedAbs = Math.abs(r.expectedS);
	return `
		<div class="e91-grid">
			<div class="e91-side">
				<p class="hero-metric-label">CHSH parameter</p>
				<p class="mono-inline">|S| measured = <strong>${fmt(Math.abs(r.S))}</strong></p>
				<p class="mono-inline">|S| expected = ${fmt(expectedAbs)}</p>
				<p class="mono-inline">95% CI for |S| = [${fmt(Math.max(0, Math.abs(r.S) - Z95 * r.sStdErr))}, ${fmt(Math.abs(r.S) + Z95 * r.sStdErr)}]</p>
				<p class="mono-inline">SE(S) = ${fmt(r.sStdErr, 4)} · classical bound = 2 · 2√2 ≈ ${fmt(r.tsirelsonBound)}</p>
			</div>
			<div class="e91-side">
				<p class="hero-metric-label">Run</p>
				<p class="mono-inline">scenario: ${SCENARIO_LABELS[r.scenario.id].name}</p>
				<p class="mono-inline">${r.rounds.toLocaleString()} requested · ${r.effectiveRounds.toLocaleString()} coincidences</p>
				<p class="mono-inline">${r.keyBitsAlice.length.toLocaleString()} aligned-basis (key) · ${(r.effectiveRounds - r.keyBitsAlice.length).toLocaleString()} CHSH-test</p>
			</div>
		</div>
	`;
}

function renderCorrelations(r: E91Result): string {
	const rows = r.correlations
		.map(
			(c) => renderCorrelationRow(c),
		)
		.join('');
	return `
		<h3 class="subhead">Expected vs measured correlations</h3>
		<div class="table-shell">
			<table class="math-table corr-table">
				<thead>
					<tr>
						<th scope="col">Correlation</th>
						<th scope="col">Expected</th>
						<th scope="col">Measured</th>
						<th scope="col">95% CI</th>
						<th scope="col">SE</th>
						<th scope="col">n</th>
					</tr>
				</thead>
				<tbody>${rows}</tbody>
			</table>
		</div>
		<p class="section-footnote">S = E(a₁,b₁) + E(a₁,b₂) + E(a₂,b₁) − E(a₂,b₂). Quantum singlet at the chosen angles gives ±1/√2 for each term, so the magnitudes sum to 2√2. The SE column uses SE(E) = √((1 − E²)/n); SE(S) combines them as independent measurements.</p>
	`;
}

function renderCorrelationRow(c: CorrelationStat): string {
	const dev = c.measured - c.expected;
	const sigma = c.stderr > 0 ? dev / c.stderr : 0;
	const offBadge = Math.abs(sigma) > 3 ? '<span class="corr-warn" title="More than 3σ from expected">!</span>' : '';
	return `
		<tr>
			<td class="mono-cell">${c.label}</td>
			<td class="mono-cell">${fmt(c.expected)}</td>
			<td class="mono-cell">${fmt(c.measured)} ${offBadge}</td>
			<td class="mono-cell">[${fmt(c.ci95Lo)}, ${fmt(c.ci95Hi)}]</td>
			<td class="mono-cell">${fmt(c.stderr, 4)}</td>
			<td class="mono-cell">${c.n.toLocaleString()}</td>
		</tr>
	`;
}

function renderKey(r: E91Result): string {
	const show = 64;
	const aliceBits = r.keyBitsAlice.slice(0, show).join('');
	const bobBits = r.keyBitsBob.slice(0, show).join('');
	const cells: string[] = [];
	for (let i = 0; i < Math.min(show, r.keyBitsAlice.length); i++) {
		const match = r.keyBitsAlice[i] === r.keyBitsBob[i];
		cells.push(
			`<span class="bit-cell ${match ? 'bit-cell--match' : 'bit-cell--miss'}">${r.keyBitsAlice[i]}</span>`,
		);
	}
	const agreementPct = (r.keyAgreement * 100).toFixed(2);
	const expectedPct = (r.expectedKeyAgreement * 100).toFixed(2);
	const statusClass =
		r.keyAgreement > 0.97
			? 'scenario-status--valid'
			: r.keyAgreement > 0.9
				? 'scenario-status--pending'
				: 'scenario-status--invalid';
	return `
		<h3 class="subhead">Sifted key (aligned-basis rounds)</h3>
		<div class="e91-key">
			<p class="mono-inline">Alice : ${aliceBits}${r.keyBitsAlice.length > show ? '…' : ''}</p>
			<p class="mono-inline">Bob   : ${bobBits}${r.keyBitsBob.length > show ? '…' : ''}</p>
			<div class="bit-grid" aria-label="First ${show} key bits coloured by Alice/Bob agreement">${cells.join('')}</div>
			<p class="${statusClass}">Key agreement: <strong>${agreementPct}%</strong> measured · <strong>${expectedPct}%</strong> expected · ${r.keyBitsAlice.length.toLocaleString()} sifted bits.</p>
			<p class="section-footnote">When the channel is clean, the singlet gives perfectly anti-correlated outcomes at aligned bases — Bob flips his bits and they agree exactly. Intercept-resend, depolarizing noise, and analyzer misalignment all degrade this in their own characteristic way.</p>
		</div>
	`;
}

function renderTranscript(r: E91Result): string {
	const rows = r.transcript
		.map((row) => {
			return `
				<tr class="transcript-row transcript-row--${row.bucket.toLowerCase()}">
					<td class="mono-cell">${row.round}</td>
					<td class="mono-cell"><span class="bucket-tag bucket-tag--${row.bucket.toLowerCase()}">${row.bucket}</span></td>
					<td class="mono-cell">${row.bucket === 'CHSH' ? `a${row.aliceAngleIdx + 1}` : 'key'} · ${radToDeg(row.aliceAngle)}°</td>
					<td class="mono-cell">${row.bucket === 'CHSH' ? `b${row.bobAngleIdx + 1}` : 'key'} · ${radToDeg(row.bobAngle)}°</td>
					<td class="mono-cell">${row.A === 1 ? '+1' : '−1'}</td>
					<td class="mono-cell">${row.B === 1 ? '+1' : '−1'}</td>
					<td class="mono-cell">${row.product === 1 ? '+1' : '−1'}</td>
				</tr>
			`;
		})
		.join('');
	return `
		<h3 class="subhead">Round-by-round transcript (first ${r.transcript.length})</h3>
		<div class="table-shell">
			<table class="math-table transcript-table">
				<thead>
					<tr>
						<th scope="col">#</th>
						<th scope="col">Bucket</th>
						<th scope="col">Alice (idx · angle)</th>
						<th scope="col">Bob (idx · angle)</th>
						<th scope="col">A</th>
						<th scope="col">B</th>
						<th scope="col">A·B</th>
					</tr>
				</thead>
				<tbody>${rows}</tbody>
			</table>
		</div>
		<p class="section-footnote">CHSH rounds contribute their A·B to the appropriate E(aᵢ,bⱼ) sum. Key rounds — both analyzers at π/4 — produce sifted-key bits (Bob flips B). Under misalignment, Bob's angle column shows the actual (offset) angle.</p>
	`;
}

// --- 3. The Bell test explained ------------------------------------------

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
				<p class="panel-copy">Why entanglement makes eavesdropping visible: the inequality, the angles, what noise and misalignment look like, and the protocol step by step.</p>
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
	const N = 121;
	const xs: number[] = [];
	const ys: number[] = [];
	for (let i = 0; i < N; i++) {
		const t = i / (N - 1);
		const delta = -Math.PI / 2 + t * Math.PI;
		xs.push(delta);
		ys.push(correlation(0, -delta));
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
			<p class="panel-copy">The singlet's correlation function, with the four CHSH measurement angles marked. The two analyzer settings on each side are chosen so that the four points land at ±1/√2 — exactly where |S| reaches Tsirelson's bound.</p>
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

// --- 4. E91 vs BB84 ------------------------------------------------------

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

// --- 5. In the real world -----------------------------------------------

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

// --- 6. Sources / further reading ---------------------------------------

function renderSources(): HTMLElement {
	const section = el('section', 'lab-section');
	section.id = 'sources';
	section.setAttribute('aria-labelledby', 'sources-heading');

	const refs = REFERENCES.map((r) => {
		const titleHtml = r.url
			? `<a class="ref-title" href="${r.url}" rel="noopener">${escapeHtml(r.title)}</a>`
			: `<span class="ref-title">${escapeHtml(r.title)}</span>`;
		return `
			<li class="ref-row">
				<p class="ref-meta">${escapeHtml(r.tag)} · ${escapeHtml(r.authors)}</p>
				<p>${titleHtml}</p>
				<p class="ref-venue">${escapeHtml(r.venue)} (${r.year})</p>
			</li>
		`;
	}).join('');

	const further = FURTHER_READING.map(
		(f) => `
			<li class="ref-row">
				<p><a class="ref-title" href="${f.url}" rel="noopener">${escapeHtml(f.label)}</a></p>
				<p class="ref-venue">${escapeHtml(f.note)}</p>
			</li>
		`,
	).join('');

	section.innerHTML = `
		<div class="section-heading-row">
			<div>
				<p class="section-kicker">Section · 5</p>
				<h2 id="sources-heading">Sources & further reading</h2>
				<p class="panel-copy">Original papers, the loophole-free experiments, the satellite and device-independent demonstrations, and standard textbooks. Every physics claim on this page traces back to one of these.</p>
			</div>
		</div>
		<div class="sources-grid">
			<div>
				<h3 class="subhead">Primary references</h3>
				<ul class="refs-list">${refs}</ul>
			</div>
			<div>
				<h3 class="subhead">Further reading</h3>
				<ul class="refs-list">${further}</ul>
				<div class="caveat-box">
					<p class="hero-metric-label">What this simulation does and does not model</p>
					<p class="panel-copy">
						<strong>Models:</strong> singlet-state quantum correlations,
						intercept-resend Eve, depolarizing noise, fixed analyzer offset, photon
						loss as a uniform efficiency η. Outputs include 95% confidence
						intervals on |S| and per-correlation standard errors.
					</p>
					<p class="panel-copy">
						<strong>Does not model:</strong> finite-key security corrections,
						decoy-state analysis, detector dark counts, time-binning, polarization
						drift, side-channel attacks, or any device-physics outside the idealized
						polarizer model. For experimental QKD security proofs see Renner (2005)
						and the device-independent QKD references above.
					</p>
				</div>
			</div>
		</div>
	`;
	return section;
}

// --- 7. Footer (scripture) ----------------------------------------------

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
				<p class="panel-copy">Educational simulation of the standard textbook E91 model with selectable channel scenarios and statistical verdict. Idealized — see the "What this simulation does and does not model" note above for the limits.</p>
			</div>
		</div>
		<p class="scripture">"So whether you eat or drink or whatever you do, do it all for the glory of God." — 1 Corinthians 10:31</p>
	`;
	return footer;
}

// --- mountApp ------------------------------------------------------------

export function mountApp(root: HTMLDivElement): void {
	const initial = decodeStateHash(window.location.hash);

	const shell = el('div', 'page-shell');
	shell.id = 'playground-heading';

	shell.appendChild(renderHero());
	const { node: runNode, api: runApi } = renderRunProtocol(initial);
	shell.appendChild(runNode);
	shell.appendChild(renderBellExplained());
	shell.appendChild(renderVsBb84());
	shell.appendChild(renderRealWorld());
	shell.appendChild(renderSources());
	shell.appendChild(renderFooter());

	root.replaceChildren(shell);

	// URL hash <-> run state two-way binding. Skip programmatic updates to
	// avoid a feedback loop.
	let suppress = false;
	runApi.onStateChange((state) => {
		if (suppress) return;
		const newHash = encodeStateHash(state);
		if (window.location.hash !== newHash) {
			history.replaceState(null, '', newHash);
		}
	});

	window.addEventListener('hashchange', () => {
		suppress = true;
		runApi.applyState(decodeStateHash(window.location.hash));
		suppress = false;
	});
}
