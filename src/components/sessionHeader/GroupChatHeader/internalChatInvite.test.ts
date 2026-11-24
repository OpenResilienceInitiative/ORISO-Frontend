import { describe, expect, it } from 'vite-plus/test';
import { canInviteToInternalChat } from './internalChatInvite';

const base = {
	isInternalGroup: true,
	isConsultant: true,
	isActive: true,
	isJoinView: false
};

describe('canInviteToInternalChat (ORISO-Frontend#2023)', () => {
	it('lets a counsellor in a running internal chat bring in colleagues', () => {
		expect(canInviteToInternalChat(base)).toBe(true);
	});

	it.each([
		['a self-help or other group chat', { isInternalGroup: false }],
		['an asker', { isConsultant: false }],
		['a chat that has not started or has ended', { isActive: false }],
		['the join view before taking part', { isJoinView: true }]
	])('keeps the plus disabled for %s', (_, change) => {
		expect(canInviteToInternalChat({ ...base, ...change })).toBe(false);
	});
});
