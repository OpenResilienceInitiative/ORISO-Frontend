// @vitest-environment jsdom
import * as React from 'react';
import { useState } from 'react';
import {
	act,
	cleanup,
	fireEvent,
	render,
	screen
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ComposerToolbar } from './ComposerToolbar';
import {
	ModalContext,
	TOverlay
} from '../../../globalState/context/ModalContext';
import { OVERLAY_E2EE } from '../../../globalState/interfaces/AppConfig/OverlaysConfigInterface';

afterEach(() => cleanup());

const translate = ((_key: string, fallback?: string) =>
	fallback ?? _key) as any;

const ACTIVE_OVERLAY: TOverlay = { id: 'test-overlay', name: OVERLAY_E2EE };

/**
 * Exposes a way to flip `ModalContext.overlays` from empty to non-empty
 * *after* the toolbar has already rendered/opened a menu — the actual
 * reproduction of #458 (an overlay appearing while a floating composer menu
 * is already open), not just a menu that never had the chance to open under
 * an active overlay.
 */
const Harness = ({
	onAction = vi.fn()
}: {
	onAction?: (action: string) => void;
}) => {
	const [overlays, setOverlays] = useState<TOverlay[]>([]);

	return (
		<ModalContext.Provider
			value={{
				overlays,
				setOverlays,
				addOverlay: vi.fn(),
				removeOverlay: vi.fn()
			}}
		>
			<button
				type="button"
				aria-label="simulate overlay"
				onClick={() => setOverlays([ACTIVE_OVERLAY])}
			/>
			<ComposerToolbar
				direction="up"
				isMobile={false}
				isExpanded={false}
				onAction={onAction}
				isActionSelected={() => false}
				onCollapse={vi.fn()}
				onExpandToggle={vi.fn()}
				translate={translate}
			/>
		</ModalContext.Provider>
	);
};

const openTextStyleMenu = () =>
	fireEvent.click(screen.getByRole('button', { name: 'Text style' }));

const simulateOverlay = () =>
	act(() => {
		fireEvent.click(screen.getByLabelText('simulate overlay'));
	});

describe('ComposerToolbar floating menu vs. overlay transitions (#458)', () => {
	it('closes an open menu as soon as an overlay becomes active', () => {
		render(<Harness />);
		openTextStyleMenu();
		expect(screen.getByRole('menu')).toBeInTheDocument();

		simulateOverlay();

		expect(screen.queryByRole('menu')).not.toBeInTheDocument();
	});

	it('stays open while no overlay is active', () => {
		render(<Harness />);
		openTextStyleMenu();

		expect(screen.getByRole('menu')).toBeInTheDocument();
	});

	it('opens and works normally with no ModalProvider in the tree at all', () => {
		const onAction = vi.fn();
		render(
			<ComposerToolbar
				direction="up"
				isMobile={false}
				isExpanded={false}
				onAction={onAction}
				isActionSelected={() => false}
				onCollapse={vi.fn()}
				onExpandToggle={vi.fn()}
				translate={translate}
			/>
		);
		openTextStyleMenu();

		expect(screen.getByRole('menu')).toBeInTheDocument();
		fireEvent.click(
			screen.getByRole('menuitemradio', { name: 'Normal text' })
		);
		expect(onAction).toHaveBeenCalledWith('paragraph');
	});
});
