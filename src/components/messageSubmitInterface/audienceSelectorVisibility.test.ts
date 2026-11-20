import { describe, expect, it } from 'vite-plus/test';
import {
	getExplicitAudienceValues,
	retainsGroupAudienceSelection,
	shouldShowAudienceSelector
} from './audienceSelectorVisibility';

describe('shouldShowAudienceSelector', () => {
	it.each([0, 1])(
		'keeps a restricted group actionable while only %s human targets are loaded',
		(targetCount) => {
			const selection = {
				chatType: 'group' as const,
				isClientUser: false,
				targetCount,
				hasAllOption: true,
				selectedValues: ['@homer:example.org']
			};
			expect(shouldShowAudienceSelector(selection)).toBe(true);
			expect(getExplicitAudienceValues(selection)).toEqual([
				'@homer:example.org'
			]);
		}
	);

	it('never renders the legacy recipient selector in one-to-one chats', () => {
		expect(
			shouldShowAudienceSelector({
				chatType: 'oneOnOne',
				isClientUser: false,
				targetCount: 4,
				hasAllOption: true
			})
		).toBe(false);
	});

	it('keeps the selector for real multi-participant group chats', () => {
		expect(
			shouldShowAudienceSelector({
				chatType: 'group',
				isClientUser: false,
				targetCount: 3,
				hasAllOption: true
			})
		).toBe(true);
	});

	it('cannot route a hidden stale 1:1 selection as an aside', () => {
		expect(
			getExplicitAudienceValues({
				chatType: 'oneOnOne',
				isClientUser: false,
				targetCount: 4,
				hasAllOption: true,
				selectedValues: ['@stale-supervisor:example.org']
			})
		).toEqual([]);
	});

	it('returns explicit recipients only when the group selector is visible', () => {
		expect(
			getExplicitAudienceValues({
				chatType: 'group',
				isClientUser: false,
				targetCount: 3,
				hasAllOption: true,
				selectedValues: ['__all__', '@moderator:example.org']
			})
		).toEqual(['@moderator:example.org']);
	});
});

describe('retainsGroupAudienceSelection', () => {
	it.each([
		['group', false, true, true],
		['group', true, true, false],
		['supervision', false, true, true],
		['supervision', true, true, false],
		['supervision', false, false, false],
		['oneOnOne', false, false, false],
		['anonymous', false, false, false]
	] as const)(
		'%s composer (client=%s, group session=%s) retains a restriction: %s',
		(chatType, isClientUser, isGroupSession, retains) => {
			expect(
				retainsGroupAudienceSelection({
					chatType,
					isClientUser,
					isGroupSession
				})
			).toBe(retains);
		}
	);

	it.each([
		['group', false, true],
		['supervision', false, true],
		['group', true, false],
		['supervision', false, false]
	] as const)(
		'a retained restriction always keeps the picker visible (%s, client=%s, group session=%s)',
		(chatType, isClientUser, isGroupSession) => {
			const restricted = {
				chatType,
				isClientUser,
				isGroupSession,
				targetCount: 1,
				hasAllOption: true,
				selectedValues: ['@homer:example.org']
			};
			expect(shouldShowAudienceSelector(restricted)).toBe(
				retainsGroupAudienceSelection(restricted)
			);
		}
	);
});
