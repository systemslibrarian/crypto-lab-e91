import './style.css';
import './extra.css';
import { runE91 } from './engine.ts';
import { mountApp } from './ui.ts';

// Dev-only self-test. Mirrors the comprehensive node-test suite at
// scripts/engine.test.mjs but runs in the browser console so regressions
// surface immediately during development. Tests are deterministic via
// seeded RNG; CI is the source of truth.
if (import.meta.env.DEV) {
	console.group('crypto-lab-e91: engine self-test');
	const tsirelson = 2 * Math.sqrt(2);
	const sqrt2 = Math.SQRT2;

	const checks: { label: string; ok: boolean; detail: string }[] = [];
	const expect = (label: string, ok: boolean, detail: string) =>
		checks.push({ label, ok, detail });

	const clean = runE91({ rounds: 20000, scenario: 'ideal', seed: 1 });
	expect(
		'ideal: |S| ~ 2√2',
		Math.abs(Math.abs(clean.S) - tsirelson) < 0.1 && clean.verdict.classification === 'secure',
		`|S|=${Math.abs(clean.S).toFixed(4)} target=${tsirelson.toFixed(4)} verdict=${clean.verdict.classification}`,
	);

	const eve = runE91({ rounds: 20000, scenario: 'eve', seed: 1 });
	expect(
		'eve: |S| ~ √2, compromised',
		Math.abs(Math.abs(eve.S) - sqrt2) < 0.1 && eve.verdict.classification === 'compromised',
		`|S|=${Math.abs(eve.S).toFixed(4)} verdict=${eve.verdict.classification}`,
	);

	const noisy = runE91({
		rounds: 20000,
		scenario: { id: 'noisy', noiseP: 0.5 },
		seed: 2,
	});
	expect(
		'noisy p=0.5: |S| ~ √2',
		Math.abs(Math.abs(noisy.S) - sqrt2) < 0.15,
		`|S|=${Math.abs(noisy.S).toFixed(4)}`,
	);

	const misaligned = runE91({
		rounds: 20000,
		scenario: { id: 'misaligned', misalignRad: (30 * Math.PI) / 180 },
		seed: 3,
	});
	expect(
		'misaligned 30°: |S| ~ 2√2·cos(60°) = √2',
		Math.abs(Math.abs(misaligned.S) - sqrt2) < 0.15,
		`|S|=${Math.abs(misaligned.S).toFixed(4)}`,
	);

	const lossy = runE91({
		rounds: 20000,
		scenario: { id: 'lossy', lossEta: 0.5 },
		seed: 4,
	});
	expect(
		'lossy η=0.5: effectiveRounds ~ rounds·η²',
		Math.abs(lossy.effectiveRounds - 5000) < 400,
		`effectiveRounds=${lossy.effectiveRounds}`,
	);

	const allPass = checks.every((c) => c.ok);
	for (const c of checks) {
		console.log(`${c.ok ? '✓' : '✗'} ${c.label} — ${c.detail}`);
	}
	console.log(allPass ? 'all checks passed' : 'SOME CHECKS FAILED');
	console.groupEnd();
}

mountApp(document.querySelector<HTMLDivElement>('#app')!);

(function initThemeToggle() {
	const button = document.getElementById('theme-toggle') as HTMLButtonElement | null;
	if (!button) return;

	function apply(theme: string): void {
		document.documentElement.setAttribute('data-theme', theme);
		localStorage.setItem('theme', theme);
		const isDark = theme === 'dark';
		button!.textContent = isDark ? '\u{1F319}' : '☀️';
		button!.setAttribute('aria-label', isDark ? 'Switch to light mode' : 'Switch to dark mode');
	}

	const current = document.documentElement.getAttribute('data-theme') ?? 'dark';
	apply(current);

	button.addEventListener('click', () => {
		const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
		apply(next);
	});
})();
