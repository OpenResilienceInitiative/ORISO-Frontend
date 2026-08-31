/**
 * FE#781 — visibility/enablement matrix for the session-list "Chatroom
 * Settings" menu. Every item the menu renders must resolve to a real handler;
 * actions without a shipped feature behind them are absent, not disabled stubs.
 */
import { describe, expect, it } from 'vitest';
import { SESSION_LIST_TYPES } from '../session/sessionHelpers';
import {
	getChatroomSettingsMenuVisibility,
	withTeamDiscussionParam,
	ChatroomSettingsMenuInput
} from './chatroomSettingsMenu';

const consultantSession = (
	overrides: Partial<ChatroomSettingsMenuInput> = {}
): ChatroomSettingsMenuInput => ({
	isAsker: false,
	isConsultant: true,
	isSupervisorView: false,
	isSession: true,
	isEnquiry: false,
	isGroup: false,
	listType: SESSION_LIST_TYPES.MY_SESSION,
	isArchiveTab: false,
	isAgencyCounselling: true,
	teamDiscussionFeatureEnabled: true,
	hasExistingTeamDiscussion: false,
	isGroupChatOwner: false,
	isGroupChatActive: false,
	hasMatrixRoom: true,
	...overrides
});

// #1189 — a group chat the consultant owns. `isSession` is false for a group
// chat (stateHelpers derives it from `sessionChat`), which is why none of the
// one-to-one flags can ever apply here.
const ownedGroupChat = (
	overrides: Partial<ChatroomSettingsMenuInput> = {}
): ChatroomSettingsMenuInput =>
	consultantSession({
		isSession: false,
		isGroup: true,
		isGroupChatOwner: true,
		isAgencyCounselling: false,
		...overrides
	});

// An enquiry is still a sessionChat (stateHelpers: `isSession = !!sessionChat`),
// so the enquiry list is distinguished by `listType`, not by `isSession`.
const consultantEnquiry = (
	overrides: Partial<ChatroomSettingsMenuInput> = {}
): ChatroomSettingsMenuInput =>
	consultantSession({
		isEnquiry: true,
		isSession: true,
		listType: SESSION_LIST_TYPES.ENQUIRY,
		...overrides
	});

describe('getChatroomSettingsMenuVisibility', () => {
	describe('archive / dearchive', () => {
		it('offers archive on an active consultant session', () => {
			const { showArchive, showDearchive } =
				getChatroomSettingsMenuVisibility(consultantSession());
			expect(showArchive).toBe(true);
			expect(showDearchive).toBe(false);
		});

		it('offers dearchive instead while on the archive tab', () => {
			const { showArchive, showDearchive } =
				getChatroomSettingsMenuVisibility(
					consultantSession({ isArchiveTab: true })
				);
			expect(showArchive).toBe(false);
			expect(showDearchive).toBe(true);
		});

		it('offers neither on an enquiry', () => {
			const { showArchive, showDearchive } =
				getChatroomSettingsMenuVisibility(consultantEnquiry());
			expect(showArchive).toBe(false);
			expect(showDearchive).toBe(false);
		});

		it('offers neither to the asker', () => {
			const { showArchive, showDearchive } =
				getChatroomSettingsMenuVisibility(
					consultantSession({ isAsker: true, isConsultant: false })
				);
			expect(showArchive).toBe(false);
			expect(showDearchive).toBe(false);
		});

		// SessionMenu.tsx gates archive on `!props.isSupervisor`; a read-only
		// observer must not be able to archive a colleague's session here either.
		it('offers neither to a supervisor observing someone else’s session', () => {
			const active = getChatroomSettingsMenuVisibility(
				consultantSession({ isSupervisorView: true })
			);
			expect(active.showArchive).toBe(false);
			expect(active.showDearchive).toBe(false);

			const archived = getChatroomSettingsMenuVisibility(
				consultantSession({
					isSupervisorView: true,
					isArchiveTab: true
				})
			);
			expect(archived.showArchive).toBe(false);
			expect(archived.showDearchive).toBe(false);
		});
	});

	describe('delete — must mirror the session header menu (SessionMenu.tsx)', () => {
		it('is offered to the assigned consultant on an active session', () => {
			expect(
				getChatroomSettingsMenuVisibility(consultantSession())
					.showDelete
			).toBe(true);
		});

		it('is withheld on an enquiry', () => {
			expect(
				getChatroomSettingsMenuVisibility(consultantEnquiry())
					.showDelete
			).toBe(false);
		});

		it('is withheld from a supervisor observing someone else’s session', () => {
			expect(
				getChatroomSettingsMenuVisibility(
					consultantSession({ isSupervisorView: true })
				).showDelete
			).toBe(false);
		});

		it('is withheld from the asker', () => {
			expect(
				getChatroomSettingsMenuVisibility(
					consultantSession({ isAsker: true, isConsultant: false })
				).showDelete
			).toBe(false);
		});

		it('is withheld when the item is not a session', () => {
			expect(
				getChatroomSettingsMenuVisibility(
					consultantSession({ isSession: false })
				).showDelete
			).toBe(false);
		});
	});

	describe('request help — opens the Team-Besprechung (ADR-016)', () => {
		it('is offered to a consultant on an open agency-counselling enquiry', () => {
			expect(
				getChatroomSettingsMenuVisibility(consultantEnquiry())
					.showRequestHelp
			).toBe(true);
		});

		it('is offered on an accepted session that already has a discussion', () => {
			expect(
				getChatroomSettingsMenuVisibility(
					consultantSession({ hasExistingTeamDiscussion: true })
				).showRequestHelp
			).toBe(true);
		});

		it('is withheld on an accepted session with no discussion to open', () => {
			expect(
				getChatroomSettingsMenuVisibility(consultantSession())
					.showRequestHelp
			).toBe(false);
		});

		it('is withheld when the tenant feature toggle is off', () => {
			expect(
				getChatroomSettingsMenuVisibility(
					consultantEnquiry({ teamDiscussionFeatureEnabled: false })
				).showRequestHelp
			).toBe(false);
		});

		it('is withheld outside agency counselling (live chat, self-help)', () => {
			expect(
				getChatroomSettingsMenuVisibility(
					consultantEnquiry({ isAgencyCounselling: false })
				).showRequestHelp
			).toBe(false);
		});

		it('is withheld on group chats', () => {
			expect(
				getChatroomSettingsMenuVisibility(
					consultantEnquiry({ isGroup: true })
				).showRequestHelp
			).toBe(false);
		});

		it('is withheld from the asker — the room must stay invisible to them', () => {
			expect(
				getChatroomSettingsMenuVisibility(
					consultantEnquiry({ isAsker: true, isConsultant: false })
				).showRequestHelp
			).toBe(false);
		});
	});

	// #1189 — the list row must offer the same "Chat settings" entry the header
	// menu already has (SessionMenu.tsx:1007-1022), under the same conditions.
	describe('chat settings — must mirror the session header menu (SessionMenu.tsx)', () => {
		it('is offered to the owner of a group chat that is not running', () => {
			expect(
				getChatroomSettingsMenuVisibility(ownedGroupChat())
					.showChatSettings
			).toBe(true);
		});

		it('is withheld while the group chat is running', () => {
			expect(
				getChatroomSettingsMenuVisibility(
					ownedGroupChat({ isGroupChatActive: true })
				).showChatSettings
			).toBe(false);
		});

		it('is withheld from a consultant who does not own the group chat', () => {
			expect(
				getChatroomSettingsMenuVisibility(
					ownedGroupChat({ isGroupChatOwner: false })
				).showChatSettings
			).toBe(false);
		});

		// The settings route is /:groupId/:sessionId/editGroupChat, so without a
		// materialized room there is no path to navigate to.
		it('is withheld when the chat has no Matrix room yet', () => {
			expect(
				getChatroomSettingsMenuVisibility(
					ownedGroupChat({ hasMatrixRoom: false })
				).showChatSettings
			).toBe(false);
		});

		it('is withheld from the asker', () => {
			expect(
				getChatroomSettingsMenuVisibility(
					ownedGroupChat({ isAsker: true, isConsultant: false })
				).showChatSettings
			).toBe(false);
		});

		it('is withheld on a one-to-one session, which has no group settings', () => {
			expect(
				getChatroomSettingsMenuVisibility(
					consultantSession({ isGroupChatOwner: true })
				).showChatSettings
			).toBe(false);
		});

		it('stays available on the archive tab, where the chat is never running', () => {
			expect(
				getChatroomSettingsMenuVisibility(
					ownedGroupChat({ isArchiveTab: true })
				).showChatSettings
			).toBe(true);
		});

		it('offers no one-to-one action alongside it', () => {
			const visibility =
				getChatroomSettingsMenuVisibility(ownedGroupChat());
			expect(visibility.showArchive).toBe(false);
			expect(visibility.showDearchive).toBe(false);
			expect(visibility.showDelete).toBe(false);
			expect(visibility.showRequestHelp).toBe(false);
		});
	});

	describe('unfinished actions have no backing feature and are never rendered', () => {
		const everyCase: ChatroomSettingsMenuInput[] = [
			consultantSession(),
			consultantSession({ isArchiveTab: true }),
			consultantSession({ isSupervisorView: true }),
			consultantEnquiry(),
			consultantEnquiry({ hasExistingTeamDiscussion: true }),
			consultantSession({ isAsker: true, isConsultant: false }),
			consultantSession({ isGroup: true }),
			ownedGroupChat()
		];

		it('exposes no mute / invite / summarize flag in any configuration', () => {
			everyCase.forEach((input) => {
				const visibility = getChatroomSettingsMenuVisibility(input);
				expect(Object.keys(visibility).sort()).toEqual([
					'showArchive',
					'showChatSettings',
					'showDearchive',
					'showDelete',
					'showRequestHelp'
				]);
			});
		});
	});
});

describe('withTeamDiscussionParam', () => {
	it('appends the panel param with ? on a bare path', () => {
		expect(
			withTeamDiscussionParam('/sessions/consultant/sessionView/42')
		).toBe('/sessions/consultant/sessionView/42?teamDiscussion=1');
	});

	it('appends with & when the path already carries the list-tab param', () => {
		expect(
			withTeamDiscussionParam(
				'/sessions/consultant/sessionView/42?sessionListTab=anonymous'
			)
		).toBe(
			'/sessions/consultant/sessionView/42?sessionListTab=anonymous&teamDiscussion=1'
		);
	});

	it('does not duplicate the param when it is already present', () => {
		expect(withTeamDiscussionParam('/sessions/x/42?teamDiscussion=1')).toBe(
			'/sessions/x/42?teamDiscussion=1'
		);
	});

	it('overwrites a conflicting value instead of appending a second entry', () => {
		expect(withTeamDiscussionParam('/sessions/x/42?teamDiscussion=0')).toBe(
			'/sessions/x/42?teamDiscussion=1'
		);
	});

	it('keeps a fragment as a fragment instead of encoding it into a param', () => {
		expect(
			withTeamDiscussionParam(
				'/sessions/x/42?sessionListTab=archive#details'
			)
		).toBe(
			'/sessions/x/42?sessionListTab=archive&teamDiscussion=1#details'
		);
	});

	it('puts the query before the fragment when the path has no query yet', () => {
		expect(withTeamDiscussionParam('/sessions/x/42#details')).toBe(
			'/sessions/x/42?teamDiscussion=1#details'
		);
	});

	it('preserves other params while setting the flag', () => {
		const result = withTeamDiscussionParam(
			'/sessions/x/42?sessionListTab=archive&teamDiscussion=0'
		);
		const params = new URLSearchParams(result.split('?')[1]);
		expect(params.get('sessionListTab')).toBe('archive');
		expect(params.getAll('teamDiscussion')).toEqual(['1']);
	});
});
