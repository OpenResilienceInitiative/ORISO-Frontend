// @vitest-environment oriso-jsdom
import { expect, it } from 'vite-plus/test';

it('real body observer remains until environment teardown', () => {
	const child = document.createElement('div');
	child.dataset.probe = 'owned-late-observer';
	document.body.appendChild(child);
	const observer = new MutationObserver(() => {
		// Actual jsdom.close removes the body child and queues delivery after
		// globals disappear. No emit/error-handler/console simulation.
		document.querySelector('[data-probe="owned-late-observer"]');
	});
	observer.observe(document.body, { childList: true, subtree: true });
	expect(document.body.contains(child)).toBe(true);
	// Deliberate negative fixture: no disconnect/remove/cleanup here.
});
