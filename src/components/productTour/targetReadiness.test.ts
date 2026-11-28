// @vitest-environment oriso-jsdom
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { bringTargetIntoView, waitForTarget } from './targetReadiness';

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

describe('waitForTarget malformed selectors', () => {
	it('resolves false instead of rejecting on an invalid selector', async () => {
		await expect(
			waitForTarget(':::not-a-selector', { timeoutMs: 40 })
		).resolves.toBe(false);
	});
});

describe('bringTargetIntoView', () => {
	const target = (rect: Partial<DOMRect>) => {
		const element = document.createElement('div');
		element.getBoundingClientRect = () =>
			({ top: 0, left: 0, bottom: 10, right: 10, ...rect }) as DOMRect;
		element.scrollIntoView = vi.fn();
		return element;
	};

	it('leaves a visible target alone', () => {
		const element = target({ top: 100, bottom: 200 });
		bringTargetIntoView(element);
		expect(element.scrollIntoView).not.toHaveBeenCalled();
	});

	it('scrolls a target below the fold into the middle of its pane', () => {
		const element = target({
			top: window.innerHeight + 50,
			bottom: window.innerHeight + 150
		});
		bringTargetIntoView(element);
		expect(element.scrollIntoView).toHaveBeenCalledWith({
			block: 'center',
			inline: 'nearest'
		});
	});

	it('shows a target taller than the screen from its top', () => {
		const element = target({ top: -300, bottom: window.innerHeight * 3 });
		bringTargetIntoView(element);
		expect(element.scrollIntoView).toHaveBeenCalledWith({
			block: 'start',
			inline: 'nearest'
		});
	});

	it('ignores a missing target', () => {
		expect(() => bringTargetIntoView(null)).not.toThrow();
	});

	/**
	 * FE#2545: on a 1440 px desktop the Zeitstrahl's chip row is wider than
	 * its 376 px scroller, so "Alle als gelesen markieren" sits inside the
	 * window but cut off by the row. The spotlight would light an invisible
	 * button; the row is scrolled first, at once, because the scroller
	 * animates (`scroll-behavior: smooth`) and the spotlight is measured
	 * right after.
	 */
	const scroller = (rect: Partial<DOMRect>, overflowX: string) => {
		const element = document.createElement('div');
		element.style.overflowX = overflowX;
		element.getBoundingClientRect = () =>
			({ top: 80, bottom: 150, ...rect }) as DOMRect;
		Object.defineProperty(element, 'scrollWidth', { value: 496 });
		Object.defineProperty(element, 'clientWidth', { value: 376 });
		document.body.appendChild(element);
		return element;
	};

	it('scrolls a chip row at once when it cuts the target off', () => {
		const row = scroller({ left: 97, right: 473 }, 'auto');
		const element = target({ top: 92, bottom: 140, left: 545, right: 593 });
		row.appendChild(element);
		bringTargetIntoView(element);
		expect(element.scrollIntoView).toHaveBeenCalledWith({
			block: 'nearest',
			inline: 'nearest',
			behavior: 'instant'
		});
	});

	it('leaves a target alone that its scrolling row shows in full', () => {
		const row = scroller({ left: 97, right: 473 }, 'auto');
		const element = target({ top: 92, bottom: 140, left: 377, right: 425 });
		row.appendChild(element);
		bringTargetIntoView(element);
		expect(element.scrollIntoView).not.toHaveBeenCalled();
	});

	it('does not scroll a container that only hides its overflow', () => {
		const row = scroller({ left: 97, right: 473 }, 'hidden');
		const element = target({ top: 92, bottom: 140, left: 545, right: 593 });
		row.appendChild(element);
		bringTargetIntoView(element);
		expect(element.scrollIntoView).not.toHaveBeenCalled();
	});
});
