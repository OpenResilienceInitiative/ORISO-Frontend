// @vitest-environment oriso-jsdom
import React, { useLayoutEffect, useRef, useState } from 'react';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vite-plus/test';
import { useEditorResize } from './useEditorResize';

const Probe = () => {
	const editor = useRef<HTMLDivElement>(null);
	const [measurements, setMeasurements] = useState(0);
	const observe = useEditorResize(() =>
		setMeasurements((value) => value + 1)
	);
	useLayoutEffect(() => {
		if (editor.current) observe(editor.current);
	}, [observe]);
	return (
		<>
			<div ref={editor}>
				<div className="ProseMirror" />
			</div>
			<output>{measurements}</output>
		</>
	);
};

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

it('re-measures a late editor resize once on the next frame and cancels on unmount', () => {
	let resize!: () => void;
	const observed: Element[] = [];
	const frames = new Map<number, FrameRequestCallback>();
	let nextFrame = 0;
	vi.spyOn(window, 'requestAnimationFrame').mockImplementation((fn) => {
		frames.set(++nextFrame, fn);
		return nextFrame;
	});
	vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((id) => {
		frames.delete(id);
	});
	const disconnect = vi.fn();
	vi.stubGlobal(
		'ResizeObserver',
		class {
			constructor(callback: () => void) {
				resize = callback;
			}
			observe(element: Element) {
				observed.push(element);
			}
			disconnect = disconnect;
		}
	);
	const view = render(<Probe />);
	expect(observed).toEqual([view.container.querySelector('.ProseMirror')]);
	act(() => {
		resize();
		resize();
	});
	expect(screen.getByText('0')).toBeTruthy();
	expect(frames.size).toBe(1);
	act(() => {
		const pending = [...frames.values()];
		frames.clear();
		pending.forEach((fn) => fn(0));
	});
	expect(screen.getByText('1')).toBeTruthy();
	act(() => resize());
	view.unmount();
	expect(disconnect).toHaveBeenCalledOnce();
	expect(frames.size).toBe(0);
});

it('corrects a stale late measurement while retaining multiline growth and manual height', async () => {
	const { calculateAutoComposerHeight, getEffectiveComposerHeight } =
		await import('./inputField/composerResize');
	let resize!: () => void;
	let frame!: FrameRequestCallback;
	vi.spyOn(window, 'requestAnimationFrame').mockImplementation((fn) => {
		frame = fn;
		return 1;
	});
	vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
	vi.stubGlobal(
		'ResizeObserver',
		class {
			constructor(callback: () => void) {
				resize = callback;
			}
			observe() {}
			disconnect() {}
		}
	);
	let contentHeight = 19.6;
	let chromeHeight = 86;
	const bounds = { minHeight: 106, maxHeight: 500 };
	const HeightProbe = ({ manual }: { manual: number | null }) => {
		const editor = useRef<HTMLDivElement>(null);
		const [automatic, setAutomatic] = useState<number | null>(108);
		const observe = useEditorResize(() => {
			const next = calculateAutoComposerHeight({
				contentHeight,
				lineHeight: 19.6,
				composerChromeHeight: chromeHeight,
				bounds
			});
			setAutomatic(next > bounds.minHeight ? next : null);
		});
		useLayoutEffect(() => {
			if (editor.current) observe(editor.current);
		}, [observe]);
		return (
			<>
				<div ref={editor}>
					<div className="ProseMirror" />
				</div>
				<output>
					{getEffectiveComposerHeight(
						manual,
						automatic,
						bounds.minHeight
					) ?? bounds.minHeight}
				</output>
			</>
		);
	};
	const view = render(<HeightProbe manual={null} />);
	expect(screen.getByText('108')).toBeTruthy();
	act(() => {
		resize();
		frame(0);
	});
	expect(screen.getByText('106')).toBeTruthy();
	contentHeight = 39.2;
	act(() => {
		resize();
		frame(0);
	});
	expect(screen.getByText('125')).toBeTruthy();
	view.rerender(<HeightProbe manual={160} />);
	contentHeight = 19.6;
	act(() => {
		resize();
		frame(0);
	});
	expect(screen.getByText('160')).toBeTruthy();
});

it('attaches to an editor mounted later and switches to a replacement', async () => {
	const observed: Element[] = [];
	const disconnect = vi.fn();
	vi.stubGlobal(
		'ResizeObserver',
		class {
			observe(element: Element) {
				observed.push(element);
			}
			disconnect = disconnect;
		}
	);
	const LateEditor = () => {
		const observe = useEditorResize(() => {});
		return <div ref={observe} />;
	};
	const view = render(<LateEditor />);
	const container = view.container.firstElementChild as HTMLElement;
	expect(observed).toHaveLength(0);
	const first = document.createElement('div');
	first.className = 'ProseMirror';
	act(() => container.appendChild(first));
	await waitFor(() => expect(observed).toEqual([first]));
	const second = document.createElement('div');
	second.className = 'ProseMirror';
	act(() => container.replaceChild(second, first));
	await waitFor(() => expect(observed).toEqual([first, second]));
	expect(disconnect).toHaveBeenCalled();
});

it('keeps observing after StrictMode effect replay', () => {
	let resize!: () => void;
	let frame!: FrameRequestCallback;
	vi.spyOn(window, 'requestAnimationFrame').mockImplementation((fn) => {
		frame = fn;
		return 1;
	});
	vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
	vi.stubGlobal(
		'ResizeObserver',
		class {
			connected = false;
			constructor(callback: () => void) {
				resize = () => {
					if (this.connected) callback();
				};
			}
			observe() {
				this.connected = true;
			}
			disconnect() {
				this.connected = false;
			}
		}
	);
	const CallbackProbe = () => {
		const [measurements, setMeasurements] = useState(0);
		const observe = useEditorResize(() =>
			setMeasurements((value) => value + 1)
		);
		return (
			<>
				<div ref={observe}>
					<div className="ProseMirror" />
				</div>
				<output>{measurements}</output>
			</>
		);
	};
	render(
		<React.StrictMode>
			<CallbackProbe />
		</React.StrictMode>
	);
	act(() => {
		resize();
		frame(0);
	});
	expect(screen.getByText('1')).toBeTruthy();
});
