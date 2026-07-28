import { describe, expect, it } from 'vitest';
import { getSessionNavigationPath } from './sessionsListItemHelpers';

describe('getSessionNavigationPath', () => {
	it('keeps Matrix group chats on the group-room route', () => {
		expect(
			getSessionNavigationPath({
				listPath: '/sessions/user/view',
				sessionId: 1,
				groupId: '!room:matrix.localhost',
				isGroup: true,
				isAsker: true,
				isEmptyEnquiry: false,
				tabSuffix: ''
			})
		).toBe('/sessions/user/view/!room%3Amatrix.localhost/1');
	});

	it('falls back to the resolved room id for group chats', () => {
		expect(
			getSessionNavigationPath({
				listPath: '/sessions/user/view',
				sessionId: 1,
				groupId: undefined,
				rid: '!resolved-room:matrix.localhost',
				isGroup: true,
				isAsker: true,
				isEmptyEnquiry: false,
				tabSuffix: ''
			})
		).toBe('/sessions/user/view/!resolved-room%3Amatrix.localhost/1');
	});

	it('keeps ordinary Matrix sessions on the session-id route', () => {
		expect(
			getSessionNavigationPath({
				listPath: '/sessions/user/view',
				sessionId: 4,
				groupId: '!session:matrix.localhost',
				isGroup: false,
				isAsker: true,
				isEmptyEnquiry: false,
				tabSuffix: ''
			})
		).toBe('/sessions/user/view/session/4');
	});

	it('opens a consultant live chat through the Matrix room-id route (#774)', () => {
		// A consultant opening an answered live chat must use the same room-id
		// route the accept flow uses; the /session/:id route resolves through a
		// different backend lookup that returns nothing for answered live chats.
		expect(
			getSessionNavigationPath({
				listPath: '/sessions/consultant/sessionView',
				sessionId: 42,
				groupId: '!livechat:matrix.localhost',
				isGroup: false,
				isAsker: false,
				isEmptyEnquiry: false,
				isLiveChat: true,
				tabSuffix: ''
			})
		).toBe(
			'/sessions/consultant/sessionView/!livechat%3Amatrix.localhost/42'
		);
	});

	it('falls back to the resolved room id for a consultant live chat', () => {
		expect(
			getSessionNavigationPath({
				listPath: '/sessions/consultant/sessionView',
				sessionId: 43,
				groupId: undefined,
				rid: '!livechat-rid:matrix.localhost',
				isGroup: false,
				isAsker: false,
				isEmptyEnquiry: false,
				isLiveChat: true,
				tabSuffix: '?sessionListTab=all'
			})
		).toBe(
			'/sessions/consultant/sessionView/!livechat-rid%3Amatrix.localhost/43?sessionListTab=all'
		);
	});

	it('keeps an asker live chat on the session-id route', () => {
		// Only the consultant open path is affected by #774; the asker keeps its
		// existing routing.
		expect(
			getSessionNavigationPath({
				listPath: '/sessions/user/view',
				sessionId: 44,
				groupId: '!livechat:matrix.localhost',
				isGroup: false,
				isAsker: true,
				isEmptyEnquiry: false,
				isLiveChat: true,
				tabSuffix: ''
			})
		).toBe('/sessions/user/view/session/44');
	});

	it('keeps an empty enquiry on its current list route and tab', () => {
		expect(
			getSessionNavigationPath({
				listPath: '/sessions/user/view',
				sessionId: 9,
				isGroup: false,
				isAsker: true,
				isEmptyEnquiry: true,
				tabSuffix: '?state=enquiry'
			})
		).toBe('/sessions/user/view/write/9?state=enquiry');
	});

	it('URL-encodes legacy non-Matrix group identifiers', () => {
		expect(
			getSessionNavigationPath({
				listPath: '/sessions/consultant/sessionView',
				sessionId: 12,
				groupId: 'legacy/group?one',
				isGroup: false,
				isAsker: false,
				isEmptyEnquiry: false,
				tabSuffix: ''
			})
		).toBe('/sessions/consultant/sessionView/legacy%2Fgroup%3Fone/12');
	});
});
