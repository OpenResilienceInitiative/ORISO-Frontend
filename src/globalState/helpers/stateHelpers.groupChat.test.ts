import { expect, it } from 'vitest';
import { buildExtendedSession } from './stateHelpers';
import type { ListItemInterface } from '../interfaces';

const chat = { id: 100, matrixRoomId: '!group:test' };

it('treats a group chat with a linked session as a group, not a session', () => {
	const actual = buildExtendedSession({
		chat,
		session: { id: 511, status: 2, matrixRoomId: '!linked:test' }
	} as ListItemInterface);

	expect(actual.item.id).toBe(100);
	expect(actual.rid).toBe('!group:test');
	expect(actual.isGroup).toBe(true);
	expect(actual.isSession).toBe(false);
});

it('treats a group chat without a linked session the same way', () => {
	const actual = buildExtendedSession({ chat } as ListItemInterface);

	expect(actual.isGroup).toBe(true);
	expect(actual.isSession).toBe(false);
});

it('keeps a plain session a session', () => {
	const actual = buildExtendedSession({
		session: { id: 511, status: 2, matrixRoomId: '!case:test' }
	} as ListItemInterface);

	expect(actual.isGroup).toBe(false);
	expect(actual.isSession).toBe(true);
});
