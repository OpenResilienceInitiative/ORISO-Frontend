// @vitest-environment jsdom
import * as React from 'react';
import { createRef } from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TipTapComposer, TipTapComposerRef } from './TipTapComposer';

// TipTap's focus command lands in a requestAnimationFrame, not in the call.
// Frames are queued and flushed by hand so the test does not ride on
// jsdom's frame timer.
const frames: FrameRequestCallback[] = [];

beforeEach(() => {
	frames.length = 0;
	vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
		frames.push(callback);
		return frames.length;
	});
	vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
});

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
});

const nextFrames = async (count = 2) => {
	for (let i = 0; i < count; i += 1) {
		frames.splice(0).forEach((callback) => callback(0));
		await Promise.resolve();
	}
};

const renderBesideAnInput = () => {
	const ref = createRef<TipTapComposerRef>();
	render(
		<>
			<input data-testid="elsewhere" />
			<TipTapComposer
				ref={ref}
				value="<p>Entwurf</p>"
				placeholder="test"
				showToolbar={false}
				readOnly={false}
				onChange={() => {}}
				onSubmitShortcut={() => {}}
			/>
		</>
	);
	return ref;
};

describe('TipTapComposer focus ownership', () => {
	it('resets the alignment without taking focus — not now, not a frame later', async () => {
		const ref = renderBesideAnInput();
		await waitFor(() => expect(ref.current).toBeTruthy());
		const elsewhere = screen.getByTestId('elsewhere');
		// A plain paragraph already counts as left; start from centre so a
		// no-op reset cannot pass.
		ref.current!.runAction('alignCenter');
		await nextFrames();
		expect(ref.current!.isActionActive('alignCenter')).toBe(true);
		elsewhere.focus();

		ref.current!.resetTextAlign();
		await nextFrames();

		expect(document.activeElement).toBe(elsewhere);
		expect(ref.current!.isActionActive('alignLeft')).toBe(true);
	});

	// Why the automatic focus must not use it: the toolbar action focuses a
	// frame after the call, past any check made at call time.
	it('runAction("alignLeft") pulls focus in a later frame', async () => {
		const ref = renderBesideAnInput();
		await waitFor(() => expect(ref.current).toBeTruthy());
		const elsewhere = screen.getByTestId('elsewhere');
		elsewhere.focus();

		ref.current!.runAction('alignLeft');
		expect(document.activeElement).toBe(elsewhere);
		await nextFrames();

		expect(document.activeElement).not.toBe(elsewhere);
	});
});
