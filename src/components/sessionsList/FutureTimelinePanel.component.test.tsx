// @vitest-environment jsdom
import React from 'react';
import {
	act,
	cleanup,
	fireEvent,
	render,
	screen
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	apiGetChatOccurrences,
	apiSkipChatOccurrence
} from '../../api/apiGetChatOccurrences';
import { apiGetConsultantAppointments } from '../../api/apiGetConsultantAppointments';
import { FutureTimelinePanel } from './FutureTimelinePanel';

const translations: Record<string, string> = {
	'groupChat.futureTimeline.appointmentFallback': 'Appointment',
	'groupChat.futureTimeline.ariaLabel': 'Future timeline',
	'groupChat.futureTimeline.empty': 'No upcoming events.',
	'groupChat.futureTimeline.duplicate': 'Duplicate as one-off',
	'groupChat.futureTimeline.groupChatFallback': 'Group chat',
	'groupChat.futureTimeline.hide': 'Hide future events',
	'groupChat.futureTimeline.loadMore': 'Load three more months',
	'groupChat.futureTimeline.loading': 'Loading future events…',
	'groupChat.futureTimeline.now': 'Now',
	'groupChat.futureTimeline.revealAriaLabel': 'Reveal future timeline',
	'groupChat.futureTimeline.show': 'Show future events',
	'groupChat.futureTimeline.skip': 'Skip occurrence',
	'groupChat.create.modality.options.audio': 'Audio'
};

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string) => translations[key] ?? key,
		i18n: { language: 'en' }
	})
}));

vi.mock('../../api/apiGetChatOccurrences', () => ({
	apiGetChatOccurrences: vi.fn(),
	apiSkipChatOccurrence: vi.fn(() => Promise.resolve())
}));

vi.mock('../../api/apiGetConsultantAppointments', () => ({
	apiGetConsultantAppointments: vi.fn()
}));

afterEach(() => {
	cleanup();
	vi.clearAllMocks();
});

describe('FutureTimelinePanel', () => {
	it('does not mix appointments into a filtered group-chat timeline', async () => {
		vi.mocked(apiGetChatOccurrences).mockResolvedValue([]);
		vi.mocked(apiGetConsultantAppointments).mockResolvedValue([
			{
				id: 1,
				title: 'Private appointment',
				startTime: new Date(Date.now() + 60_000).toISOString()
			} as never
		]);

		render(
			<FutureTimelinePanel
				series={[{ id: 42, topic: 'Peer group' }]}
				consultantId="consultant-1"
				includeAppointments={false}
			/>
		);
		fireEvent.click(
			screen.getByRole('button', { name: 'Show future events' })
		);

		await screen.findByText('No upcoming events.');
		expect(apiGetConsultantAppointments).not.toHaveBeenCalled();
		expect(screen.queryByText('Private appointment')).toBeNull();
	});

	it('keeps group occurrences visible when the optional appointment service is unavailable', async () => {
		vi.mocked(apiGetChatOccurrences).mockResolvedValue([
			{
				seriesId: 0,
				occurrenceIndex: 1,
				originalStart: '2026-09-21T17:30:00Z',
				start: '2026-09-21T17:30:00Z',
				duration: 120,
				capacity: 14,
				modality: 'AUDIO'
			}
		]);
		vi.mocked(apiGetConsultantAppointments).mockRejectedValue(
			new Error('CATCH_ALL')
		);

		const { rerender } = render(
			<FutureTimelinePanel
				series={[{ id: 0, topic: 'Selbsthilfegruppe E2E' }]}
				consultantId="consultant-1"
			/>
		);
		fireEvent.click(
			screen.getByRole('button', { name: 'Show future events' })
		);

		expect(await screen.findByText('Selbsthilfegruppe E2E')).toBeTruthy();
		expect(screen.getByText(/Audio/)).toBeTruthy();

		await act(async () => {
			rerender(
				<FutureTimelinePanel
					series={[{ id: 0, topic: 'Selbsthilfegruppe E2E' }]}
					consultantId="consultant-1"
				/>
			);
		});

		expect(apiGetChatOccurrences).toHaveBeenCalledTimes(1);
		expect(apiGetConsultantAppointments).toHaveBeenCalledTimes(1);
	});

	it('lets an authorized moderator skip exactly one virtual occurrence', async () => {
		vi.mocked(apiGetChatOccurrences).mockResolvedValue([
			{
				seriesId: 42,
				occurrenceIndex: 2,
				originalStart: '2026-09-21T17:30:00Z',
				start: '2026-09-21T17:30:00Z',
				duration: 60,
				modality: 'TEXT'
			}
		]);
		render(
			<FutureTimelinePanel
				series={[{ id: 42, topic: 'Peer group', canModerate: true }]}
			/>
		);
		fireEvent.click(
			screen.getByRole('button', { name: 'Show future events' })
		);

		fireEvent.click(
			await screen.findByRole('button', { name: 'Skip occurrence' })
		);

		await act(async () => undefined);
		expect(apiSkipChatOccurrence).toHaveBeenCalledWith(
			42,
			'2026-09-21T17:30:00Z'
		);
		expect(screen.queryByText('Peer group')).toBeNull();
	});

	it('hands a virtual occurrence to the one-off duplication flow', async () => {
		const onDuplicateOccurrence = vi.fn();
		vi.mocked(apiGetChatOccurrences).mockResolvedValue([
			{
				seriesId: 42,
				occurrenceIndex: 1,
				originalStart: '2026-09-21T17:30:00Z',
				start: '2026-09-21T18:30:00Z',
				duration: 90,
				modality: 'VIDEO'
			}
		]);
		render(
			<FutureTimelinePanel
				series={[{ id: 42, topic: 'Peer group', canModerate: true }]}
				onDuplicateOccurrence={onDuplicateOccurrence}
			/>
		);
		fireEvent.click(
			screen.getByRole('button', { name: 'Show future events' })
		);
		fireEvent.click(
			await screen.findByRole('button', { name: 'Duplicate as one-off' })
		);

		expect(onDuplicateOccurrence).toHaveBeenCalledWith(
			expect.objectContaining({ seriesId: 42, duration: 90 }),
			'Peer group'
		);
	});
});
