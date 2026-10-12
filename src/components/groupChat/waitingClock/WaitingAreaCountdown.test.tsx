// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import de from '../../../resources/i18n/de/common.json';
import deInformal from '../../../resources/i18n/de@informal/common.json';
import { WaitingAreaCountdown } from './WaitingAreaCountdown';

const readKey = (catalogue: unknown, path: string): unknown =>
	path.split('.').reduce<unknown>((value, part) => {
		if (!value || typeof value !== 'object') {
			return undefined;
		}
		return (value as Record<string, unknown>)[part];
	}, catalogue);

const interpolate = (value: string, options?: Record<string, unknown>) =>
	value.replace(/\{\{(\w+)\}\}/g, (_, token: string) =>
		options?.[token] == null ? '' : String(options[token])
	);

// Resolve informal overlay over formal German so the suite keeps asserting
// the waiting-area copy the design uses for *du*.
vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string, options?: Record<string, unknown>) => {
			const value = readKey(deInformal, key) ?? readKey(de, key);
			return typeof value === 'string'
				? interpolate(value, options)
				: key;
		}
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
		expect(container.querySelector('[aria-pressed]')).toBeNull();
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
		   take their place in the accessibility tree. The still-view control
		   reuses cardOpenAria ("Uhr umdrehen, Begrüßung und Netiquette lesen"). */
		fireEvent.click(
			screen.getByRole('button', {
				name: 'Uhr umdrehen, Begrüßung und Netiquette lesen'
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
