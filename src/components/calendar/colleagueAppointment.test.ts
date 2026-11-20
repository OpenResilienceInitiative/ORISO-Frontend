import { describe, expect, it } from 'vite-plus/test';
import { entryActions } from './calendarActions';
import { entryFromApi } from './calendarApiMapping';
import { draftError, type CalendarEntry } from './calendarModel';

const NOW = new Date('2026-11-17T10:00:00Z');
const all = {
	start: true,
	chat: true,
	join: true,
	move: true,
	propose: true,
	cancel: true,
	remove: true,
	accept: true,
	decline: true
};
const context = { ownerId: 'me', role: 'consultant' as const, can: all };

const meeting = (
	invited: boolean,
	status: 'pending' | 'confirmed',
	kind: CalendarEntry['kind'] = 'video'
): CalendarEntry => ({
	id: 'm1',
	type: 'appointment',
	start: '2026-11-19T09:00:00Z',
	end: '2026-11-19T10:00:00Z',
	ownerId: 'me',
	kind,
	title: 'Kai Colleague',
	movable: false,
	meeting: {
		colleagueId: 'kai',
		colleagueName: 'Kai Colleague',
		status,
		invited,
		matrixRoomId: '!room:oriso',
		chatId: 77
	}
});

describe('appointment with a colleague (FE#2305)', () => {
	it('reads the other counsellor, the status and the room from UserService', () => {
		const entry = entryFromApi({
			id: 'm1',
			type: 'APPOINTMENT',
			start: '2026-11-19T09:00:00Z',
			end: '2026-11-19T10:00:00Z',
			ownerId: 'me',
			kind: 'PHONE',
			title: 'Kai Colleague',
			movable: false,
			colleagueId: 'kai',
			colleagueName: 'Kai Colleague',
			colleagueStatus: 'PENDING',
			invited: true,
			matrixRoomId: '!room:oriso',
			chatId: 77
		});
		expect(entry.meeting).toEqual({
			colleagueId: 'kai',
			colleagueName: 'Kai Colleague',
			status: 'pending',
			invited: true,
			matrixRoomId: '!room:oriso',
			chatId: 77
		});
		expect(entry.kind).toBe('phone');
		expect(entry.sessionId).toBeUndefined();
	});

	it('leaves a counselling appointment without a meeting', () => {
		const entry = entryFromApi({
			id: 'a1',
			type: 'APPOINTMENT',
			start: '2026-11-19T09:00:00Z',
			end: '2026-11-19T10:00:00Z',
			ownerId: 'me',
			sessionId: 7
		});
		expect(entry.meeting).toBeUndefined();
	});

	it('lets the invited counsellor accept or decline a waiting one', () => {
		expect(entryActions(meeting(true, 'pending'), context)).toEqual([
			'accept',
			'decline',
			'chat'
		]);
	});

	it('lets the organizer open the chat and cancel while it waits', () => {
		expect(entryActions(meeting(false, 'pending'), context)).toEqual([
			'chat',
			'cancel'
		]);
	});

	it('offers start (video), chat and cancel once it is fixed, never move', () => {
		expect(entryActions(meeting(true, 'confirmed'), context)).toEqual([
			'start',
			'chat',
			'cancel'
		]);
		expect(
			entryActions(meeting(false, 'confirmed', 'chat'), context)
		).toEqual(['chat', 'cancel']);
		expect(
			entryActions(meeting(false, 'confirmed', 'onsite'), context)
		).toEqual(['chat', 'cancel']);
	});

	it('accepts a draft with a colleague instead of a conversation', () => {
		const draft = {
			type: 'appointment' as const,
			start: new Date('2026-11-19T09:00:00Z'),
			end: new Date('2026-11-19T10:00:00Z'),
			kind: 'video' as const
		};
		expect(draftError(draft, NOW)).toBe('conversation');
		expect(
			draftError({ ...draft, colleagueId: 'kai' }, NOW)
		).toBeUndefined();
	});
});

describe('colleague list (FE#2305)', () => {
	it('keeps whether an internal chat is possible', async () => {
		const { colleagueFromApi } = await import('./calendarApiMapping');
		const base = {
			id: 'kai',
			displayName: 'Kai',
			agencyName: 'Nord',
			relation: 'SAME_AGENCY' as const
		};
		expect(
			colleagueFromApi({ ...base, internalChat: false }).internalChat
		).toBe(false);
		expect(colleagueFromApi(base).internalChat).toBeUndefined();
	});
});
