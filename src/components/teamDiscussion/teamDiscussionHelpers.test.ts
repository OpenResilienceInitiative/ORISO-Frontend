/**
 * FE#514 — ADR-016 scope rule for the team discussion channel.
 */
import { describe, expect, it } from 'vite-plus/test';
import { isTeamDiscussionAvailable } from './teamDiscussionHelpers';

describe('isTeamDiscussionAvailable', () => {
	const base = {
		isConsultant: true,
		isEnquiry: true,
		isGroup: false,
		isAnonymous: false,
		featureEnabled: true,
		hasExistingDiscussion: false
	};

	it('is available for a consultant on an open registered enquiry', () => {
		expect(isTeamDiscussionAvailable(base)).toBe(true);
	});

	it('is never available for askers', () => {
		expect(
			isTeamDiscussionAvailable({ ...base, isConsultant: false })
		).toBe(false);
	});

	it('is excluded for live chat (anonymous) and groups per ADR-016', () => {
		expect(isTeamDiscussionAvailable({ ...base, isAnonymous: true })).toBe(
			false
		);
		expect(isTeamDiscussionAvailable({ ...base, isGroup: true })).toBe(
			false
		);
	});

	it('is off when the tenant feature toggle is off', () => {
		expect(
			isTeamDiscussionAvailable({ ...base, featureEnabled: false })
		).toBe(false);
	});

	it('stays reachable read-only after acceptance when a discussion exists', () => {
		expect(
			isTeamDiscussionAvailable({
				...base,
				isEnquiry: false,
				hasExistingDiscussion: true
			})
		).toBe(true);
	});

	it('cannot be started on an accepted case without existing discussion', () => {
		expect(isTeamDiscussionAvailable({ ...base, isEnquiry: false })).toBe(
			false
		);
	});
});
