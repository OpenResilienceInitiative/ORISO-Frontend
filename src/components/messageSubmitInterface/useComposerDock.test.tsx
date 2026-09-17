// @vitest-environment jsdom
import React, { useRef } from 'react';
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { useComposerDock } from './useComposerDock';

const Probe = () => {
	const ref = useRef<HTMLDivElement>(null);
	const height = useComposerDock(ref);
	return (
		<div className="sidePanel">
			<div className="sidePanel__timeline" />
			<div ref={ref} />
			<output>{height}</output>
		</div>
	);
};
afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});
it('defers resize-driven layout writes to the next frame and cancels pending work on unmount', () => {
	let resized!: () => void;
	const frames = new Map<number, FrameRequestCallback>();
	let nextFrame = 0;
	vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
		frames.set(++nextFrame, callback);
		return nextFrame;
	});
	vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((id) => {
		frames.delete(id);
	});
	vi.stubGlobal(
		'ResizeObserver',
		class {
			constructor(callback: () => void) {
				resized = callback;
			}
			observe() {}
			unobserve() {}
			disconnect() {}
		}
	);
	let height = 600;
	vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
		() => ({ height }) as DOMRect
	);
	const view = render(<Probe />);
	const host = view.container.firstElementChild as HTMLElement;
	expect(host.style.getPropertyValue('--composer-host-height')).toBe('600px');
	height = 450;
	act(() => {
		resized();
		resized();
	});
	expect(host.style.getPropertyValue('--composer-host-height')).toBe('600px');
	expect(frames.size).toBe(1);
	act(() => {
		const callbacks = [...frames.values()];
		frames.clear();
		callbacks.forEach((callback) => callback(0));
	});
	expect(host.style.getPropertyValue('--composer-host-height')).toBe('450px');
	expect(view.container.querySelector('output')?.textContent).toBe('450');
	act(() => resized());
	view.unmount();
	expect(frames.size).toBe(0);
});
