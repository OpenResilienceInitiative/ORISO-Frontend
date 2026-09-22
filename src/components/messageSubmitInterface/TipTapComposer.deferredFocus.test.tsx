// @vitest-environment jsdom
import * as React from 'react';
import { createRef } from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { TipTapComposer, TipTapComposerRef } from './TipTapComposer';

afterEach(() => cleanup());

// TipTap's focus command lands in a requestAnimationFrame, not in the call.
const nextFrames = async (count = 2) => {
	for (let i = 0; i < count; i += 1) {
		await new Promise((resolve) => requestAnimationFrame(resolve));
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
