import { describe, expect, it } from 'vite-plus/test';
import type { TopicsDataInterface } from '../../globalState/interfaces';
import type { CallConversation } from './callParty';
import { callConversationParamsOf } from './callHostContext';

const debt = {
	id: 7,
	name: 'Schuldnerberatung (Admin-Name)',
	slug: 'debt',
	internalIdentifier: '',
	description: '',
	titles: { short: '', long: '', registrationDropdown: '', welcome: '' }
} as unknown as TopicsDataInterface;

const custom = {
	id: 9,
	name: 'Mieterberatung',
	slug: 'not-in-the-registration-catalogue',
	internalIdentifier: '',
	description: '',
	titles: { short: '', long: '', registrationDropdown: '', welcome: '' }
} as unknown as TopicsDataInterface;

const topics = [debt, custom];

const session = (fields: Record<string, unknown>): CallConversation =>
	({ session: { id: 344, ...fields } }) as CallConversation;

const groupChat = (fields: Record<string, unknown>): CallConversation =>
	({ chat: { id: 12, ...fields } }) as CallConversation;

describe('callConversationParamsOf (FE#2233 checkpoint 4)', () => {
	describe('the kind of call', () => {
		it('is single for a 1:1 conversation', () => {
			expect(
				callConversationParamsOf(false, session({}), topics, 'de')
					.callType
			).toBe('single');
		});

		it('stays single for a 1:1 call even when the session is stamped as a group', () => {
			// erstantwortRoomGate: team-agency 1:1 sessions were stamped
			// INTERNAL_GROUP. The call's own kind decides.
			expect(
				callConversationParamsOf(
					false,
					session({ conversationType: 'INTERNAL_GROUP' }),
					topics,
					'de'
				).callType
			).toBe('single');
		});

		it('is circle for a Gesprächskreis (SELF_HELP)', () => {
			expect(
				callConversationParamsOf(
					true,
					groupChat({ conversationType: 'SELF_HELP' }),
					topics,
					'de'
				).callType
			).toBe('circle');
			// Legacy heuristic: a repetitive group chat is a self-help circle.
			expect(
				callConversationParamsOf(
					true,
					groupChat({ repetitive: true }),
					topics,
					'de'
				).callType
			).toBe('circle');
		});

		it('is group for a team group chat (INTERNAL_GROUP)', () => {
			expect(
				callConversationParamsOf(
					true,
					groupChat({ conversationType: 'INTERNAL_GROUP' }),
					topics,
					'de'
				).callType
			).toBe('group');
			expect(
				callConversationParamsOf(
					true,
					groupChat({ repetitive: false }),
					topics,
					'de'
				).callType
			).toBe('group');
		});

		it('is group for a group call whose modality is unknown', () => {
			expect(
				callConversationParamsOf(true, null, topics, 'de').callType
			).toBe('group');
			expect(
				callConversationParamsOf(
					true,
					groupChat({ conversationType: 'SOMETHING_NEW' }),
					topics,
					'de'
				).callType
			).toBe('group');
		});

		it('is group for a supervision room (a counselling session called as a group)', () => {
			expect(
				callConversationParamsOf(
					true,
					session({ topic: { id: 7, name: 'x', description: '' } }),
					topics,
					'de'
				)
			).toEqual({ callType: 'group', topic: null });
		});
	});

	describe('the topic of a 1:1 call', () => {
		it('is the topic as the registration names it, in the app language', () => {
			const conversation = session({
				topic: { id: 7, name: 'ignored', description: '' }
			});
			expect(
				callConversationParamsOf(false, conversation, topics, 'de')
					.topic
			).toBe('Schulden');
			expect(
				callConversationParamsOf(false, conversation, topics, 'en')
					.topic
			).toBe('Debt');
			expect(
				callConversationParamsOf(
					false,
					conversation,
					topics,
					'de@informal'
				).topic
			).toBe('Schulden');
		});

		it('resolves a session that carries only the topic id', () => {
			expect(
				callConversationParamsOf(
					false,
					session({ mainTopicId: 7 }),
					topics,
					'en'
				).topic
			).toBe('Debt');
		});

		it('falls back to the topic name outside the registration catalogue', () => {
			expect(
				callConversationParamsOf(
					false,
					session({ mainTopicId: 9 }),
					topics,
					'de'
				).topic
			).toBe('Mieterberatung');
			// Topics not loaded: the name the session itself carries.
			expect(
				callConversationParamsOf(
					false,
					session({
						topic: { id: 3, name: 'Suchtberatung', description: '' }
					}),
					undefined,
					'de'
				).topic
			).toBe('Suchtberatung');
		});

		it('is null when no topic is known', () => {
			expect(
				callConversationParamsOf(false, session({}), topics, 'de').topic
			).toBeNull();
			expect(
				callConversationParamsOf(
					false,
					session({ mainTopicId: 404 }),
					topics,
					'de'
				).topic
			).toBeNull();
			expect(
				callConversationParamsOf(false, null, topics, 'de').topic
			).toBeNull();
		});

		it('never sends a group call a topic, nor a group chat its own subject', () => {
			expect(
				callConversationParamsOf(
					true,
					groupChat({
						conversationType: 'SELF_HELP',
						topic: 'Montagsrunde Trauer'
					}),
					topics,
					'de'
				).topic
			).toBeNull();
			expect(
				callConversationParamsOf(
					false,
					groupChat({ topic: 'Teamrunde' }),
					topics,
					'de'
				).topic
			).toBeNull();
		});
	});
});
