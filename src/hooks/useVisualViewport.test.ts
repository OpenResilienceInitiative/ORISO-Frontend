// @vitest-environment jsdom
/**
 * #1248 — the maximised composer has to size itself to the part of the screen
 * the user can actually see, which on iOS Safari is not the layout viewport.
 */
import { renderHook, act } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useVisualViewport } from './useVisualViewport';

type Listener = () => void;

/** Minimal stand-in for `window.visualViewport`. */
const stubViewport = (height: number, offsetTop = 0) => {
	const listeners: Record<string, Listener[]> = { resize: [], scroll: [] };
	const viewport = {
		height,
		offsetTop,
		addEventListener: (type: string, fn: Listener) => {
			listeners[type]?.push(fn);
		},
		removeEventListener: (type: string, fn: Listener) => {
			listeners[type] = (listeners[type] || []).filter((l) => l !== fn);
		}
	};
	vi.stubGlobal('visualViewport', viewport);
	return {
		viewport,
		listeners,
		emit: (type: string) => listeners[type]?.forEach((fn) => fn())
	};
};

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('useVisualViewport', () => {
	it('reports the visible height and the keyboard inset', () => {
		// iPhone-ish: 844 tall, keyboard eating the lower 380.
		vi.stubGlobal('innerHeight', 844);
		stubViewport(464);

		const { result } = renderHook(() => useVisualViewport());

		expect(result.current).toEqual({
			height: 464,
			offsetTop: 0,
			bottomInset: 380
		});
	});

	it('reports no inset when nothing covers the viewport', () => {
		vi.stubGlobal('innerHeight', 844);
		stubViewport(844);

		const { result } = renderHook(() => useVisualViewport());

		expect(result.current?.bottomInset).toBe(0);
	});

	// iOS shifts the visual viewport inside the layout one rather than only
	// resizing it, so `scroll` has to be listened to as well as `resize`.
	it('follows the viewport as the keyboard opens and closes', () => {
		vi.stubGlobal('innerHeight', 844);
		const { viewport, emit, listeners } = stubViewport(844);

		const { result } = renderHook(() => useVisualViewport());
		expect(result.current?.height).toBe(844);
		expect(listeners.scroll).toHaveLength(1);

		act(() => {
			viewport.height = 464;
			viewport.offsetTop = 40;
			emit('resize');
		});
		expect(result.current).toEqual({
			height: 464,
			offsetTop: 40,
			bottomInset: 340
		});

		act(() => {
			viewport.height = 844;
			viewport.offsetTop = 0;
			emit('scroll');
		});
		expect(result.current?.height).toBe(844);
		expect(result.current?.bottomInset).toBe(0);
	});

	// Older Safari and jsdom have no API; callers fall back to 100dvh.
	it('returns null when the API is missing', () => {
		vi.stubGlobal('visualViewport', undefined);

		const { result } = renderHook(() => useVisualViewport());

		expect(result.current).toBeNull();
	});

	it('detaches its listeners when it stops being needed', () => {
		vi.stubGlobal('innerHeight', 844);
		const { listeners } = stubViewport(844);

		const { result, rerender } = renderHook(
			({ active }) => useVisualViewport(active),
			{ initialProps: { active: true } }
		);
		expect(listeners.resize).toHaveLength(1);

		rerender({ active: false });

		expect(listeners.resize).toHaveLength(0);
		expect(listeners.scroll).toHaveLength(0);
		expect(result.current).toBeNull();
	});
});
