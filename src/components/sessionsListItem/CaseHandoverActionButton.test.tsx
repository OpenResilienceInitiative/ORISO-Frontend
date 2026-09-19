// @vitest-environment jsdom
/**
 * #1158 — the case-handover menu must escape `.sessionsListItem__content`,
 * which is `overflow: hidden` to keep the 24px card corners clipped.
 */
import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import {
	CaseHandoverActionButton,
	CaseHandoverActionLabels
} from './CaseHandoverActionButton';

const labels: CaseHandoverActionLabels = {
	requestAccess: 'Request access',
	awaitingApproval: 'Awaiting approval',
	accessGranted: 'Access granted',
	accessDenied: 'Access denied',
	selectCase: 'Select case',
	menuLabel: 'Case handover options',
	selectMultipleTitle: 'Select multiple conversations',
	selectMultipleDescription: 'Select several cases at once.',
	confirmSelectionTitle: 'Confirm selection',
	confirmSelectionDescription: 'Proceed with the current selection.',
	deselectTitle: 'Deselect and close',
	deselectDescription: 'Deselects everything and closes batch mode.'
};

const anchorToggleAt = (rect: Partial<DOMRect>) =>
	vi
		.spyOn(HTMLButtonElement.prototype, 'getBoundingClientRect')
		.mockReturnValue({
			x: 0,
			y: 0,
			top: 0,
			left: 0,
			width: 0,
			height: 0,
			right: 0,
			bottom: 0,
			toJSON: () => ({}),
			...rect
		} as DOMRect);

const openMenu = () =>
	fireEvent.click(screen.getByLabelText('Case handover options'));

describe('CaseHandoverActionButton menu', () => {
	afterEach(() => {
		cleanup();
		vi.restoreAllMocks();
	});

	it('portals the menu to the body so the card overflow cannot clip it', () => {
		const clippingCard = document.createElement('div');
		clippingCard.style.overflow = 'hidden';
		document.body.appendChild(clippingCard);

		render(
			<CaseHandoverActionButton labels={labels} state="requestAccess" />,
			{ container: clippingCard }
		);
		openMenu();

		expect(screen.getByRole('menu').parentElement).toBe(document.body);
	});

	it('anchors the menu with viewport coordinates beside the toggle', () => {
		anchorToggleAt({ left: 380, right: 400, top: 120, bottom: 140 });
		window.innerWidth = 1024;

		render(
			<CaseHandoverActionButton labels={labels} state="requestAccess" />
		);
		openMenu();

		const menu = screen.getByRole('menu');
		// Without a card the chevron is the surface: right of it, 8 px gap.
		expect(menu.style.left).toBe('408px');
		expect(menu.style.top).toBe('120px');
		expect(menu.style.width).toBe('236px');
		expect(menu.dataset.placement).toBe('right');
	});

	it('opens beside the card when the card is passed as surface', () => {
		anchorToggleAt({ left: 380, right: 400, top: 120, bottom: 140 });
		window.innerWidth = 1024;
		const card = document.createElement('div');
		vi.spyOn(card, 'getBoundingClientRect').mockReturnValue({
			x: 100,
			y: 100,
			top: 100,
			left: 100,
			width: 320,
			height: 128,
			right: 420,
			bottom: 228,
			toJSON: () => ({})
		} as DOMRect);
		document.body.appendChild(card);

		render(
			<CaseHandoverActionButton
				labels={labels}
				state="requestAccess"
				surfaceRef={{ current: card }}
			/>,
			{ container: card }
		);
		openMenu();

		const menu = screen.getByRole('menu');
		// Card right edge 420 + 8 px gap — not the chevron's 400.
		expect(menu.style.left).toBe('428px');
		expect(menu.style.top).toBe('120px');
		expect(menu.dataset.placement).toBe('right');
	});

	it('still closes on an outside click once portalled', () => {
		render(
			<CaseHandoverActionButton labels={labels} state="requestAccess" />
		);
		openMenu();
		expect(screen.queryByRole('menu')).not.toBeNull();

		fireEvent.mouseDown(document.body);

		expect(screen.queryByRole('menu')).toBeNull();
	});

	it('keeps the menu open when clicking inside it', () => {
		render(
			<CaseHandoverActionButton labels={labels} state="requestAccess" />
		);
		openMenu();

		fireEvent.mouseDown(screen.getByRole('menu'));

		expect(screen.queryByRole('menu')).not.toBeNull();
	});
});
