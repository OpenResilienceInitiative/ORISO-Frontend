// @vitest-environment oriso-jsdom
import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vite-plus/test';
import { useFutureEntries } from './useFutureEntries';
import {
	appointmentsEpoch,
	forgetKnownAppointments,
	knownSessionAppointments,
	rememberSessionAppointments
} from './conversationAppointments';
import type { TimelineSession } from './timelineModel';

const { occurrences, upcoming } = vi.hoisted(() => ({
	occurrences: vi.fn(),
	upcoming: vi.fn(() => Promise.resolve([] as unknown[]))
}));
vi.mock('../../../api/apiGetChatOccurrences', () => ({
	apiGetChatOccurrences: occurrences
}));
vi.mock('../../../api/apiSessionAppointments', () => ({
	apiGetUpcomingAppointments: upcoming
}));

const group = (canConfigure: boolean): TimelineSession => ({
	sessionId: 4,
	title: 'Kreis',
	kind: 'group',
	topic: 'Kreis',
	lastActivity: 0,
	lastMessage: '',
	matrixRoomId: '!room:x',
	canModerate: true,
	canConfigure
});

describe('useFutureEntries', () => {
	it('rebuilds entry permissions when they change, without loading again (#2161)', async () => {
		const start = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
		occurrences.mockResolvedValue([
			{
				seriesId: 4,
				occurrenceIndex: 0,
				originalStart: start,
				start,
				duration: 60,
				modality: 'TEXT'
			}
		]);
		const { result, rerender } = renderHook(
			({ series }) =>
				useFutureEntries({ series, conversations: [], enabled: true }),
			{ initialProps: { series: [group(true)] } }
		);
		await waitFor(() => expect(result.current.entries).toHaveLength(1));
		expect(result.current.entries[0].canConfigure).toBe(true);

		rerender({ series: [group(false)] });
		expect(result.current.entries[0].canConfigure).toBe(false);
		expect(occurrences).toHaveBeenCalledTimes(1);
	});

	it('does not record a failed upcoming read as "no appointments" (review)', async () => {
		forgetKnownAppointments();
		const start = new Date(Date.now() + 86400000).toISOString();
		const known = {
			id: 'k',
			sessionId: 7,
			startTime: start,
			endTime: start,
			status: 'SCHEDULED' as const
		};
		rememberSessionAppointments(7, [known], appointmentsEpoch());
		let rejected = false;
		upcoming.mockImplementationOnce(() => {
			rejected = true;
			return Promise.reject(new Error('503'));
		});
		occurrences.mockResolvedValue([]);
		renderHook(() =>
			useFutureEntries({ series: [], conversations: [], enabled: true })
		);
		await waitFor(() => expect(rejected).toBe(true));
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(knownSessionAppointments(7)).toEqual([known]);
		forgetKnownAppointments();
	});
});
