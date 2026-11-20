import { describe, expect, it } from 'vite-plus/test';
import {
	callRoomName,
	DEFAULT_CALL_ROOM_NAME,
	directLinkCallName
} from './callRoomName';

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

	it('stays within the 255 bytes a Matrix room name may have', () => {
		const name = callRoomName({ directLinkName: 'x'.repeat(400) });
		expect(new TextEncoder().encode(name).length).toBeLessThanOrEqual(255);
		expect(name).toBe('x'.repeat(255));
	});

	it('cuts on a code point, never inside a surrogate pair', () => {
		// 4 bytes each: 63 fit, the 64th would end at 256.
		const name = callRoomName({ directLinkName: '😀'.repeat(100) });
		expect(name).toBe('😀'.repeat(63));
		const bytes = new TextEncoder().encode(name);
		expect(bytes.length).toBeLessThanOrEqual(255);
		// A lone surrogate would not survive the round trip.
		expect(new TextDecoder('utf-8', { fatal: true }).decode(bytes)).toBe(
			name
		);
	});

	it('counts umlauts as two bytes', () => {
		const name = callRoomName({ directLinkName: 'ä'.repeat(200) });
		expect(name).toBe('ä'.repeat(127));
	});

	it('keeps free text that merely contains a "!" and a ":"', () => {
		expect(callRoomName({ directLinkName: 'Hilfe! Termin: Montag' })).toBe(
			'Hilfe! Termin: Montag'
		);
	});

	it('only drops a name that IS a room id, not one that contains something shaped like it', () => {
		// An unanchored `!\S+:\S+` would match here; the whole-name guard must not.
		expect(callRoomName({ directLinkName: 'Flyer !Schule:Montag' })).toBe(
			'Flyer !Schule:Montag'
		);
	});
});

describe('directLinkCallName', () => {
	it('returns the link name', () => {
		expect(directLinkCallName({ directLinkName: ' Flyer Schule ' })).toBe(
			'Flyer Schule'
		);
	});

	it.each([
		['no session', undefined],
		['no name', {}],
		['a blank name', { directLinkName: '  ' }],
		['a room id', { directLinkName: '!abc123:dev.oriso.org' }]
	])(
		'returns nothing for %s, so the caller picks the neutral name',
		(_, session) => {
			expect(directLinkCallName(session)).toBeUndefined();
		}
	);
});
