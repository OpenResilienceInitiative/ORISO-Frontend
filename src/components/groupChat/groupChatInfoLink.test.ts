import { describe, expect, it } from 'vite-plus/test';
import { getGroupChatInfoLink } from './groupChatInfoLink';

describe('getGroupChatInfoLink', () => {
	// Same path the session menu has always produced (encoded room id).
	it('points at the Chat-Info of the group, keeping the list tab', () => {
		expect(
			getGroupChatInfoLink(
				'/sessions/consultant/sessionView',
				'!room:hs',
				7,
				'?sessionListTab=active'
			)
		).toBe(
			'/sessions/consultant/sessionView/!room%3Ahs/7/groupChatInfo/?sessionListTab=active'
		);
	});

	it('has no target for a chat without a Matrix room', () => {
		expect(
			getGroupChatInfoLink('/sessions/user/view', undefined, 7, '')
		).toBe('');
	});
});
