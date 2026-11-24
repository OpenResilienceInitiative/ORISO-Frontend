// @vitest-environment oriso-jsdom
import { beforeEach, describe, expect, it } from 'vite-plus/test';
import { act, renderHook } from '@testing-library/react';
import {
	SIDE_CHAT_INTRO_STORAGE_KEY,
	isSideChatIntroDismissed,
	setSideChatIntroDismissed,
	useSideChatIntroDismissed
} from './sideChatIntroPreference';

describe('sideChatIntroPreference', () => {
	beforeEach(() => {
		window.localStorage.clear();
	});

	it('shows the intro by default', () => {
		expect(isSideChatIntroDismissed('mona', 'team')).toBe(false);
		expect(isSideChatIntroDismissed('mona', 'supervision')).toBe(false);
	});

	it('remembers the choice per user and per side chat', () => {
		setSideChatIntroDismissed('mona', 'team', true);

		expect(isSideChatIntroDismissed('mona', 'team')).toBe(true);
		expect(isSideChatIntroDismissed('mona', 'supervision')).toBe(false);
		expect(isSideChatIntroDismissed('bettina', 'team')).toBe(false);
	});

	it('survives a reload: the choice is read back from storage', () => {
		setSideChatIntroDismissed('mona', 'supervision', true);
		const stored = JSON.parse(
			window.localStorage.getItem(SIDE_CHAT_INTRO_STORAGE_KEY)!
		);

		expect(stored).toEqual({
			version: 1,
			byUser: { mona: { supervision: true } }
		});
	});

	it('shows the intro again on a corrupt stored value', () => {
		window.localStorage.setItem(SIDE_CHAT_INTRO_STORAGE_KEY, '{nope');

		expect(isSideChatIntroDismissed('mona', 'team')).toBe(false);
	});

	it('re-renders every hook instance when the intro is dismissed', () => {
		const button = renderHook(() => useSideChatIntroDismissed('team'));
		const timeline = renderHook(() => useSideChatIntroDismissed('team'));
		expect(timeline.result.current[0]).toBe(false);

		act(() => button.result.current[1]());

		expect(timeline.result.current[0]).toBe(true);
		expect(button.result.current[0]).toBe(true);
	});
});
