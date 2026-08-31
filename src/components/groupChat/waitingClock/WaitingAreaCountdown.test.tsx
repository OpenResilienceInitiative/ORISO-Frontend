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

describe('WaitingAreaCountdown', () => {
	afterEach(cleanup);

	it('renders the future state with all four flippable number groups', () => {
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
		expect(screen.getAllByRole('button', { pressed: false })).toHaveLength(
			4 // the four flip groups
		);
		expect(screen.getByRole('timer').getAttribute('aria-label')).toContain(
			'Tage: 2, Stunden: 3, Minuten: 21'
		);
	});

	// A card face is "shown" when its (aria-hidden marked) backface wrapper is
	// currently the visible one.
	const isShown = (el: Element) =>
		el.closest('[aria-hidden]')?.getAttribute('aria-hidden') === 'false';

	it('flips the days group to the counsellor greeting', () => {
		renderCountdown(2 * 86400);

		const days = screen.getByRole('button', { name: /Tage: 2\./ });
		expect(isShown(screen.getByText(WELCOME))).toBe(false);

		fireEvent.click(days);

		expect(days.getAttribute('aria-pressed')).toBe('true');
		expect(isShown(screen.getByText(WELCOME))).toBe(true);
		expect(screen.getByText('Begrüßung deiner Beratung')).toBeTruthy();
	});

	it('flips an hours group to a netiquette rule', () => {
		renderCountdown(2 * 86400 + 5 * 3600);

		fireEvent.click(screen.getByRole('button', { name: /Stunden: 5\./ }));

		const shownLabels = screen
			.getAllByText(/Netiquette · Regel \d/)
			.filter(isShown);
		expect(shownLabels).toHaveLength(1);
		const shownRule = RULES.some((rule) =>
			screen.getAllByText(rule).some(isShown)
		);
		expect(shownRule).toBe(true);
	});

	it('keyboard-flips via Enter', () => {
		renderCountdown(2 * 86400);

		const days = screen.getByRole('button', { name: /Tage: 2\./ });
		fireEvent.keyDown(days, { key: 'Enter' });

		expect(days.getAttribute('aria-pressed')).toBe('true');
	});

	it('switches to calm static digits via the animation toggle', () => {
		renderCountdown(2 * 86400 + 3 * 3600 + 21 * 60 + 50);

		fireEvent.click(screen.getByRole('switch'));

		// Static fallback: plain padded digits, no flip buttons anymore.
		expect(screen.getByText('02')).toBeTruthy();
		expect(screen.getByText('03')).toBeTruthy();
		expect(screen.queryByRole('button', { name: /Tage/ })).toBeNull();
		// The greeting card is shown inline instead of behind a flip.
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

	it('falls back to rules behind the days when no welcome text exists', () => {
		renderCountdown(2 * 86400, { welcomeText: undefined });

		fireEvent.click(screen.getByRole('button', { name: /Tage: 2\./ }));

		const shownLabels = screen
			.getAllByText(/Netiquette · Regel \d/)
			.filter(isShown);
		expect(shownLabels.length).toBeGreaterThan(0);
		expect(screen.queryByText('Begrüßung deiner Beratung')).toBeNull();
	});

	it('only flips the greeting card when rules are missing', () => {
		renderCountdown(2 * 86400, { rules: [] });

		// Rule cards have no content to show — only the days card is a button.
		const buttons = screen.getAllByRole('button');
		expect(buttons).toHaveLength(1);
		fireEvent.click(buttons[0]);
		expect(isShown(screen.getByText(WELCOME))).toBe(true);
	});

	it('renders unflippable digits when neither welcome nor rules exist', () => {
		renderCountdown(2 * 86400, { welcomeText: undefined, rules: [] });

		expect(screen.queryByRole('button')).toBeNull();
		expect(screen.getByText('Tage')).toBeTruthy();
	});
});
