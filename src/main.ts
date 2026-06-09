import './style.css';
import './extra.css';
import { runE91 } from './engine.ts';
import { mountApp } from './ui.ts';

// Dev-only self-test. Surfaces engine correctness in the console so the
// deployed build stays quiet but the dev environment shouts on regression.
if (import.meta.env.DEV) {
	console.group('crypto-lab-e91: engine self-test');
	const clean = runE91({ rounds: 20000, eve: false, seed: 1 });
	const tsirelson = 2 * Math.sqrt(2);
	const cleanS = Math.abs(clean.S);
	const cleanPass = Math.abs(cleanS - tsirelson) < 0.1 && !clean.eavesdropperDetected;
	console.log(
		`no Eve : |S| = ${cleanS.toFixed(4)}  (target 2√2 ≈ ${tsirelson.toFixed(4)})  detected=${clean.eavesdropperDetected}  →  ${cleanPass ? 'PASS' : 'FAIL'}`,
	);

	const tampered = runE91({ rounds: 20000, eve: true, seed: 1 });
	const tamperedS = Math.abs(tampered.S);
	const tamperedPass = tampered.eavesdropperDetected;
	console.log(
		`with Eve: |S| = ${tamperedS.toFixed(4)}  (collapsed)               detected=${tampered.eavesdropperDetected}  →  ${tamperedPass ? 'PASS' : 'FAIL'}`,
	);
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
