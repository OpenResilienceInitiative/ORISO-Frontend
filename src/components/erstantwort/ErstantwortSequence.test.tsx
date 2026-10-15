// @vitest-environment jsdom
import * as React from 'react';
import {
	act,
	cleanup,
	fireEvent,
	render,
	screen
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ErstantwortSequence } from './ErstantwortSequence';
import { ResolvedBaustein } from './erstantwortResolve';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (_key: string, fallback?: string) => fallback ?? _key
	})
}));

const bausteine: ResolvedBaustein[] = [
	{ id: 'greeting', body: 'Schön, dass Sie sich gemeldet haben.' },
	{
		id: 'responseDeadline',
		headline: 'Wann Sie eine Antwort erhalten',
		body: 'Sie erhalten innerhalb von 2 Werktagen eine Antwort.'
	},
	{
		id: 'emailNotification',
		body: 'Sie können eine E-Mail-Adresse hinterlegen.',
		action: { kind: 'ADD_EMAIL', label: 'E-Mail-Adresse angeben' }
	}
];

afterEach(cleanup);
beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

/** Advance far enough that every staged bubble has revealed. */
const runSequence = () =>
	act(() => {
		vi.advanceTimersByTime(60_000);
	});

describe('ErstantwortSequence', () => {
	it('keeps frozen FAQ wording available inside expandable chat content', () => {
		render(<ErstantwortSequence bausteine={bausteine} skipAnimation />);
		const question = screen.getByText('Wann Sie eine Antwort erhalten');
		expect(question.closest('summary')).not.toBeNull();
		fireEvent.click(question);
		expect(question.closest('details')?.open).toBe(true);
		expect(
			screen.getByText(
				'Sie erhalten innerhalb von 2 Werktagen eine Antwort.'
			)
		).toBeTruthy();
	});

	it('reveals the bubbles one after another rather than all at once', () => {
		render(<ErstantwortSequence bausteine={bausteine} staggerMs={800} />);

		// Before any timer runs only the first bubble is on its way in.
		expect(
			screen.queryByText(
				'Sie erhalten innerhalb von 2 Werktagen eine Antwort.'
			)
		).toBeNull();

		runSequence();

		expect(
			screen.getByText('Schön, dass Sie sich gemeldet haben.')
		).toBeTruthy();
		expect(
			screen.getByText(
				'Sie erhalten innerhalb von 2 Werktagen eine Antwort.'
			)
		).toBeTruthy();
		expect(
			screen.getByText('Sie können eine E-Mail-Adresse hinterlegen.')
		).toBeTruthy();
	});

	it('renders the whole sequence immediately when animation is skipped', () => {
		render(<ErstantwortSequence bausteine={bausteine} skipAnimation />);

		expect(
			screen.getByText('Schön, dass Sie sich gemeldet haben.')
		).toBeTruthy();
		expect(
			screen.getByText('Sie können eine E-Mail-Adresse hinterlegen.')
		).toBeTruthy();
	});

	it('names Carimat once as the sender rather than on every bubble', () => {
		render(<ErstantwortSequence bausteine={bausteine} skipAnimation />);

		expect(screen.getAllByText('Carimat')).toHaveLength(1);
	});

	it('renders an action Baustein as a real button and calls back with its kind', () => {
		const onAction = vi.fn();
		render(
			<ErstantwortSequence
				bausteine={bausteine}
				skipAnimation
				onAction={onAction}
			/>
		);

		const button = screen.getByRole('button', {
			name: 'E-Mail-Adresse angeben'
		});
		act(() => {
			button.click();
		});

		expect(onAction).toHaveBeenCalledWith('ADD_EMAIL');
	});

	it('renders no button for a Baustein whose action was already resolved away', () => {
		render(
			<ErstantwortSequence
				bausteine={[{ id: 'greeting', body: 'Hallo.' }]}
				skipAnimation
			/>
		);

		expect(screen.queryByRole('button')).toBeNull();
	});

	it('renders derived link targets as links with a safe rel', () => {
		render(
			<ErstantwortSequence
				skipAnimation
				bausteine={[
					{
						id: 'dataProtection',
						body: 'Details hier.',
						links: [
							{
								label: 'Datenschutz',
								url: 'https://example.test/dpp'
							}
						]
					}
				]}
			/>
		);

		const link = screen.getByRole('link', { name: 'Datenschutz' });
		expect(link.getAttribute('href')).toBe('https://example.test/dpp');
		expect(link.getAttribute('rel')).toContain('noopener');
	});

	it('renders legacy headlines outside the compact FAQ presentation', () => {
		render(
			<ErstantwortSequence
				bausteine={bausteine}
				skipAnimation
				compactFaq={false}
			/>
		);

		expect(
			screen.getByRole('heading', {
				name: 'Wann Sie eine Antwort erhalten'
			})
		).toBeTruthy();
		expect(screen.getAllByRole('heading')).toHaveLength(1);
	});

	it('renders nothing for an empty Baustein list', () => {
		const { container } = render(
			<ErstantwortSequence bausteine={[]} skipAnimation />
		);

		expect(container.textContent).toBe('');
	});

	it('reports each revealed bubble so the caller can close its send confirmation', () => {
		const onFirstReveal = vi.fn();
		render(
			<ErstantwortSequence
				bausteine={bausteine}
				staggerMs={800}
				onFirstReveal={onFirstReveal}
			/>
		);

		runSequence();

		expect(onFirstReveal).toHaveBeenCalledTimes(1);
	});

	describe('one complete message (Frank, 15.10.)', () => {
		const platformDefaults: ResolvedBaustein[] = [
			{ id: 'greeting', body: 'Ihre Nachricht ist bei uns angekommen.' },
			{
				id: 'whoReadsAlong',
				headline: 'Wer Ihre Nachricht liest',
				body: 'Ihre Nachricht lesen ausschließlich Fachkräfte.'
			},
			{
				id: 'noPersonalData',
				headline: 'Bitte keine persönlichen Daten senden',
				body: 'Bitte nennen Sie keinen vollen Namen.'
			},
			{
				id: 'emergencyNumbers',
				headline: 'Wenn es nicht warten kann',
				body: 'Telefonseelsorge 0800 111 0 111.'
			},
			{
				id: 'dataProtection',
				body: 'Ihre Daten bleiben geschützt.'
			},
			{
				id: 'emailNotification',
				headline: 'Benachrichtigung per E-Mail',
				body: 'Sie können eine E-Mail-Adresse hinterlegen.'
			},
			{ id: 'closing', body: 'Bis bald.' }
		];

		const bubbleOf = (text: string) =>
			screen.getByText(text).closest('.erstantwort__bubble');

		it('puts greeting, questions, emergency numbers and closing into one bubble', () => {
			render(
				<ErstantwortSequence
					bausteine={platformDefaults}
					skipAnimation
				/>
			);

			const message = bubbleOf('Ihre Nachricht ist bei uns angekommen.');
			expect(message).not.toBeNull();
			expect(bubbleOf('Wer Ihre Nachricht liest')).toBe(message);
			expect(bubbleOf('Wenn es nicht warten kann')).toBe(message);
			expect(bubbleOf('Bis bald.')).toBe(message);
		});

		it('keeps the optional e-mail invitation as its own message after it', () => {
			const { container } = render(
				<ErstantwortSequence
					bausteine={platformDefaults}
					skipAnimation
				/>
			);

			const bubbles = container.querySelectorAll('.erstantwort__bubble');
			expect(bubbles).toHaveLength(2);
			expect(bubbles[1].textContent).toContain(
				'Sie können eine E-Mail-Adresse hinterlegen.'
			);
		});

		it('shows the emergency numbers as the last question, collapsed and marked', () => {
			render(
				<ErstantwortSequence
					bausteine={platformDefaults}
					skipAnimation
				/>
			);

			const summary = screen.getByText('Wenn es nicht warten kann');
			const row = summary.closest('details');
			expect(summary.closest('summary')).not.toBeNull();
			expect(row?.open).toBe(false);
			expect(row?.className).toContain('erstantwort__faq--emergency');
			// Not colour alone: the row also carries a phone icon.
			expect(row?.querySelector('summary svg')).not.toBeNull();
			const rows = summary
				.closest('.erstantwort__bubble')
				?.querySelectorAll('details');
			expect(rows?.[rows.length - 1]).toBe(row);
		});

		it('takes every question from the delivered wording, not from the code', () => {
			render(
				<ErstantwortSequence
					skipAnimation
					bausteine={[
						{
							id: 'greeting',
							body: 'Hallo aus der Beratungsstelle.'
						},
						{
							id: 'emergencyNumbers',
							headline: 'Notfall? Sofort Hilfe',
							body: 'Rufen Sie 112.'
						}
					]}
				/>
			);

			expect(screen.getByText('Notfall? Sofort Hilfe')).toBeTruthy();
			expect(screen.queryByText('Wenn es nicht warten kann')).toBeNull();
		});
	});

	it('announces the sequence politely to screen readers without trapping focus', () => {
		const { container } = render(
			<ErstantwortSequence bausteine={bausteine} skipAnimation />
		);

		const region = container.querySelector('[aria-live]');
		expect(region?.getAttribute('aria-live')).toBe('polite');
		expect(container.querySelector('[aria-modal]')).toBeNull();
		expect(container.querySelector('[role="dialog"]')).toBeNull();
	});
});
