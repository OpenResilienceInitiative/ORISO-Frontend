// @vitest-environment oriso-jsdom
import * as React from 'react';
import { useState } from 'react';
import {
	act,
	cleanup,
	fireEvent,
	render,
	screen,
	within
} from '@testing-library/react';
import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	vi
} from 'vite-plus/test';
import {
	consultantMailCounsellingTour,
	consultantWalkthroughTour
} from '../tourDefinitions';
import {
	TourLauncherMenu,
	type TourLauncherProgress
} from './TourLauncherMenu';
import type { TourLauncherPosition } from './tourLauncherPosition';

vi.mock('react-i18next', async () => {
	const { makeTranslate } = await import(
		'../../../practice/practiceTestTranslate'
	);
	return { useTranslation: () => ({ t: makeTranslate() }) };
});

// jsdom has no PointerEvent: a press would carry no position.
if (typeof window.PointerEvent === 'undefined')
	Object.defineProperty(window, 'PointerEvent', {
		configurable: true,
		value: class PointerEvent extends MouseEvent {
			pointerId: number;
			pointerType: string;
			constructor(type: string, init: PointerEventInit = {}) {
				super(type, init);
				this.pointerId = init.pointerId ?? 1;
				this.pointerType = init.pointerType ?? 'mouse';
			}
		}
	});

const TOURS = [consultantWalkthroughTour, consultantMailCounsellingTour];

/** The app keeps the position in storage; here a state stands in. */
const Stage = ({
	initial = null,
	progress = [],
	onMove = vi.fn(),
	onHide = vi.fn()
}: {
	initial?: TourLauncherPosition | null;
	progress?: TourLauncherProgress[];
	onMove?: (position: TourLauncherPosition | null) => void;
	onHide?: () => void;
}) => {
	const [position, setPosition] = useState(initial);
	return (
		<TourLauncherMenu
			tours={TOURS}
			progress={progress}
			onStartTour={vi.fn()}
			onManage={vi.fn()}
			position={position}
			onMove={(next) => {
				onMove(next);
				setPosition(next);
			}}
			onHide={onHide}
		/>
	);
};

const fab = () =>
	screen.getByRole('button', { name: /Rundgänge (öffnen|schließen)/ });
const root = () => fab().closest<HTMLElement>('[data-cy="tour-launcher"]')!;

/** The FAB sits in the default corner of a 1000 × 800 window. */
const placeFab = (left = 928, top = 688) =>
	vi.spyOn(fab(), 'getBoundingClientRect').mockReturnValue({
		left,
		top,
		right: left + 56,
		bottom: top + 56,
		width: 56,
		height: 56,
		x: left,
		y: top,
		toJSON: () => ({})
	});

const setViewport = (width: number, height: number) => {
	Object.defineProperty(window, 'innerWidth', {
		configurable: true,
		value: width
	});
	Object.defineProperty(window, 'innerHeight', {
		configurable: true,
		value: height
	});
};

beforeEach(() => setViewport(1000, 800));
afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
});

describe('moving the "?"', () => {
	it('opens the menu on a press that moves less than 6 px', () => {
		const onMove = vi.fn();
		render(<Stage onMove={onMove} />);
		placeFab();
		fireEvent.pointerDown(fab(), { clientX: 950, clientY: 710 });
		fireEvent.pointerMove(fab(), { clientX: 953, clientY: 713 });
		fireEvent.pointerUp(fab(), { clientX: 953, clientY: 713 });
		fireEvent.click(fab());
		expect(onMove).not.toHaveBeenCalled();
		expect(screen.getByRole('menu', { name: 'Rundgänge' })).toBeTruthy();
	});

	it('moves with a pointer drag and does not open the menu on release', () => {
		const onMove = vi.fn();
		render(<Stage onMove={onMove} />);
		placeFab();
		fireEvent.pointerDown(fab(), {
			clientX: 950,
			clientY: 710,
			pointerType: 'touch'
		});
		fireEvent.pointerMove(fab(), { clientX: 400, clientY: 300 });
		// While dragging the button follows the pointer.
		expect(root().className).toContain('tourLauncher--dragging');
		fireEvent.pointerMove(fab(), { clientX: 100, clientY: 100 });
		fireEvent.pointerUp(fab(), { clientX: 100, clientY: 100 });
		fireEvent.click(fab());
		// 928 − 850 = 78 from the left, 688 − 610 = 78 from the top.
		expect(onMove).toHaveBeenLastCalledWith({
			h: 'left',
			x: 78,
			v: 'top',
			y: 78
		});
		expect(screen.queryByRole('menu')).toBeNull();
		expect(root().style.left).toBe('78px');
		expect(root().style.top).toBe('78px');
		expect(root().dataset.position).toBe('top-left');
		expect(root().className).toContain('tourLauncher--left');
		expect(root().className).toContain('tourLauncher--top');
		// The next plain press opens the menu again.
		fireEvent.click(fab());
		expect(screen.getByRole('menu')).toBeTruthy();
	});

	it('moves in 16 px steps with Alt + arrow keys only', () => {
		const onMove = vi.fn();
		render(<Stage onMove={onMove} />);
		placeFab();
		fireEvent.keyDown(fab(), { key: 'ArrowLeft' });
		expect(onMove).not.toHaveBeenCalled();
		fireEvent.keyDown(fab(), { key: 'ArrowLeft', altKey: true });
		expect(onMove).toHaveBeenLastCalledWith({
			h: 'right',
			x: 1000 - 912 - 56,
			v: 'bottom',
			y: 800 - 688 - 56
		});
		fireEvent.keyDown(fab(), { key: 'ArrowUp', altKey: true });
		expect(onMove).toHaveBeenLastCalledWith({
			h: 'right',
			x: 1000 - 928 - 56,
			v: 'bottom',
			y: 800 - 672 - 56
		});
		expect(fab().getAttribute('aria-keyshortcuts')).toBe(
			'Alt+ArrowUp Alt+ArrowDown Alt+ArrowLeft Alt+ArrowRight'
		);
		const hint = document.getElementById(
			fab().getAttribute('aria-describedby')!
		);
		expect(hint?.textContent).toBe(
			'Ziehen oder Alt + Pfeiltasten zum Verschieben'
		);
	});

	it('shows the grip with the drag tooltip', () => {
		render(<Stage />);
		const grip = root().querySelector('[data-cy="tour-launcher-grip"]');
		expect(grip?.getAttribute('title')).toBe('Ziehen zum Verschieben');
		expect(grip?.getAttribute('aria-hidden')).toBe('true');
	});

	it('stays inside the viewport when the window shrinks', () => {
		render(<Stage initial={{ h: 'left', x: 900, v: 'top', y: 700 }} />);
		expect(root().style.left).toBe('900px');
		act(() => {
			setViewport(390, 600);
			window.dispatchEvent(new Event('resize'));
		});
		expect(root().style.left).toBe(`${390 - 56 - 8}px`);
		expect(root().style.top).toBe(`${600 - 56 - 8}px`);
	});

	it('offers "Position zurücksetzen" only after a move, and it resets', () => {
		const onMove = vi.fn();
		const { unmount } = render(<Stage onMove={onMove} />);
		fireEvent.click(fab());
		expect(
			screen.queryByRole('menuitem', { name: 'Position zurücksetzen' })
		).toBeNull();
		unmount();

		render(
			<Stage
				onMove={onMove}
				initial={{ h: 'left', x: 16, v: 'bottom', y: 16 }}
			/>
		);
		expect(root().dataset.position).toBe('bottom-left');
		fireEvent.click(fab());
		fireEvent.click(
			screen.getByRole('menuitem', { name: 'Position zurücksetzen' })
		);
		expect(onMove).toHaveBeenLastCalledWith(null);
		expect(root().dataset.position).toBe('default');
		expect(root().style.left).toBe('');
		expect(root().style.bottom).toBe('');
		expect(document.activeElement).toBe(fab());
	});
});

describe('hiding the "?"', () => {
	it('names the consequence first and hides only on the second press', () => {
		const onHide = vi.fn();
		render(<Stage onHide={onHide} />);
		fireEvent.click(fab());
		const item = screen.getByRole('menuitem', {
			name: 'Hilfe-Button ausblenden'
		});
		fireEvent.click(item);
		expect(onHide).not.toHaveBeenCalled();
		expect(item.getAttribute('aria-label')).toMatch(
			'Ausblenden? Wieder einblenden unter Hilfe → Rundgänge'
		);
		expect(
			within(item).getByText('Wieder einblenden unter Hilfe → Rundgänge')
		).toBeTruthy();
		fireEvent.click(item);
		expect(onHide).toHaveBeenCalledTimes(1);
		expect(screen.queryByRole('menu')).toBeNull();
	});

	it('forgets a half-finished confirm when the menu closes', () => {
		const onHide = vi.fn();
		render(<Stage onHide={onHide} />);
		fireEvent.click(fab());
		fireEvent.click(
			screen.getByRole('menuitem', { name: 'Hilfe-Button ausblenden' })
		);
		fireEvent.keyDown(document, { key: 'Escape' });
		fireEvent.click(fab());
		expect(
			screen.getByRole('menuitem', { name: 'Hilfe-Button ausblenden' })
		).toBeTruthy();
		expect(onHide).not.toHaveBeenCalled();
	});
});

describe('completed tours in the "?" menu', () => {
	it('shows a check mark and the completion date, or just "Abgeschlossen"', () => {
		render(
			<Stage
				progress={[
					{
						tourId: consultantWalkthroughTour.id,
						tourVersion: consultantWalkthroughTour.version,
						status: 'completed',
						completedAt: '2026-07-07T10:00:00Z'
					},
					{
						tourId: consultantMailCounsellingTour.id,
						tourVersion: consultantMailCounsellingTour.version,
						status: 'completed',
						completedAt: null
					}
				]}
			/>
		);
		fireEvent.click(fab());
		const [dated, undated] = screen.getAllByRole('menuitem');
		expect(dated.getAttribute('aria-label')).toMatch(
			/^Nochmal starten: .* – Abgeschlossen am 7\. Juli 2026$/
		);
		expect(within(dated).getByTestId('tour-completed-icon')).toBeTruthy();
		expect(
			within(dated).getByText('Abgeschlossen am 7. Juli 2026')
		).toBeTruthy();
		expect(undated.getAttribute('aria-label')).toMatch(
			/^Nochmal starten: .* – Abgeschlossen$/
		);
		expect(within(undated).getByTestId('tour-completed-icon')).toBeTruthy();
	});
});
