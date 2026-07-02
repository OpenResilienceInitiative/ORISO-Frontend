import { describe, expect, it } from 'vitest';
import {
	isConversationCircleSession,
	isInternalGroupChatSession,
	normalizeSessionToolbarChip
} from './sessionToolbarFilters';

describe('session toolbar module helpers', () => {
	it.each([
		['neu', 'unread'],
		['unread', 'unread'],
		['oneToOne', 'nearby'],
		['chats', 'nearby'],
		['nearby', 'nearby'],
		['drafts', 'drafts'],
		['internal', 'internalGroup'],
		['circles', 'groups'],
		['groups', 'groups'],
		['supervision', 'supervision'],
		['unknown', null],
		[null, null]
	])('normalizes %s to %s', (input, expected) => {
		expect(normalizeSessionToolbarChip(input as any)).toBe(expected);
	});

	it('distinguishes conversation circles from internal group chats', () => {
		expect(
			isConversationCircleSession({
				isGroup: true,
				item: { repetitive: true }
			})
		).toBe(true);
		expect(
			isInternalGroupChatSession({
				isGroup: true,
				item: { repetitive: false }
			})
		).toBe(true);
		expect(
			isInternalGroupChatSession({
				isGroup: true,
				item: { repetitive: true }
			})
		).toBe(false);
		expect(isInternalGroupChatSession({ isGroup: false })).toBe(false);
	});
});
