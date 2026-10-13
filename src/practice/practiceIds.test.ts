import { describe, expect, it } from 'vitest';
import {
	isPracticeId,
	isPracticeRoomId,
	PRACTICE_AGENCY_ID,
	PRACTICE_ENQUIRY_SESSION_ID,
	PRACTICE_ID_PREFIX,
	PRACTICE_MAIN_ROOM_ID,
	PRACTICE_MATRIX_SERVER,
	practiceMatrixId,
	practiceNumericId,
	practiceStringId,
	PRACTICE_SUPERVISION_ROOM_ID,
	PRACTICE_TEAM_ROOM_ID,
	PRACTICE_TOPIC_ID,
	practiceUserId
} from './practiceIds';

describe('practice ids: no practice id can be a real id', () => {
	describe('numeric ids', () => {
		it('are negative, so they never equal a database id (>= 0, sequential)', () => {
			for (let n = 1; n <= 1000; n++) {
				const id = practiceNumericId(n);
				expect(id).toBe(-n);
				expect(id).toBeLessThan(0);
				expect(isPracticeId(id)).toBe(true);
			}
		});

		it.each([0, -1, 1.5, NaN, Infinity, '3' as unknown as number])(
			'refuse %s instead of producing a possible real id',
			(n) => {
				expect(() => practiceNumericId(n)).toThrow();
			}
		);

		it.each([0, 1, 42, 9_007_199_254_740_991, -0])(
			'recognise %s as a real id, not a practice id',
			(id) => {
				expect(isPracticeId(id)).toBe(false);
			}
		);

		it.each(['-1.0', '-01', '-0', '- 1', '-1e3', ' -1', '-1 '])(
			'accept only the canonical form, not %j',
			(id) => {
				expect(isPracticeId(id)).toBe(false);
			}
		);
	});

	describe('string and Matrix ids', () => {
		it('carry the practice prefix and a non-routable server', () => {
			expect(PRACTICE_ID_PREFIX).toBe('practice-');
			expect(PRACTICE_MATRIX_SERVER).toBe('practice.invalid');
			expect(practiceStringId('enquiry', 1)).toBe('practice-enquiry-1');
			expect(practiceMatrixId('!', 'room-1')).toBe(
				'!practice-room-1:practice.invalid'
			);
			expect(practiceMatrixId('$', 'event-1')).toBe(
				'$practice-event-1:practice.invalid'
			);
			expect(practiceMatrixId('@', 'sam')).toBe(
				'@practice-sam:practice.invalid'
			);
		});

		it('use a server in the reserved .invalid TLD, which can never resolve or be registered', () => {
			const host = practiceMatrixId('!', 'x').split(':')[1];
			expect(host.endsWith('.invalid')).toBe(true);
			expect(new URL(`https://${host}`).hostname).toBe(host);
		});

		it('are recognised by isPracticeId', () => {
			expect(isPracticeId(practiceStringId('enquiry', 1))).toBe(true);
			expect(isPracticeId(practiceMatrixId('!', 'room-1'))).toBe(true);
			expect(isPracticeId(practiceMatrixId('@', 'sam'))).toBe(true);
			expect(isPracticeId(String(practiceNumericId(7)))).toBe(true);
		});

		it.each([
			'!AbCdEfGhIjKlMnOp:oriso.org',
			'!practice-room:oriso.org',
			'@practice-sam:oriso.org',
			'$Kd3PaYlOadSHyUEKuFkqGWXA0cCe8F9Xw2NsRtQ5mJ4',
			'@consultant:oriso.org',
			'42',
			'0',
			'',
			'practice',
			'a-practice-id',
			'!room:practice.invalid.example.org'
		])('do not mistake the real-looking id %j for a practice id', (id) => {
			expect(isPracticeId(id)).toBe(false);
		});

		it.each([null, undefined, {}, [], true])(
			'treat the non-id value %j as not a practice id (fail closed to "real")',
			(value) => {
				expect(isPracticeId(value)).toBe(false);
			}
		);

		it.each(['!', '$', '@', '#'] as const)(
			'never lets the %s sigil produce a real-shaped id',
			(sigil) => {
				const id = practiceMatrixId(sigil, 'a');
				expect(id.startsWith(sigil)).toBe(true);
				expect(id.endsWith(`:${PRACTICE_MATRIX_SERVER}`)).toBe(true);
			}
		);

		it.each(['', 'with:colon', 'with space', 'with\nline'])(
			'refuses the local part %j',
			(local) => {
				expect(() => practiceMatrixId('!', local)).toThrow();
				expect(() => practiceStringId(local, 1)).toThrow();
			}
		);
	});

	describe('the ids of the practice world', () => {
		it('are practice ids, and the case rooms are practice rooms', () => {
			[
				PRACTICE_AGENCY_ID,
				PRACTICE_TOPIC_ID,
				PRACTICE_ENQUIRY_SESSION_ID,
				PRACTICE_MAIN_ROOM_ID,
				PRACTICE_TEAM_ROOM_ID,
				PRACTICE_SUPERVISION_ROOM_ID,
				practiceUserId('asker')
			].forEach((id) => expect(isPracticeId(id)).toBe(true));
			expect(
				[
					PRACTICE_MAIN_ROOM_ID,
					PRACTICE_TEAM_ROOM_ID,
					PRACTICE_SUPERVISION_ROOM_ID
				].every(isPracticeRoomId)
			).toBe(true);
		});

		it('keep the values the routes and tours address', () => {
			expect(PRACTICE_ENQUIRY_SESSION_ID).toBe(-1);
			expect(PRACTICE_MAIN_ROOM_ID).toBe('!practice-1:practice.invalid');
			expect(practiceUserId('asker')).toBe(
				'@practice-asker:practice.invalid'
			);
		});

		it.each([
			'@practice-asker:practice.invalid',
			'!practice-1:oriso.org',
			'!room:practice.invalid',
			'!practice-1:practice.invalid.example.org',
			-1
		])('do not take %j for a practice room', (id) => {
			expect(isPracticeRoomId(id)).toBe(false);
		});
	});
});
