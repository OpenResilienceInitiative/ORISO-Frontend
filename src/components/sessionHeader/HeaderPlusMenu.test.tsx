// @vitest-environment oriso-jsdom
/**
 * The 1:1 header "+" menu (Frank, 17.11.2026): "Supervisor verwalten" and
 * "Beratung übergeben", each with one line on what happens to the case.
 */
import * as React from 'react';
import {
	act,
	cleanup,
	fireEvent,
	render,
	screen
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { HeaderPlusMenu } from './HeaderPlusMenu';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string) => key })
}));

const renderMenu = async (
	props: Partial<React.ComponentProps<typeof HeaderPlusMenu>> = {}
) => {
	const handlers = {
		onSupervision: vi.fn(),
		onHandover: vi.fn(),
		onClose: vi.fn()
	};
	const opener = document.createElement('button');
	document.body.append(opener);
	render(
		<HeaderPlusMenu
			opener={{ current: opener }}
			supervisionAvailable
			{...handlers}
			{...props}
		/>
	);
	await act(async () => {
		await new Promise((resolve) =>
			requestAnimationFrame(() => resolve(undefined))
		);
	});
	return { ...handlers, opener };
};

const item = (name: string) =>
	screen.getByRole('menuitem', { name: new RegExp(name) });

describe('HeaderPlusMenu', () => {
	afterEach(() => {
		cleanup();
		document.body.querySelectorAll('button').forEach((node) => {
			if (!node.closest('[role="menu"]')) node.remove();
		});
	});

	it('offers supervision and handover, each saying what happens to the case', async () => {
		await renderMenu();
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

	it('opens the handover and closes itself', async () => {
		const { onHandover, onClose, onSupervision } = await renderMenu();
		fireEvent.click(item('caseHandover.offer.open'));
		expect(onClose).toHaveBeenCalledTimes(1);
		expect(onHandover).toHaveBeenCalledTimes(1);
		expect(onSupervision).not.toHaveBeenCalled();
	});

	it('opens supervision when it is available here', async () => {
		const { onSupervision } = await renderMenu();
		fireEvent.click(item('sessionHeader.supervisor.modal.title'));
		expect(onSupervision).toHaveBeenCalledTimes(1);
	});

	it('greys supervision with its reason when it is not available, handover stays', async () => {
		const { onSupervision } = await renderMenu({
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

	it('closes on Escape and on a press outside', async () => {
		const { onClose } = await renderMenu();
		fireEvent.keyDown(screen.getByRole('presentation'), { key: 'Escape' });
		const backdrop = document.querySelector('.orisoMenuBackdrop');
		expect(backdrop).toBeTruthy();
		fireEvent.mouseDown(backdrop!);
		expect(onClose).toHaveBeenCalledTimes(2);
	});

	it('closes when keyboard focus leaves it, not when it moves inside (review)', async () => {
		const outside = document.createElement('button');
		const opener = document.createElement('button');
		document.body.append(outside, opener);
		const { onClose } = await renderMenu({ opener: { current: opener } });
		const [supervision, handover] = screen.getAllByRole('menuitem');
		fireEvent.blur(supervision, { relatedTarget: handover });
		fireEvent.blur(handover, { relatedTarget: opener });
		fireEvent.blur(handover, { relatedTarget: null });
		expect(onClose).not.toHaveBeenCalled();
		fireEvent.blur(handover, { relatedTarget: outside });
		expect(onClose).toHaveBeenCalledTimes(1);
		expect(document.activeElement).not.toBe(opener);
		outside.remove();
		opener.remove();
	});

	it('closes when focus goes from the menu to the "+" and then elsewhere (review)', async () => {
		const outside = document.createElement('button');
		const opener = document.createElement('button');
		document.body.append(outside, opener);
		const { onClose } = await renderMenu({ opener: { current: opener } });
		const [, handover] = screen.getAllByRole('menuitem');
		fireEvent.blur(handover, { relatedTarget: opener });
		fireEvent.focusIn(opener);
		expect(onClose).not.toHaveBeenCalled();
		fireEvent.focusOut(opener, { relatedTarget: outside });
		fireEvent.focusIn(outside);
		expect(onClose).toHaveBeenCalled();
		outside.remove();
		opener.remove();
	});

	it('lets presses outside the menu through its popover root (review)', async () => {
		await renderMenu();
		const root = screen
			.getByRole('menu')
			.closest('.MuiPopover-root') as HTMLElement;
		expect(getComputedStyle(root).pointerEvents).toBe('none');
		const paper = root.querySelector('.MuiPaper-root') as HTMLElement;
		expect(getComputedStyle(paper).pointerEvents).toBe('auto');
	});

	it('hands focus back to the "+" before opening a dialog, so it can return there (review)', async () => {
		let focusedOnOpen: Element | null = null;
		const record = () => (focusedOnOpen = document.activeElement);
		const { opener } = await renderMenu({
			onSupervision: record,
			onHandover: record
		});
		fireEvent.click(item('sessionHeader.supervisor.modal.title'));
		expect(focusedOnOpen).toBe(opener);
		focusedOnOpen = null;
		cleanup();
		const second = await renderMenu({ onHandover: record });
		fireEvent.click(item('caseHandover.offer.open'));
		expect(focusedOnOpen).toBe(second.opener);
	});

	it('closes on a press outside the menu and the "+", not on the "+" (review)', async () => {
		const { onClose, opener } = await renderMenu();
		fireEvent.mouseDown(opener);
		expect(onClose).not.toHaveBeenCalled();
		fireEvent.mouseDown(document.body);
		expect(onClose).toHaveBeenCalledTimes(1);
	});
});
