// @vitest-environment oriso-jsdom
import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vite-plus/test';
import { useFutureEntries } from './useFutureEntries';
import type { TimelineSession } from './timelineModel';

const { occurrences } = vi.hoisted(() => ({ occurrences: vi.fn() }));
vi.mock('../../../api/apiGetChatOccurrences', () => ({
	apiGetChatOccurrences: occurrences
}));
vi.mock('../../../api/apiSessionAppointments', () => ({
	apiGetUpcomingAppointments: () => Promise.resolve([])
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
});
