// @vitest-environment oriso-jsdom
import React, { useRef } from 'react';
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vite-plus/test';
import { useComposerDock } from './useComposerDock';
import { createTheme, ThemeProvider } from '@mui/material/styles';

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

it.each([8, 10])(
	'reserves the visible composer using the theme spacing unit %s and releases it when the chat closes',
	(spacing) => {
		vi.stubGlobal(
			'ResizeObserver',
			class {
				observe() {}
				unobserve() {}
				disconnect() {}
			}
		);
		vi.spyOn(
			HTMLElement.prototype,
			'getBoundingClientRect'
		).mockReturnValue({
			x: 16,
			y: 500,
			top: 500,
			bottom: 700,
			left: 16,
			right: 374,
			width: 358,
			height: 200,
			toJSON: () => ({})
		});
		vi.stubGlobal('innerHeight', 844);
		const view = render(
			<ThemeProvider theme={createTheme({ spacing })}>
				<Probe />
			</ThemeProvider>
		);
		// 344 px occupied below the dock's top plus two theme spacing units.
		expect(
			document.documentElement.style.getPropertyValue(
				'--oriso-composer-bottom-clearance'
			)
		).toBe(`${344 + spacing * 2}px`);
		view.unmount();
		expect(
			document.documentElement.style.getPropertyValue(
				'--oriso-composer-bottom-clearance'
			)
		).toBe('');
	}
);

it('measures the timeline and composer together when the composer is in flow', () => {
	vi.stubGlobal(
		'ResizeObserver',
		class {
			observe() {}
			unobserve() {}
			disconnect() {}
		}
	);
	vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
		function (this: HTMLElement) {
			const height = this.classList.contains('preview-timeline')
				? 430
				: this.classList.contains('textarea__wrapper-send-message')
					? 100
					: this.classList.contains('preview-composer')
						? 140
						: 148;
			return { height } as DOMRect;
		}
	);
	const PreviewProbe = () => {
		const dock = useRef<HTMLDivElement>(null);
		const timeline = useRef<HTMLDivElement>(null);
		const height = useComposerDock(dock, timeline);
		return (
			<div>
				<div className="preview-timeline" ref={timeline} />
				<div className="session">
					<div className="preview-composer" ref={dock}>
						<div className="textarea__wrapper-send-message" />
					</div>
				</div>
				<output>{height}</output>
			</div>
		);
	};
	const view = render(<PreviewProbe />);
	expect(view.container.querySelector('output')?.textContent).toBe('530');
});
