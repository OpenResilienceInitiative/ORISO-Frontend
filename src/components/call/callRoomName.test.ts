import { describe, expect, it } from 'vite-plus/test';
import { callRoomName, DEFAULT_CALL_ROOM_NAME } from './callRoomName';

/**
 * #2170 (Frank, 2026-11-10): a call is named after the direct link it came
 * through, else "Anruf". It is never named after the session room: the room
 * id is not a secret in the Matrix sense, but it has no business in a title.
 */
describe('callRoomName', () => {
	it('uses the name of the direct link the conversation came through', () => {
		expect(callRoomName({ directLinkName: 'Flyer Schule' })).toBe(
			'Flyer Schule'
		);
	});

	it('trims the name', () => {
		expect(callRoomName({ directLinkName: '  Flyer Schule \n' })).toBe(
			'Flyer Schule'
		);
	});

	it.each([
		['absent', undefined],
		['null', null],
		['empty', ''],
		['blank', '   ']
	])('falls back to the neutral name when the link name is %s', (_, name) => {
		expect(callRoomName({ directLinkName: name })).toBe(
			DEFAULT_CALL_ROOM_NAME
		);
	});

	it('falls back to the neutral name without a session', () => {
		expect(callRoomName(undefined)).toBe(DEFAULT_CALL_ROOM_NAME);
		expect(callRoomName(null)).toBe(DEFAULT_CALL_ROOM_NAME);
	});

	it('ignores a value that is not text', () => {
		expect(callRoomName({ directLinkName: 42 as unknown as string })).toBe(
			DEFAULT_CALL_ROOM_NAME
		);
	});

	it('never lets a Matrix room id into the title', () => {
		expect(callRoomName({ directLinkName: '!abc123:dev.oriso.org' })).toBe(
			DEFAULT_CALL_ROOM_NAME
		);
		expect(
			callRoomName({
				directLinkName: 'Group call for !abc123:dev.oriso.org'
			})
		).toBe(DEFAULT_CALL_ROOM_NAME);
	});

	it('keeps the neutral name "Anruf"', () => {
		expect(DEFAULT_CALL_ROOM_NAME).toBe('Anruf');
	});

	it('stays within the 255 characters a Matrix room name may have', () => {
		const name = callRoomName({ directLinkName: 'x'.repeat(400) });
		expect(name.length).toBeLessThanOrEqual(255);
	});
});
