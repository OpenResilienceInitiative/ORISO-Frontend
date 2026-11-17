// @vitest-environment oriso-jsdom
/**
 * The 1:1 header "+" menu (Frank, 17.11.2026): "Supervisor verwalten" and
 * "Beratung übergeben", each with one line on what happens to the case.
 */
import * as React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { HeaderPlusMenu, plusMenuPosition } from './HeaderPlusMenu';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string) => key })
}));

const renderMenu = (
	props: Partial<React.ComponentProps<typeof HeaderPlusMenu>> = {}
) => {
	const handlers = {
		onSupervision: vi.fn(),
		onHandover: vi.fn(),
		onClose: vi.fn()
	};
	render(
		<HeaderPlusMenu
			anchor={{ left: 100, bottom: 60 }}
			supervisionAvailable
			{...handlers}
			{...props}
		/>
	);
	return handlers;
};

const item = (name: string) =>
	screen.getByRole('menuitem', { name: new RegExp(name) });

describe('HeaderPlusMenu', () => {
	afterEach(cleanup);

	it('offers supervision and handover, each saying what happens to the case', () => {
		renderMenu();
		expect(screen.getByRole('menu').getAttribute('aria-label')).toBe(
			'sessionHeader.supervisor.plusMenu.menuLabel'
		);
		expect(
			item('sessionHeader.supervisor.modal.title').textContent
		).toContain('sessionHeader.supervisor.plusMenu.supervisionHint');
		expect(item('caseHandover.offer.open').textContent).toContain(
			'sessionHeader.supervisor.plusMenu.handoverHint'
		);
	});

	it('opens the handover and closes itself', () => {
		const { onHandover, onClose, onSupervision } = renderMenu();
		fireEvent.click(item('caseHandover.offer.open'));
		expect(onClose).toHaveBeenCalledTimes(1);
		expect(onHandover).toHaveBeenCalledTimes(1);
		expect(onSupervision).not.toHaveBeenCalled();
	});

	it('opens supervision when it is available here', () => {
		const { onSupervision } = renderMenu();
		fireEvent.click(item('sessionHeader.supervisor.modal.title'));
		expect(onSupervision).toHaveBeenCalledTimes(1);
	});

	it('greys supervision with its reason when it is not available, handover stays', () => {
		const { onSupervision } = renderMenu({
			supervisionAvailable: false,
			supervisionUnavailableLabel:
				'Supervisor hinzufügen – hier nicht verfügbar'
		});
		const supervision = item('sessionHeader.supervisor.modal.title');
		expect(supervision.hasAttribute('disabled')).toBe(true);
		expect(supervision.textContent).toContain('hier nicht verfügbar');
		fireEvent.click(supervision);
		expect(onSupervision).not.toHaveBeenCalled();
		expect(item('caseHandover.offer.open').hasAttribute('disabled')).toBe(
			false
		);
	});

	it('closes on Escape and on a press outside', () => {
		const { onClose } = renderMenu();
		fireEvent.keyDown(document, { key: 'Escape' });
		fireEvent.mouseDown(document.body);
		expect(onClose).toHaveBeenCalledTimes(2);
	});

	it('sits below the "+" and stays inside the window', () => {
		expect(plusMenuPosition({ left: 100, bottom: 60 }, 1440)).toEqual({
			top: 68,
			left: 100
		});
		expect(plusMenuPosition({ left: 1300, bottom: 60 }, 1440).left).toBe(
			1440 - 320 - 8
		);
	});
});
