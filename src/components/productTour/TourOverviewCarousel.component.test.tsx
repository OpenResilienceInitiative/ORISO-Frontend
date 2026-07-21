// @vitest-environment jsdom
import React from 'react';
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TourOverviewCarousel } from './TourOverviewCarousel';
import type { TourDefinition } from './types';

const translations: Record<string, string> = {
	'walkthrough.title': 'Rundgang',
	// The legacy walkthrough copy carries inline HTML — the card must not print it.
	'walkthrough.subtitle':
		'Kurzer Rundgang durch die Anwendung. <br /> Jederzeit erneut startbar.',
	'walkthrough.overview.title': 'Meine Rundgänge',
	'walkthrough.overview.subtitle': 'Tutorials starten und fortsetzen.',
	'walkthrough.overview.empty': 'Keine Rundgänge verfügbar.',
	'walkthrough.overview.status.not_started': 'Nicht gestartet',
	'walkthrough.overview.status.in_progress': 'In Bearbeitung',
	'walkthrough.overview.status.completed': 'Abgeschlossen',
	'walkthrough.overview.status.skipped': 'Übersprungen',
	'walkthrough.overview.action.start': 'Starten',
	'walkthrough.overview.action.continue': 'Fortsetzen',
	'walkthrough.overview.action.restart': 'Neu starten'
};

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string) => translations[key] ?? key,
		i18n: { language: 'de', resolvedLanguage: 'de' }
	})
}));

// The globalState barrel pulls lottie (crashes in jsdom): stub the player.
vi.mock('lottie-react', () => ({ default: () => null }));

const consultantTour: TourDefinition = {
	id: 'consultant-walkthrough',
	version: 1,
	surface: 'frontend',
	audiences: ['consultant'],
	titleKey: 'walkthrough.title',
	summaryKey: 'walkthrough.subtitle',
	steps: [
		{ id: 'a', target: '', titleKey: 't', contentKey: 'c' },
		{ id: 'b', target: 'x', titleKey: 't', contentKey: 'c' }
	]
};

const askerTour: TourDefinition = {
	...consultantTour,
	id: 'asker-tour',
	audiences: ['asker']
};

afterEach(() => {
	cleanup();
	vi.clearAllMocks();
});

describe('TourOverviewCarousel', () => {
	it('renders the summary as readable text, never as raw markup', async () => {
		// Found on Pre-Dev during gate run e2e-20260720-1507: the card printed a
		// literal "<br />" because the shared legacy copy contains inline HTML.
		render(
			<TourOverviewCarousel
				tours={[consultantTour]}
				audience="consultant"
				loadProgress={() => Promise.resolve([])}
				onStartTour={() => {}}
			/>
		);

		await waitFor(() => expect(screen.getByText('Rundgang')).toBeTruthy());
		const summary = document.querySelector(
			'.tourOverview__cardSummary'
		) as HTMLElement;
		expect(summary.textContent).not.toContain('<br');
		expect(summary.textContent).toContain(
			'Kurzer Rundgang durch die Anwendung.'
		);
		expect(summary.textContent).toContain('Jederzeit erneut startbar.');
	});

	it('lists only tours matching the audience with their progress status', async () => {
		render(
			<TourOverviewCarousel
				tours={[consultantTour, askerTour]}
				audience="consultant"
				loadProgress={() =>
					Promise.resolve([
						{
							tourId: 'consultant-walkthrough',
							tourVersion: 1,
							status: 'completed'
						}
					])
				}
				onStartTour={() => {}}
			/>
		);

		await waitFor(() =>
			expect(screen.getByText('Abgeschlossen')).toBeTruthy()
		);
		expect(screen.getAllByText('Rundgang')).toHaveLength(1);
		expect(screen.getByText('Neu starten')).toBeTruthy();
	});

	it('offers start for fresh tours and continue for in-progress ones', async () => {
		const onStartTour = vi.fn();
		render(
			<TourOverviewCarousel
				tours={[consultantTour]}
				audience="consultant"
				loadProgress={() =>
					Promise.resolve([
						{
							tourId: 'consultant-walkthrough',
							tourVersion: 1,
							status: 'in_progress',
							currentStepId: 'b'
						}
					])
				}
				onStartTour={onStartTour}
			/>
		);

		await waitFor(() =>
			expect(screen.getByText('Fortsetzen')).toBeTruthy()
		);
		fireEvent.click(screen.getByText('Fortsetzen'));
		expect(onStartTour).toHaveBeenCalledWith(consultantTour, 'continue');
	});

	it('treats a newer tour version as a fresh scope', async () => {
		render(
			<TourOverviewCarousel
				tours={[{ ...consultantTour, version: 2 }]}
				audience="consultant"
				loadProgress={() =>
					Promise.resolve([
						{
							tourId: 'consultant-walkthrough',
							tourVersion: 1,
							status: 'completed'
						}
					])
				}
				onStartTour={() => {}}
			/>
		);

		await waitFor(() =>
			expect(screen.getByText('Nicht gestartet')).toBeTruthy()
		);
		expect(screen.getByText('Starten')).toBeTruthy();
	});

	it('shows the empty state when no tour matches the audience', async () => {
		render(
			<TourOverviewCarousel
				tours={[askerTour]}
				audience="consultant"
				loadProgress={() => Promise.resolve([])}
				onStartTour={() => {}}
			/>
		);

		await waitFor(() =>
			expect(screen.getByText('Keine Rundgänge verfügbar.')).toBeTruthy()
		);
	});
});
