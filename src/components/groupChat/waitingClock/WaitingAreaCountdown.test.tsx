// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	type ClockShape,
	clockRowWidth,
	fitClockSize,
	WaitingAreaCountdown
} from './WaitingAreaCountdown';

// Return the key untranslated so translateWithFallback serves the German
// fallback strings — the assertions below match those.
vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string) => key
	})
}));

const NOW = new Date('2026-07-18T12:00:00Z').getTime();
const WELCOME = 'Hallo und herzlich willkommen!';
const RULES = [
	'Alles bleibt in diesem Raum.',
	'Du entscheidest, was du teilst.'
];

const renderCountdown = (
	deltaSeconds: number,
	props: Partial<React.ComponentProps<typeof WaitingAreaCountdown>> = {}
) =>
	render(
		<WaitingAreaCountdown
			plannedStart={new Date(NOW + deltaSeconds * 1000)}
			welcomeText={WELCOME}
			rules={RULES}
			nowMs={NOW}
			{...props}
		/>
	);

// A card face is "shown" when its (aria-hidden marked) face wrapper is
// currently the visible one.
const isShown = (el: Element) =>
	el.closest('[aria-hidden]')?.getAttribute('aria-hidden') === 'false';

const cardButton = () =>
	screen.getByRole('button', {
		name: 'Uhr umdrehen, Begrüßung und Netiquette lesen'
	});

describe('WaitingAreaCountdown', () => {
	afterEach(cleanup);

	it('renders the future state with all four number groups on one flip card', () => {
		renderCountdown(2 * 86400 + 3 * 3600 + 21 * 60 + 50, {
			calendarSlot: <button type="button">Zum Kalender hinzufügen</button>
		});

		expect(
			screen.getByText('Dein Gruppen-Chat beginnt in 2 Tagen.')
		).toBeTruthy();
		expect(screen.getByText('Tage')).toBeTruthy();
		expect(screen.getByText('Stunden')).toBeTruthy();
		expect(screen.getByText('Minuten')).toBeTruthy();
		expect(screen.getByText('Sekunden')).toBeTruthy();
		expect(screen.getByText('Zum Kalender hinzufügen')).toBeTruthy();
		// One big card instead of four small ones (the calendar slot button
		// is not part of the clock).
		expect(cardButton().getAttribute('aria-pressed')).toBe('false');
		expect(screen.getByRole('timer').getAttribute('aria-label')).toContain(
			'Tage: 2, Stunden: 3, Minuten: 21'
		);
	});

	it('names the single card in the subline instead of "a number"', () => {
		renderCountdown(2 * 86400);

		const subline = screen.getByText(
			'Uhr antippen, dahinter Begrüßung und Netiquette.'
		);
		expect(subline).toBeTruthy();
		expect(subline.textContent).not.toContain('—');
	});

	it('flips the whole block to the counsellor greeting', () => {
		renderCountdown(2 * 86400);

		expect(isShown(screen.getByText(WELCOME))).toBe(false);

		fireEvent.click(cardButton());

		expect(isShown(screen.getByText(WELCOME))).toBe(true);
		expect(screen.getByText('Begrüßung deiner Beratung')).toBeTruthy();
		// Page 1 of greeting + two rules.
		expect(screen.getByText('1 von 3')).toBeTruthy();
	});

	it('pages from the greeting to the netiquette with the arrow buttons', () => {
		renderCountdown(2 * 86400);
		fireEvent.click(cardButton());

		const next = screen.getByRole('button', { name: 'Nächste Seite' });
		const prev = screen.getByRole('button', { name: 'Vorherige Seite' });
		expect(prev.hasAttribute('disabled')).toBe(true);

		fireEvent.click(next);

		expect(screen.getByText('Netiquette · Regel 1')).toBeTruthy();
		expect(isShown(screen.getByText(RULES[0]))).toBe(true);
		expect(screen.getByText('2 von 3')).toBeTruthy();

		fireEvent.click(next);

		expect(screen.getByText('Netiquette · Regel 2')).toBeTruthy();
		expect(isShown(screen.getByText(RULES[1]))).toBe(true);
		expect(
			screen
				.getByRole('button', { name: 'Nächste Seite' })
				.hasAttribute('disabled')
		).toBe(true);

		fireEvent.click(
			screen.getByRole('button', { name: 'Vorherige Seite' })
		);

		expect(screen.getByText('2 von 3')).toBeTruthy();
		expect(isShown(screen.getByText(RULES[0]))).toBe(true);
	});

	it('keyboard-flips via Enter', () => {
		renderCountdown(2 * 86400);

		fireEvent.keyDown(cardButton(), { key: 'Enter' });

		expect(isShown(screen.getByText(WELCOME))).toBe(true);
	});

	it('turns back to the clock via the "Zurück zur Uhr" control', () => {
		renderCountdown(2 * 86400);
		fireEvent.click(cardButton());

		fireEvent.click(screen.getByRole('button', { name: /Zurück zur Uhr/ }));

		expect(isShown(screen.getByText(WELCOME))).toBe(false);
		expect(cardButton().getAttribute('aria-pressed')).toBe('false');
	});

	it('switches to a static 2×2 square of tiles via the animation toggle', () => {
		const { container } = renderCountdown(
			2 * 86400 + 3 * 3600 + 21 * 60 + 50
		);

		fireEvent.click(screen.getByRole('switch'));

		// Static fallback: plain padded digits, no flip card anymore.
		expect(screen.getByText('02')).toBeTruthy();
		expect(screen.getByText('03')).toBeTruthy();
		expect(
			screen.queryByRole('button', { name: /Uhr umdrehen/ })
		).toBeNull();
		const still = container.querySelector('.waitingClock__still');
		expect(still).toBeTruthy();
		expect(
			still?.querySelectorAll('.waitingClock__stillCell')
		).toHaveLength(4);
		/* The greeting and the rules sit behind the same one card the moving
		   view uses — stacked under the numbers they made the screen a head
		   taller than the moving view and pushed it into a scroll (measured
		   2026-09-07). Opening them here swaps without any transition. */
		expect(screen.queryByText(WELCOME)).toBeNull();
		/* The tiles keep `role="timer"`, so the way to the card is its own
		   button underneath them — a button wrapped around the numbers would
		   take their place in the accessibility tree. */
		fireEvent.click(
			screen.getByRole('button', {
				name: /Begrüßung und Netiquette anzeigen/
			})
		);
		expect(screen.getByText(WELCOME)).toBeTruthy();
	});

	it('renders the overdue state counting up with minutes and seconds', () => {
		renderCountdown(-252); // 4m 12s late

		expect(screen.getByText('Wir sind gleich für dich da.')).toBeTruthy();
		expect(
			screen.getByText('Das Warten wird langsam etwas unangenehm …')
		).toBeTruthy();
		expect(screen.getByText('+')).toBeTruthy();
		expect(screen.getByRole('timer').getAttribute('aria-label')).toContain(
			'Minuten: 4, Sekunden: 12'
		);
		expect(screen.getByText('Minuten')).toBeTruthy();
		expect(screen.getByText('Sekunden')).toBeTruthy();
		expect(screen.queryByText('Tage')).toBeNull();
	});

	it('does not wrap overdue minutes at 60', () => {
		renderCountdown(-(65 * 60 + 5)); // 65m 5s late

		expect(screen.getByRole('timer').getAttribute('aria-label')).toContain(
			'Minuten: 65, Sekunden: 5'
		);
	});

	// #1499. A group 140 minutes late used to draw "99" on the face while its
	// own timer label said 140 — the face and the label disagreed one digit
	// further out than #1293 fixed. The third digit group is 24 more cells.
	it('grows a third digit past 99 minutes instead of clamping', () => {
		const { container } = renderCountdown(-(140 * 60 + 7));

		expect(screen.getByRole('timer').getAttribute('aria-label')).toContain(
			'Minuten: 140, Sekunden: 7'
		);
		// 3 digits (minutes) + 2 digits (seconds) = 5 x 24 mini-clocks.
		expect(container.querySelectorAll('.waitingClock__cell')).toHaveLength(
			5 * 24
		);
	});

	it('prints the true minutes in the motionless fallback too', () => {
		renderCountdown(-(140 * 60 + 7), { reducedMotion: true });

		expect(screen.getByText('140')).toBeTruthy();
		expect(screen.getByText('07')).toBeTruthy();
	});

	it('starts the card on the netiquette when no welcome text exists', () => {
		renderCountdown(2 * 86400, { welcomeText: undefined });

		fireEvent.click(cardButton());

		expect(screen.getByText('Netiquette · Regel 1')).toBeTruthy();
		expect(isShown(screen.getByText(RULES[0]))).toBe(true);
		expect(screen.queryByText('Begrüßung deiner Beratung')).toBeNull();
		expect(screen.getByText('1 von 2')).toBeTruthy();
	});

	it('drops the arrows when the greeting is the only page', () => {
		renderCountdown(2 * 86400, { rules: [] });

		fireEvent.click(cardButton());

		expect(isShown(screen.getByText(WELCOME))).toBe(true);
		expect(screen.queryByRole('button', { name: 'Nächste Seite' })).toBe(
			null
		);
		expect(screen.queryByRole('button', { name: 'Vorherige Seite' })).toBe(
			null
		);
	});

	it('renders an unflippable clock when neither welcome nor rules exist', () => {
		renderCountdown(2 * 86400, { welcomeText: undefined, rules: [] });

		expect(screen.queryByRole('button')).toBeNull();
		expect(screen.getByText('Tage')).toBeTruthy();
	});
});

/**
 * #1499. The overdue row may not wrap: it sits inside a flip card whose height
 * is one group tall, so a second row paints over the caption underneath it.
 * The row cannot wrap as long as the size the fit picks really fits — which is
 * what these assert, at the widths of the two surfaces that show this clock.
 */
describe('clock geometry', () => {
	const shape = (over: Partial<ClockShape> = {}): ClockShape => ({
		overdue: true,
		tight: true,
		compact: false,
		digits: [2, 2],
		...over
	});

	/*
	 * The columns the two surfaces really give the clock, measured in the
	 * browser: 800 px on the client entry page at 1440, 374 px at 390, and
	 * 644 px in the counsellor's chat card at 1280. 320 px is the narrowest
	 * phone anyone still ships. Seconds are never more than two digits, so
	 * `[3, 2]` is the widest overdue row that exists.
	 */
	const CASES = [
		{ width: 800, compact: false },
		{ width: 644, compact: false },
		{ width: 374, compact: true },
		{ width: 320, compact: true }
	];

	it.each(CASES)(
		'fits the overdue row into a $width px column',
		({ width, compact }) => {
			for (const digits of [
				[2, 2],
				[3, 2]
			]) {
				const s = shape({ digits, compact });
				const row = clockRowWidth(fitClockSize(width, undefined, s), s);
				expect([digits.join('/'), row <= width]).toEqual([
					digits.join('/'),
					true
				]);
			}
		}
	);

	it('keeps the clock as big as the column allows', () => {
		const s = shape();
		const size = fitClockSize(800, undefined, s);
		// One step larger would no longer fit — the fit is not conservative.
		expect(clockRowWidth(size + 1, s)).toBeGreaterThan(800);
	});

	it('pays for the third minute digit with a smaller mini-clock, not a wrap', () => {
		const two = shape({ digits: [2, 2] });
		const three = shape({ digits: [3, 2] });
		const sizeTwo = fitClockSize(800, undefined, two);
		const sizeThree = fitClockSize(800, undefined, three);

		expect(sizeThree).toBeLessThan(sizeTwo);
		expect(clockRowWidth(sizeThree, three)).toBeLessThanOrEqual(800);
	});
});
