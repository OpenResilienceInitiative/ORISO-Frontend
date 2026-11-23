import { describe, expect, it } from 'vite-plus/test';
import { resolveEnquiryTeamChatState } from './enquiryTeamChatState';

describe('resolveEnquiryTeamChatState (FE#2491)', () => {
	const base = { eligible: true, resolved: true, hasRoom: true };

	it('offers nothing when the team chat is not available here', () => {
		expect(
			resolveEnquiryTeamChatState({
				...base,
				eligible: false,
				status: 'OPEN'
			})
		).toBe('unavailable');
	});

	it('offers nothing while the lookup has not answered', () => {
		expect(resolveEnquiryTeamChatState({ ...base, resolved: false })).toBe(
			'pending'
		);
	});

	it('is off when no team chat exists yet', () => {
		expect(resolveEnquiryTeamChatState({ ...base, hasRoom: false })).toBe(
			'off'
		);
	});

	it.each([
		['OPEN', 'on'],
		['CLOSED', 'closed'],
		['ARCHIVED', 'archived']
	] as const)('maps %s to %s', (status, state) => {
		expect(resolveEnquiryTeamChatState({ ...base, status })).toBe(state);
	});
});
