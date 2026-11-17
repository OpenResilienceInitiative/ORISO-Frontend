// @vitest-environment oriso-jsdom
/**
 * The phone overview counts the next appointments from the calendar and
 * links to it (FE#2258, review 5909821771).
 */
import * as React from 'react';
import { cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import * as calendarApi from '../../../../api/apiCalendar';
import { OverviewSessions } from '.';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string, options?: Record<string, unknown>) =>
			options ? `${key} ${JSON.stringify(options)}` : key
	})
}));
const links = vi.hoisted(() => ({
	items: [] as { title: string; url: string }[]
}));
vi.mock('../../../mobile/linkMenu/LinkMenu', () => ({
	LinkMenu: ({ items }: { items: { title: string; url: string }[] }) => {
		links.items = items;
		return null;
	}
}));
vi.mock('../../../../containers/overview/hooks/useConsultantData', () => ({
	useConsultantData: () => ({ total: 0 })
}));
vi.mock('../../../../globalState', async () => {
	const React = await import('react');
	return {
		UserDataContext: React.createContext({ userData: { userId: 'me' } })
	};
});
vi.mock('../../../../api/apiCalendar', () => ({
	apiGetCalendarEntries: vi.fn()
}));

afterEach(cleanup);

describe('OverviewSessions — appointments from the calendar', () => {
	it('counts the next own appointments and links to the calendar', async () => {
		const soon = Date.now() + 3_600_000;
		vi.mocked(calendarApi.apiGetCalendarEntries).mockResolvedValue([
			{
				id: 'a1',
				type: 'APPOINTMENT',
				start: new Date(soon).toISOString(),
				end: new Date(soon + 3_600_000).toISOString(),
				ownerId: 'me',
				kind: 'PHONE',
				title: 'ruhiges_yak'
			}
		]);
		render(<OverviewSessions />);
		await waitFor(() =>
			expect(links.items[2]?.title).toBe(
				'overview.upcomingAppointments {"countStr":1}'
			)
		);
		expect(links.items[2].url).toBe('/booking/events');
	});
});
