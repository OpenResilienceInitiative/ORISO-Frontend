// @vitest-environment oriso-jsdom
import { expect, it } from 'vite-plus/test';

it('same real body observer disconnects before owned DOM cleanup', () => {
	const child = document.createElement('div');
	child.dataset.probe = 'owned-clean-observer';
	document.body.appendChild(child);
	const observer = new MutationObserver(() => {
		document.querySelector('[data-probe="owned-clean-observer"]');
	});
	observer.observe(document.body, { childList: true, subtree: true });
	expect(document.body.contains(child)).toBe(true);
	observer.disconnect();
	child.remove();
	expect(document.body.contains(child)).toBe(false);
});

it('ordinary expected console.error remains an ordinary log', () => {
	console.error('Expected task-only diagnostic: ordinary error log');
	expect(true).toBe(true);
});

it('lookalike Uncaught console text remains an ordinary log', () => {
	console.error('Error: Uncaught [ReferenceError: document is not defined]');
	expect(true).toBe(true);
});
