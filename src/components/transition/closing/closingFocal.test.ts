// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { transitionMotion } from '../transitionMotion';
import { CLOSING_FOCAL_SELECTOR, resolveFocalPoint } from './closingFocal';

const place = (element: HTMLElement, rect: Partial<DOMRect>) => {
	element.getBoundingClientRect = () =>
		({ left: 0, top: 0, width: 0, height: 0, ...rect }) as DOMRect;
};

const focalElement = (name: string, rect: Partial<DOMRect>) => {
	const element = document.createElement('div');
	element.setAttribute('data-closing-focal', name);
	place(element, rect);
	document.body.appendChild(element);
	return element;
};

/**
 * ORISO-Frontend#1737. The room is gone when the animation looks for where to
 * end, so the destination marks its own element and the animation waits for it.
 */
describe('resolveFocalPoint', () => {
	beforeEach(() => {
		vi.useFakeTimers({ toFake: ['Date', 'requestAnimationFrame'] });
	});
	afterEach(() => {
		vi.useRealTimers();
		document.body.innerHTML = '';
	});

	it('names one selector per focal point, so a room cannot invent its own', () => {
		expect(CLOSING_FOCAL_SELECTOR.messageField).toBe(
			'[data-closing-focal="message-field"]'
		);
		expect(CLOSING_FOCAL_SELECTOR.call).toBe('[data-closing-focal="call"]');
	});

	it('ends on the centre of the marked element', async () => {
		const field = focalElement('message-field', {
			left: 100,
			top: 600,
			width: 400,
			height: 80
		});
		const point = await resolveFocalPoint(document, 'messageField');
		expect(point).toEqual({ x: 300, y: 640, element: field });
	});

	it('picks the call element for a video call, not the message field', async () => {
		focalElement('message-field', {
			left: 0,
			top: 0,
			width: 10,
			height: 10
		});
		const call = focalElement('call', {
			left: 200,
			top: 100,
			width: 600,
			height: 400
		});
		const point = await resolveFocalPoint(document, 'call');
		expect(point.element).toBe(call);
		expect(point).toMatchObject({ x: 500, y: 300 });
	});

	it('waits for the destination to appear after the swap', async () => {
		const pending = resolveFocalPoint(document, 'messageField');
		await vi.advanceTimersByTimeAsync(80);
		const field = focalElement('message-field', {
			left: 0,
			top: 700,
			width: 200,
			height: 100
		});
		await vi.advanceTimersByTimeAsync(40);
		expect((await pending).element).toBe(field);
	});

	it('does not end on an element that has no size yet', async () => {
		focalElement('message-field', { width: 0, height: 0 });
		const pending = resolveFocalPoint(document, 'messageField');
		await vi.advanceTimersByTimeAsync(
			transitionMotion.closing.focalWaitMs + 100
		);
		expect((await pending).element).toBeNull();
	});

	it('gives up after the wait and ends near the bottom of the screen instead', async () => {
		const pending = resolveFocalPoint(document, 'messageField');
		await vi.advanceTimersByTimeAsync(
			transitionMotion.closing.focalWaitMs + 100
		);
		const point = await pending;
		expect(point.element).toBeNull();
		expect(point.x).toBe(window.innerWidth / 2);
		expect(point.y).toBeCloseTo(window.innerHeight * 0.82);
	});
});
