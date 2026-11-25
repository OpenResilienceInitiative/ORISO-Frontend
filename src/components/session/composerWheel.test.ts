// @vitest-environment oriso-jsdom
import { afterEach, describe, expect, it } from 'vite-plus/test';
import { forwardComposerWheel, wheelDeltaPx } from './composerWheel';

/**
 * #2513: a scroll over the composer dock, which sits over the timeline,
 * moves the timeline — unless the composer can scroll that way itself.
 */
const metrics = (
	element: HTMLElement,
	{ top, height, client }: { top: number; height: number; client: number }
) => {
	element.style.overflowY = 'auto';
	let scrollTop = top;
	Object.defineProperty(element, 'scrollTop', {
		configurable: true,
		get: () => scrollTop,
		set: (value: number) => {
			scrollTop = value;
		}
	});
	Object.defineProperty(element, 'scrollHeight', { value: height });
	Object.defineProperty(element, 'clientHeight', { value: client });
};

const setup = () => {
	const pane = document.createElement('div');
	const timeline = document.createElement('div');
	const message = document.createElement('p');
	const dock = document.createElement('div');
	const draft = document.createElement('div');
	const toolbar = document.createElement('div');
	dock.className = 'messageSubmit__wrapper';
	timeline.append(message);
	dock.append(draft, toolbar);
	pane.append(timeline, dock);
	document.body.append(pane);
	metrics(timeline, { top: 600, height: 2000, client: 400 });
	pane.addEventListener('wheel', (event) =>
		forwardComposerWheel(event, pane, timeline)
	);
	const wheel = (target: Element, init: WheelEventInit) => {
		const event = new WheelEvent('wheel', {
			bubbles: true,
			cancelable: true,
			...init
		});
		target.dispatchEvent(event);
		return event;
	};
	return { message, draft, toolbar, timeline, wheel };
};

afterEach(() => {
	document.body.replaceChildren();
});

describe('forwardComposerWheel', () => {
	it('scrolls the timeline up when the wheel turns over the composer', () => {
		const { draft, timeline, wheel } = setup();
		const event = wheel(draft, { deltaY: -40 });
		expect(timeline.scrollTop).toBe(560);
		expect(event.defaultPrevented).toBe(true);
	});

	it('leaves a wheel over the timeline itself to the browser', () => {
		const { message, timeline, wheel } = setup();
		const event = wheel(message, { deltaY: -40 });
		expect(timeline.scrollTop).toBe(600);
		expect(event.defaultPrevented).toBe(false);
	});

	it('leaves a long draft to scroll itself first', () => {
		const { draft, timeline, wheel } = setup();
		metrics(draft, { top: 30, height: 300, client: 100 });
		const event = wheel(draft, { deltaY: -40 });
		expect(timeline.scrollTop).toBe(600);
		expect(event.defaultPrevented).toBe(false);
	});

	it('moves on to the timeline once the draft is at its top', () => {
		const { draft, timeline, wheel } = setup();
		metrics(draft, { top: 0, height: 300, client: 100 });
		wheel(draft, { deltaY: -40 });
		expect(timeline.scrollTop).toBe(560);
	});

	it('keeps a wheel the toolbar already used to scroll sideways', () => {
		const { toolbar, timeline, wheel } = setup();
		toolbar.addEventListener('wheel', (event) => event.preventDefault());
		wheel(toolbar, { deltaY: -40 });
		expect(timeline.scrollTop).toBe(600);
	});

	it('does not scroll on a touchpad pinch-zoom', () => {
		const { draft, timeline, wheel } = setup();
		wheel(draft, { deltaY: -40, ctrlKey: true });
		expect(timeline.scrollTop).toBe(600);
	});
});

describe('wheelDeltaPx', () => {
	it('converts lines and pages to pixels', () => {
		expect(wheelDeltaPx(-3, 0, 400)).toBe(-3);
		expect(wheelDeltaPx(-3, 1, 400)).toBe(-48);
		expect(wheelDeltaPx(-1, 2, 400)).toBe(-400);
	});
});
