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
