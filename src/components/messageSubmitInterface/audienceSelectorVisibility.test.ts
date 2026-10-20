import { describe, expect, it } from 'vitest';
import {
	getExplicitAudienceValues,
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
