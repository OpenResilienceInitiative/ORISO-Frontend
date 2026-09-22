// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useKeyboardInset } from './useKeyboardInset';

/**
 * # What this file is for
 *
 * A fixed bottom bar is positioned against the layout viewport, and the
 * software keyboard does not change that viewport — so the bar ends up behind
 * the keyboard on the very screens that have a field in them. This hook is the
 * measurement that lets the bar move; these tests pin down what it must
 * measure and, just as importantly, what it must not react to.
 */

type FakeViewport = {
	height: number;
	offsetTop: number;
	addEventListener: (type: string, listener: () => void) => void;
	removeEventListener: (type: string, listener: () => void) => void;
	emit: (type: string) => void;
	listeners: Record<string, Array<() => void>>;
};

const installViewport = (height: number, offsetTop = 0): FakeViewport => {
	const listeners: Record<string, Array<() => void>> = {};
	const viewport: FakeViewport = {
		height,
		offsetTop,
		listeners,
		addEventListener: (type, listener) => {
			listeners[type] = [...(listeners[type] ?? []), listener];
		},
		removeEventListener: (type, listener) => {
			listeners[type] = (listeners[type] ?? []).filter(
				(entry) => entry !== listener
			);
		},
		emit: (type) =>
			(listeners[type] ?? []).forEach((listener) => listener())
	};

	Object.defineProperty(window, 'visualViewport', {
		value: viewport,
		configurable: true,
		writable: true
	});

	return viewport;
};

const setLayoutHeight = (height: number) =>
	Object.defineProperty(window, 'innerHeight', {
		value: height,
		configurable: true,
		writable: true
	});

/** The hook coalesces reads into one animation frame; run them. */
const flushFrames = async () =>
	act(async () => {
		await new Promise((resolve) => setTimeout(resolve, 32));
	});

afterEach(() => {
	Object.defineProperty(window, 'visualViewport', {
		value: undefined,
		configurable: true,
		writable: true
	});
});

describe('useKeyboardInset', () => {
	it('reports nothing while no keyboard is up', async () => {
		setLayoutHeight(844);
		installViewport(844);

		const { result } = renderHook(() => useKeyboardInset());
		await flushFrames();

		expect(result.current).toBe(0);
	});

	it('reports the covered height once the keyboard opens, and gives it back when it closes', async () => {
		setLayoutHeight(844);
		const viewport = installViewport(844);

		const { result } = renderHook(() => useKeyboardInset());
		await flushFrames();

		// The number pad of the postcode step: 336 px of an iPhone 13 screen.
		viewport.height = 508;
		await act(async () => {
			viewport.emit('resize');
			await new Promise((resolve) => setTimeout(resolve, 32));
		});

		expect(result.current).toBe(336);

		viewport.height = 844;
		await act(async () => {
			viewport.emit('resize');
			await new Promise((resolve) => setTimeout(resolve, 32));
		});

		expect(result.current).toBe(0);
	});

	it('ignores the browser chrome collapsing — that is not a keyboard', async () => {
		setLayoutHeight(844);
		const viewport = installViewport(844);

		const { result } = renderHook(() => useKeyboardInset());
		await flushFrames();

		// Safari's URL bar shrinking away is ~88 px and must not move the bar.
		viewport.height = 756;
		await act(async () => {
			viewport.emit('resize');
			await new Promise((resolve) => setTimeout(resolve, 32));
		});

		expect(result.current).toBe(0);
	});

	it('does not count what is merely scrolled out of sight above', async () => {
		setLayoutHeight(844);
		installViewport(508, 336);

		const { result } = renderHook(() => useKeyboardInset());
		await flushFrames();

		// A pinch-zoomed viewport pushed all the way down: nothing is covered
		// at the bottom, so the bar stays where it is.
		expect(result.current).toBe(0);
	});

	it('reports nothing, and listens to nothing, where the browser cannot tell', async () => {
		setLayoutHeight(844);
		Object.defineProperty(window, 'visualViewport', {
			value: undefined,
			configurable: true,
			writable: true
		});

		const { result, unmount } = renderHook(() => useKeyboardInset());
		await flushFrames();

		expect(result.current).toBe(0);
		expect(() => unmount()).not.toThrow();
	});

	it('stops listening when the bar goes away', async () => {
		setLayoutHeight(844);
		const viewport = installViewport(844);

		const { unmount } = renderHook(() => useKeyboardInset());
		await flushFrames();

		expect(viewport.listeners.resize).toHaveLength(1);

		unmount();

		expect(viewport.listeners.resize).toHaveLength(0);
		expect(viewport.listeners.scroll).toHaveLength(0);
	});
});
