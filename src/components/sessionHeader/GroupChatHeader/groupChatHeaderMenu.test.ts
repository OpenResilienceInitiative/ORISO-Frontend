import { describe, expect, it } from 'vitest';
import { shouldShowGroupChatMenu } from './groupChatHeaderMenu';

describe('shouldShowGroupChatMenu', () => {
	it('shows the menu to consultants in an active joined group chat', () => {
		expect(
			shouldShowGroupChatMenu({
				isActive: true,
				isJoinGroupChatView: false
			})
		).toBe(true);
	});

	it('shows the menu to askers in an active joined group chat', () => {
		expect(
			shouldShowGroupChatMenu({
				isActive: true,
				isJoinGroupChatView: false
			})
		).toBe(true);
	});

	it.each([
		{ isActive: false, isJoinGroupChatView: false },
		{ isActive: true, isJoinGroupChatView: true }
	])('hides the menu when the active joined view is unavailable', (state) => {
		expect(shouldShowGroupChatMenu(state)).toBe(false);
	});
});
