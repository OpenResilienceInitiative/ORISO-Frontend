// @vitest-environment oriso-jsdom
import * as React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import {
	CalendarSheet,
	nextSheetStop,
	sheetHeight,
	sheetStopAfterDrag
} from './CalendarSheet';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string) => key })
}));

afterEach(cleanup);

// jsdom has no PointerEvent; a MouseEvent carries clientY and button.
if (typeof window.PointerEvent === 'undefined')
	Object.defineProperty(window, 'PointerEvent', {
		configurable: true,
		value: class PointerEvent extends MouseEvent {
			pointerId = 1;
		}
	});

const PAGE = 800;

describe('CalendarSheet — stops', () => {
	it('stops at 64 px, 46 % and 88 % of the page', () => {
		expect(sheetHeight('peek', PAGE)).toBe(64);
		expect(sheetHeight('half', PAGE)).toBe(368);
		expect(sheetHeight('full', PAGE)).toBe(704);
	});

	it('toggles peek and half on a tap', () => {
		expect(
			sheetStopAfterDrag({
				from: 'peek',
				height: 64,
				dy: 2,
				pageHeight: PAGE
			})
		).toBe('half');
		expect(
			sheetStopAfterDrag({
				from: 'full',
				height: 704,
				dy: -3,
				pageHeight: PAGE
			})
		).toBe('peek');
	});

	it('goes to the nearest stop after a drag', () => {
		expect(
			sheetStopAfterDrag({
				from: 'half',
				height: 650,
				dy: -282,
				pageHeight: PAGE
			})
		).toBe('full');
		expect(
			sheetStopAfterDrag({
				from: 'half',
				height: 120,
				dy: 248,
				pageHeight: PAGE
			})
		).toBe('peek');
	});

	it('moves one stop on a flick that ends near its start', () => {
		expect(
			sheetStopAfterDrag({
				from: 'half',
				height: 410,
				dy: -50,
				pageHeight: PAGE
			})
		).toBe('full');
		expect(
			sheetStopAfterDrag({
				from: 'half',
				height: 320,
				dy: 50,
				pageHeight: PAGE
			})
		).toBe('peek');
		// Nothing above full.
		expect(
			sheetStopAfterDrag({
				from: 'full',
				height: 704,
				dy: -45,
				pageHeight: PAGE
			})
		).toBe('full');
	});

	it('cycles peek, half, full', () => {
		expect(nextSheetStop('peek')).toBe('half');
		expect(nextSheetStop('half')).toBe('full');
		expect(nextSheetStop('full')).toBe('peek');
	});
});

describe('CalendarSheet — grab handle', () => {
	const renderSheet = (stop: 'peek' | 'half' | 'full') => {
		const onStop = vi.fn();
		render(
			<CalendarSheet stop={stop} onStop={onStop} label="Liste">
				<p>Inhalt</p>
			</CalendarSheet>
		);
		return { onStop, grab: screen.getByRole('button') };
	};

	it('works as a button: Enter cycles, arrows move', () => {
		const { onStop, grab } = renderSheet('half');
		expect(grab.getAttribute('aria-label')).toBe('calendar.sheet.half');
		fireEvent.click(grab, { detail: 0 });
		expect(onStop).toHaveBeenLastCalledWith('full');
		fireEvent.keyDown(grab, { key: 'ArrowUp' });
		expect(onStop).toHaveBeenLastCalledWith('full');
		fireEvent.keyDown(grab, { key: 'ArrowDown' });
		expect(onStop).toHaveBeenLastCalledWith('peek');
	});

	it('does not go past the ends with the arrows', () => {
		const { onStop, grab } = renderSheet('peek');
		fireEvent.keyDown(grab, { key: 'ArrowDown' });
		expect(onStop).not.toHaveBeenCalled();
		expect(grab.getAttribute('aria-label')).toBe('calendar.sheet.open');
	});

	it('goes down to half with Escape when it covers the calendar', () => {
		const { onStop, grab } = renderSheet('full');
		fireEvent.keyDown(grab, { key: 'Escape' });
		expect(onStop).toHaveBeenCalledWith('half');
	});

	it('toggles on a pointer tap, not on the click that follows it', () => {
		const { onStop, grab } = renderSheet('peek');
		fireEvent.pointerDown(grab, { button: 0, clientY: 700 });
		fireEvent.pointerUp(grab, { clientY: 702 });
		fireEvent.click(grab, { detail: 1 });
		expect(onStop).toHaveBeenCalledTimes(1);
		expect(onStop).toHaveBeenCalledWith('half');
	});
});
