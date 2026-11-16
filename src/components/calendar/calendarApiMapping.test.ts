import { describe, expect, it } from 'vite-plus/test';
import {
	blockerToApi,
	colleagueFromApi,
	entryFromApi,
	importFromApi,
	loadWindow,
	MAX_WINDOW_DAYS,
	normalizeImportUrl,
	visibilityFromApi
} from './calendarApiMapping';

describe('calendarApiMapping', () => {
	it('maps an own appointment with its kind and conversation', () => {
		expect(
			entryFromApi({
				id: 'a1',
				type: 'APPOINTMENT',
				start: '2026-11-16T09:00:00Z',
				end: '2026-11-16T10:00:00Z',
				ownerId: 'me',
				kind: 'PHONE',
				title: 'ruhiges_yak',
				sessionId: 4401,
				movable: true
			})
		).toEqual({
			id: 'a1',
			type: 'appointment',
			start: '2026-11-16T09:00:00Z',
			end: '2026-11-16T10:00:00Z',
			ownerId: 'me',
			kind: 'phone',
			title: 'ruhiges_yak',
			sessionId: 4401,
			movable: true
		});
	});

	it('treats an appointment from before the calendar as a video call', () => {
		const entry = entryFromApi({
			id: 'a2',
			type: 'APPOINTMENT',
			start: '2026-11-16T09:00:00Z',
			end: '2026-11-16T10:00:00Z',
			ownerId: 'me',
			kind: null
		});
		expect(entry.kind).toBe('video');
		expect(entry.movable).toBe(false);
	});

	it('keeps a colleague entry free of title and conversation when absent', () => {
		const entry = entryFromApi({
			id: 'k1',
			type: 'BUSY',
			start: '2026-11-16T09:00:00Z',
			end: '2026-11-16T10:00:00Z',
			ownerId: 'kaya',
			title: null,
			sessionId: null
		});
		expect(entry).not.toHaveProperty('title');
		expect(entry).not.toHaveProperty('sessionId');
		expect(entry).not.toHaveProperty('kind');
		expect(entry.type).toBe('busy');
	});

	it('maps colleagues and the Träger visibility', () => {
		expect(
			colleagueFromApi({
				id: 'b',
				displayName: 'J. Brandt',
				agencyName: null,
				relation: 'SAME_TENANT'
			})
		).toEqual({
			id: 'b',
			displayName: 'J. Brandt',
			agencyName: '',
			relation: 'sameTenant'
		});
		expect(
			visibilityFromApi({
				visibilityScope: 'TENANT',
				showAskerUsernames: true
			})
		).toEqual({ scope: 'TENANT', showUsernames: true });
	});

	it('sends a blocked-time series as its first day plus the rule', () => {
		const start = new Date(2026, 10, 16, 8, 0);
		const end = new Date(2026, 10, 16, 12, 0);
		expect(
			blockerToApi([
				{
					type: 'blocker',
					start,
					end,
					note: '  Teamsitzung ',
					repeat: { weekdays: [1], until: new Date(2026, 11, 14) }
				},
				{
					type: 'blocker',
					start: new Date(2026, 10, 23, 8),
					end: new Date(2026, 10, 23, 12)
				}
			])
		).toEqual({
			start: start.toISOString(),
			end: end.toISOString(),
			note: 'Teamsitzung',
			repeat: { weekdays: [1], until: '2026-12-14' }
		});
	});

	it('sends a single blocked time without a rule', () => {
		const body = blockerToApi([
			{
				type: 'blocker',
				start: new Date(2026, 10, 16),
				end: new Date(2026, 10, 16, 23, 59),
				allDay: true,
				repeat: { weekdays: [], until: new Date(2026, 11, 1) }
			}
		]);
		expect(body.allDay).toBe(true);
		expect(body).not.toHaveProperty('repeat');
		expect(body).not.toHaveProperty('note');
	});

	it('shows only the host of the private import address', () => {
		expect(
			importFromApi({
				feedUrl: 'https://x/feed.ics',
				importConfigured: true,
				importHost: 'outlook.office365.com',
				importLastSyncAt: '2026-11-16T08:00:00Z'
			})
		).toEqual({
			host: 'outlook.office365.com',
			lastSyncedAt: '2026-11-16T08:00:00Z',
			failed: false
		});
		expect(
			importFromApi({
				feedUrl: 'https://x/feed.ics',
				importConfigured: false,
				importError: 'UNREACHABLE'
			})
		).toEqual({ failed: true });
	});

	it('fetches webcal addresses over https', () => {
		expect(normalizeImportUrl(' webcal://p01.icloud.com/x.ics ')).toBe(
			'https://p01.icloud.com/x.ics'
		);
	});

	it('loads a week around the visible range, never more than UserService allows', () => {
		const week = loadWindow(new Date(2026, 10, 16), new Date(2026, 10, 23));
		expect(week.from).toEqual(new Date(2026, 10, 9));
		expect(week.to).toEqual(new Date(2026, 10, 30));
		const month = loadWindow(new Date(2026, 9, 26), new Date(2026, 11, 7));
		const days = (month.to.getTime() - month.from.getTime()) / 86_400_000;
		expect(days).toBeLessThanOrEqual(MAX_WINDOW_DAYS);
	});
});
