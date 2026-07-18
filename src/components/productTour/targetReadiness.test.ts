// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { waitForTarget } from './targetReadiness';

afterEach(() => {
	document.body.innerHTML = '';
});

describe('waitForTarget', () => {
	it('resolves immediately when the target is already in the DOM', async () => {
		document.body.innerHTML =
			'<nav data-tour-target="sessions-archive-tab"></nav>';

		const found = await waitForTarget(
			'[data-tour-target="sessions-archive-tab"]',
			{ timeoutMs: 50 }
		);

		expect(found).toBe(true);
	});

	it('resolves when the target appears before the timeout', async () => {
		const pending = waitForTarget('[data-tour-target="late"]', {
			timeoutMs: 1000,
			pollMs: 5
		});
		setTimeout(() => {
			const el = document.createElement('div');
			el.setAttribute('data-tour-target', 'late');
			document.body.appendChild(el);
		}, 20);

		await expect(pending).resolves.toBe(true);
	});

	it('resolves false after the bounded timeout when the target never appears', async () => {
		const found = await waitForTarget('[data-tour-target="never"]', {
			timeoutMs: 40,
			pollMs: 5
		});

		expect(found).toBe(false);
	});
});
