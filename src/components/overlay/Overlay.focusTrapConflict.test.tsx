// @vitest-environment jsdom
import * as React from 'react';
import { useState } from 'react';
import { act, cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ModalContext, TOverlay } from '../../globalState/context/ModalContext';
import { OVERLAY_TWO_FACTOR_NAG } from '../../globalState/interfaces/AppConfig/OverlaysConfigInterface';
import { BUTTON_TYPES } from '../button/Button';

/**
 * #1326: a MUI `Dialog` (e.g. the key-backup recovery prompt) and this
 * overlay can both be mounted at once, each running its own focus trap —
 * MUI's `FocusTrap` and `focus-trap-react` fight over focus until the call
 * stack overflows. `focus-trap-react` is mocked here so the test asserts on
 * exactly what Overlay.tsx controls (the `active` prop it computes), rather
 * than fighting the real focus-trap library's jsdom limitations.
 */
const activeSpy = vi.fn();
vi.mock('focus-trap-react', () => ({
	default: ({
		active,
		children
	}: {
		active: boolean;
		children: React.ReactNode;
	}) => {
		activeSpy(active);
		return <>{children}</>;
	}
}));

import { Overlay } from './Overlay';

const Harness = () => {
	const [overlays, setOverlays] = useState<TOverlay[]>([]);
	const addOverlay = (overlay: TOverlay) =>
		setOverlays((current) => [...current, overlay]);
	const removeOverlay = (id: string) =>
		setOverlays((current) => current.filter((o) => o.id !== id));

	return (
		<ModalContext.Provider
			value={{ overlays, setOverlays, addOverlay, removeOverlay }}
		>
			<div id="overlay" />
			<Overlay
				name={OVERLAY_TWO_FACTOR_NAG}
				item={{
					headline: 'overlay.headline',
					buttonSet: [{ label: 'ok', type: BUTTON_TYPES.PRIMARY }]
				}}
			/>
		</ModalContext.Provider>
	);
};

describe('Overlay focus trap vs. a foreign MUI modal (#1326)', () => {
	afterEach(() => {
		cleanup();
		activeSpy.mockClear();
		document
			.querySelectorAll('.MuiModal-root')
			.forEach((el) => el.remove());
	});

	beforeEach(() => {
		activeSpy.mockClear();
	});

	it('traps focus when no foreign modal is present', async () => {
		render(<Harness />);

		await waitFor(() => expect(activeSpy).toHaveBeenCalled());
		expect(activeSpy).toHaveBeenLastCalledWith(true);
	});

	it('releases the trap while a MUI modal (e.g. the key-backup prompt) is open', async () => {
		const muiModal = document.createElement('div');
		muiModal.className = 'MuiModal-root';
		document.body.appendChild(muiModal);

		render(<Harness />);

		await waitFor(() => expect(activeSpy).toHaveBeenCalled());
		expect(activeSpy).toHaveBeenLastCalledWith(false);
	});

	it('re-traps focus once the foreign MUI modal closes', async () => {
		const muiModal = document.createElement('div');
		muiModal.className = 'MuiModal-root';
		document.body.appendChild(muiModal);

		render(<Harness />);
		await waitFor(() => expect(activeSpy).toHaveBeenLastCalledWith(false));

		act(() => {
			muiModal.remove();
		});

		await waitFor(() => expect(activeSpy).toHaveBeenLastCalledWith(true));
	});
});
