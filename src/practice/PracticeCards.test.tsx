// @vitest-environment jsdom
import React from 'react';
import {
	cleanup,
	fireEvent,
	render,
	screen,
	within
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TourDefinition } from '../components/productTour/types';
import { PracticeCards } from './PracticeCards';

vi.mock('react-i18next', async () => {
	const { makeTranslate } = await import('./practiceTestTranslate');
	const t = makeTranslate({
		'tour.practice.accept.title': 'Anfrage annehmen',
		'tour.practice.accept.summary': 'Nehmen Sie eine Übungsanfrage an.',
		'tour.practice.supervision.title': 'Supervision',
		'tour.practice.supervision.summary':
			'Ziehen Sie eine Supervisorin hinzu.'
	});
	return { useTranslation: () => ({ t, i18n: { language: 'de' } }) };
});

// The globalState barrel pulls lottie (crashes in jsdom): stub the player.
vi.mock('lottie-react', () => ({ default: () => null }));

const tour = (id: string, name: string): TourDefinition => ({
	id,
	version: 2,
	surface: 'frontend',
	audiences: ['consultant'],
	titleKey: `tour.practice.${name}.title`,
	summaryKey: `tour.practice.${name}.summary`,
	steps: []
});
const ACCEPT = tour('consultant-practice-accept', 'accept');
const SUPERVISION = tour('consultant-practice-supervision', 'supervision');

type Progress = {
	tourId: string;
	tourVersion: number;
	status: 'in_progress' | 'completed' | 'skipped' | 'not_started';
};

const renderCards = ({
	tours = [ACCEPT, SUPERVISION],
	progress = [] as Progress[],
	isPhone = false,
	onStartTour = vi.fn()
} = {}) => {
	render(
		<PracticeCards
			tours={tours}
			isPhone={isPhone}
			loadProgress={() => Promise.resolve(progress as never)}
			onStartTour={onStartTour}
		/>
	);
	return { onStartTour };
};

const card = async (title: string) =>
	(await screen.findByRole('heading', { name: title })).closest(
		'li'
	) as HTMLElement;

afterEach(cleanup);

describe('PracticeCards', () => {
	it('marks every card as practice and names the area', async () => {
		renderCards();

		expect(
			await screen.findByRole('heading', { name: 'Übungsbereich' })
		).toBeTruthy();
		for (const title of ['Anfrage annehmen', 'Supervision']) {
			expect(within(await card(title)).getByText('Übung')).toBeTruthy();
		}
	});

	it('shows the flow summary as plain text', async () => {
		renderCards();

		expect(
			within(await card('Anfrage annehmen')).getByText(
				'Nehmen Sie eine Übungsanfrage an.'
			)
		).toBeTruthy();
	});

	it('starts a not-yet-practised flow with "Übung starten"', async () => {
		const { onStartTour } = renderCards();
		const accept = await card('Anfrage annehmen');

		fireEvent.click(
			within(accept).getByRole('button', { name: 'Übung starten' })
		);

		expect(onStartTour).toHaveBeenCalledWith(ACCEPT, 'start');
		expect(within(accept).getByText('Nicht gestartet')).toBeTruthy();
	});

	it('marks a completed flow as completed (per tour and version) and offers it again', async () => {
		const { onStartTour } = renderCards({
			progress: [
				{
					tourId: ACCEPT.id,
					tourVersion: ACCEPT.version,
					status: 'completed'
				},
				// A finished older script version does not count.
				{
					tourId: SUPERVISION.id,
					tourVersion: SUPERVISION.version - 1,
					status: 'completed'
				}
			]
		});
		const accept = await card('Anfrage annehmen');
		const supervision = await card('Supervision');

		expect(within(accept).getByText('Abgeschlossen')).toBeTruthy();
		expect(within(supervision).getByText('Nicht gestartet')).toBeTruthy();
		fireEvent.click(
			within(accept).getByRole('button', { name: 'Noch einmal üben' })
		);
		expect(onStartTour).toHaveBeenCalledWith(ACCEPT, 'restart');
	});

	it('starts an interrupted flow from the beginning: practice state is gone after a reload', async () => {
		const { onStartTour } = renderCards({
			progress: [
				{
					tourId: ACCEPT.id,
					tourVersion: ACCEPT.version,
					status: 'in_progress'
				}
			]
		});
		const accept = await card('Anfrage annehmen');

		expect(within(accept).getByText('Nicht gestartet')).toBeTruthy();
		expect(within(accept).queryByText('In Bearbeitung')).toBeNull();
		expect(
			within(accept).queryByRole('button', { name: /fortsetzen/i })
		).toBeNull();
		fireEvent.click(
			within(accept).getByRole('button', { name: 'Übung starten' })
		);
		expect(onStartTour).toHaveBeenCalledWith(ACCEPT, 'start');
	});

	it('offers every flow as not started when the progress cannot be read', async () => {
		render(
			<PracticeCards
				tours={[ACCEPT]}
				isPhone={false}
				loadProgress={() => Promise.reject(new Error('offline'))}
				onStartTour={vi.fn()}
			/>
		);

		expect(
			within(await card('Anfrage annehmen')).getByText('Nicht gestartet')
		).toBeTruthy();
	});

	describe('on a phone', () => {
		it('says to practise on a computer and disables Start', async () => {
			const { onStartTour } = renderCards({ isPhone: true });
			const accept = await card('Anfrage annehmen');

			const start = within(accept).getByRole('button', {
				name: 'Übung starten'
			}) as HTMLButtonElement;
			expect(start.disabled).toBe(true);
			expect(
				within(accept).getByText('Bitte üben Sie am Computer.')
			).toBeTruthy();
			fireEvent.click(start);
			expect(onStartTour).not.toHaveBeenCalled();
		});

		it('still shows the cards and the completed state', async () => {
			renderCards({
				isPhone: true,
				progress: [
					{
						tourId: ACCEPT.id,
						tourVersion: ACCEPT.version,
						status: 'completed'
					}
				]
			});

			expect(
				within(await card('Anfrage annehmen')).getByText(
					'Abgeschlossen'
				)
			).toBeTruthy();
		});
	});

	it('does not show the phone hint on a computer', async () => {
		renderCards();
		await card('Anfrage annehmen');

		expect(screen.queryByText('Bitte üben Sie am Computer.')).toBeNull();
		const start = screen.getAllByRole('button', {
			name: 'Übung starten'
		}) as HTMLButtonElement[];
		start.forEach((button) => expect(button.disabled).toBe(false));
	});

	it('says so when there is no flow to offer', async () => {
		render(
			<PracticeCards
				tours={[]}
				isPhone={false}
				loadProgress={() => Promise.resolve([])}
				onStartTour={vi.fn()}
			/>
		);

		expect(
			await screen.findByText(
				'Aktuell sind keine Übungen für Sie verfügbar.'
			)
		).toBeTruthy();
		expect(screen.queryByRole('listitem')).toBeNull();
	});
});
