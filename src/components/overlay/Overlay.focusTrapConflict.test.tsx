// @vitest-environment jsdom
import * as React from 'react';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import {
	shouldActivateOverlayFocusTrap,
	useForeignMuiModalOpen
} from './useForeignMuiModalOpen';

/**
 * #1326: a MUI `Dialog` (e.g. the key-backup recovery prompt) and Overlay
 * can both be mounted at once, each running its own focus trap. These
 * helpers are what Overlay.tsx uses to release `focus-trap-react` while a
 * foreign modal is open. The test stays on the helpers so jsdom never
 * loads Overlay's Button / globalState / lottie graph.
 */
const Probe = () => {
	const foreignModalOpen = useForeignMuiModalOpen();
	return (
		<div data-testid="trap-active">
			{String(shouldActivateOverlayFocusTrap(true, foreignModalOpen))}
		</div>
	);
};

describe('Overlay focus trap vs. a foreign MUI modal (#1326)', () => {
	afterEach(() => {
		cleanup();
		document
			.querySelectorAll('.MuiModal-root')
			.forEach((el) => el.remove());
	});

	it('keeps the trap active when no foreign modal is present', async () => {
		render(<Probe />);

		expect((await screen.findByTestId('trap-active')).textContent).toBe(
			'true'
		);
	});

	it('releases the trap while a MUI modal (e.g. the key-backup prompt) is open', async () => {
		const muiModal = document.createElement('div');
		muiModal.className = 'MuiModal-root';
		document.body.appendChild(muiModal);

		render(<Probe />);

		expect((await screen.findByTestId('trap-active')).textContent).toBe(
			'false'
		);
	});

	it('re-traps focus once the foreign MUI modal closes', async () => {
		const muiModal = document.createElement('div');
		muiModal.className = 'MuiModal-root';
		document.body.appendChild(muiModal);

		render(<Probe />);
		expect((await screen.findByTestId('trap-active')).textContent).toBe(
			'false'
		);

		act(() => {
			muiModal.remove();
		});

		await waitFor(() =>
			expect(screen.getByTestId('trap-active').textContent).toBe('true')
		);
	});

	it('activates the trap only when Overlay wants one and no foreign modal is open', () => {
		expect(shouldActivateOverlayFocusTrap(true, false)).toBe(true);
		expect(shouldActivateOverlayFocusTrap(true, true)).toBe(false);
		expect(shouldActivateOverlayFocusTrap(false, false)).toBe(false);
	});
});
