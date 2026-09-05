import { describe, expect, it } from 'vitest';
import {
	bumpLastActivity,
	isEventForRoom,
	seedLastActivity,
	toStackParticipants
} from './headerParticipants';

const event = (sender: string, ts: number) => ({
	getSender: () => sender,
	getTs: () => ts
});

/**
 * T4 follow-up (stage v3 review): the header's participant stack must only
 * react to its own room and keep "last activity" incrementally instead of
 * rescanning the whole timeline per event.
 */
describe('header participants (T4)', () => {
	it('seeds last activity once from the live timeline', () => {
		const map = seedLastActivity([
			event('@a:x', 10),
			event('@b:x', 20),
			event('@a:x', 30),
			{ getSender: () => undefined, getTs: () => 40 }
		]);
		expect(map.get('@a:x')).toBe(30);
		expect(map.get('@b:x')).toBe(20);
		expect(map.size).toBe(2);
	});

	it('bumps a sender only when the event is newer', () => {
		const map = seedLastActivity([event('@a:x', 30)]);
		expect(bumpLastActivity(map, event('@a:x', 20))).toBe(false);
		expect(map.get('@a:x')).toBe(30);
		expect(bumpLastActivity(map, event('@a:x', 31))).toBe(true);
		expect(map.get('@a:x')).toBe(31);
		expect(bumpLastActivity(map, event('@c:x', 5))).toBe(true);
		expect(bumpLastActivity(map, { getSender: () => undefined })).toBe(
			false
		);
	});

	it('only accepts events of the active room', () => {
		expect(isEventForRoom('!room:x', { roomId: '!room:x' })).toBe(true);
		expect(isEventForRoom('!room:x', { roomId: '!other:x' })).toBe(false);
		// No room on the event → cannot be attributed → ignored.
		expect(isEventForRoom('!room:x', undefined)).toBe(false);
	});

	it('maps joined members to stack participants, asker named by the header', () => {
		const participants = toStackParticipants(
			[
				{ userId: '@asker:x', name: 'asker' },
				{ userId: '@mona:x', name: 'Mona S.' },
				{ userId: '@system:x', name: 'system' }
			],
			seedLastActivity([event('@mona:x', 7)]),
			{
				askerMatrixUserId: '@asker:x',
				askerDisplayName: 'Sonnenblume_47',
				isSystemUser: (id) => id === '@system:x'
			}
		);
		expect(participants).toEqual([
			{
				userId: '@asker:x',
				username: '@asker:x',
				displayName: 'Sonnenblume_47',
				isAsker: true,
				lastActivity: undefined
			},
			{
				userId: '@mona:x',
				username: '@mona:x',
				displayName: 'Mona S.',
				isAsker: false,
				lastActivity: 7
			}
		]);
	});
});
