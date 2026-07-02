// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
	CHAT_TYPE_GROUP_CHAT,
	CHAT_TYPE_SINGLE_CHAT,
	getChatItemForSession,
	getChatTypeForListItem,
	getSessionType,
	getViewPathForType,
	isGroupChat,
	isMyMessage,
	isSessionChat,
	isUserModerator,
	prepareMessages,
	SESSION_LIST_TYPES,
	SESSION_TYPE_ARCHIVED,
	SESSION_TYPE_ENQUIRY,
	SESSION_TYPE_GROUP,
	SESSION_TYPE_SESSION
} from './sessionHelpers';
import {
	STATUS_EMPTY,
	STATUS_ARCHIVED,
	STATUS_ENQUIRY
} from '../../globalState/interfaces';
import { getValueFromCookie } from '../sessionCookie/accessSessionCookie';

vi.mock('../sessionCookie/accessSessionCookie', () => ({
	getValueFromCookie: vi.fn()
}));

vi.mock('../../utils/encryptionHelpers', () => ({
	decodeUsername: vi.fn((name: string) => `decoded:${name}`)
}));

describe('sessionHelpers', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('classifies enquiry, archived, normal, and group sessions', () => {
		expect(
			getSessionType({ session: { status: STATUS_EMPTY } } as any, 'me')
		).toBe(SESSION_TYPE_ENQUIRY);
		expect(
			getSessionType({ session: { status: STATUS_ENQUIRY } } as any, 'me')
		).toBe(SESSION_TYPE_ENQUIRY);
		expect(
			getSessionType(
				{ session: { status: STATUS_ARCHIVED } } as any,
				'me'
			)
		).toBe(SESSION_TYPE_ARCHIVED);
		expect(getSessionType({ session: { status: 2 } } as any, 'me')).toBe(
			SESSION_TYPE_SESSION
		);
		expect(
			getSessionType({ chat: { moderators: ['me'] } } as any, 'me')
		).toBe(SESSION_TYPE_GROUP);
	});

	it('resolves chat item and chat type from list items', () => {
		const sessionItem = { session: { id: 1, askerRcId: 'user-1' } };
		const groupItem = { chat: { id: 2, moderators: ['mod-1'] } };

		expect(getChatTypeForListItem(sessionItem as any)).toBe(
			CHAT_TYPE_SINGLE_CHAT
		);
		expect(getChatTypeForListItem(groupItem as any)).toBe(
			CHAT_TYPE_GROUP_CHAT
		);
		expect(getChatItemForSession(sessionItem as any)).toBe(
			sessionItem.session
		);
		expect(getChatItemForSession(groupItem as any)).toBe(groupItem.chat);
		expect(isSessionChat(sessionItem.session as any)).toBe(true);
		expect(isGroupChat(groupItem.chat as any)).toBe(true);
	});

	it('maps session list types to their route view names', () => {
		expect(getViewPathForType(SESSION_LIST_TYPES.ENQUIRY)).toBe(
			'sessionPreview'
		);
		expect(getViewPathForType(SESSION_LIST_TYPES.MY_SESSION)).toBe(
			'sessionView'
		);
	});

	it('marks the logged-in user message and group moderator', () => {
		vi.mocked(getValueFromCookie).mockReturnValue('rc-user-id');

		expect(isMyMessage('rc-user-id')).toBe(true);
		expect(isMyMessage('another-user')).toBe(false);
		expect(
			isUserModerator({
				chatItem: { moderators: ['rc-user-id'] },
				rcUserId: 'rc-user-id'
			})
		).toBe(true);
	});

	it('prepares messages and keeps only one user-left system notification', () => {
		const messages = [
			{
				_id: 'message-1',
				msg: 'Hello',
				ts: '2026-06-29T09:00:00.000Z',
				u: { _id: 'user-1', username: 'user-one', name: 'User One' },
				unread: true
			},
			{
				_id: 'message-2',
				msg:
					'[SYSTEM_NOTIFICATION] ' +
					JSON.stringify({ type: 'USER_LEFT_CHAT' }),
				ts: '2026-06-29T09:01:00.000Z',
				u: { _id: 'system', username: 'system', name: null }
			},
			{
				_id: 'message-3',
				msg:
					'[SYSTEM_NOTIFICATION] ' +
					JSON.stringify({ type: 'USER_LEFT_CHAT' }),
				ts: '2026-06-29T09:02:00.000Z',
				u: { _id: 'system', username: 'system', name: null }
			},
			{
				_id: 'message-4',
				msg: 'Video started',
				ts: '2026-06-29T09:03:00.000Z',
				u: { _id: 'user-2', username: 'user-two', name: null },
				alias: { messageType: 'VIDEOCALL' }
			}
		];

		const prepared = prepareMessages(messages);

		expect(prepared.map((message) => message._id)).toEqual([
			'message-1',
			'message-2',
			'message-4'
		]);
		expect(prepared[0].displayName).toBe('decoded:User One');
		expect(prepared[2].isVideoActive).toBe(true);
	});
});
