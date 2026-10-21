// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { THEME_APPLIED_EVENT } from './applyTenantTheme';
import { useThemeVersion } from './useThemeVersion';

describe('useThemeVersion', () => {
	afterEach(cleanup);

	it('changes each time a tenant palette is applied', () => {
		const { result } = renderHook(() => useThemeVersion());
		const before = result.current;

		act(() => {
			window.dispatchEvent(new Event(THEME_APPLIED_EVENT));
		});
		const afterFirst = result.current;
		act(() => {
			window.dispatchEvent(new Event(THEME_APPLIED_EVENT));
		});

		expect(afterFirst).not.toBe(before);
		expect(result.current).not.toBe(afterFirst);
	});

	it('stops listening once the component is gone', () => {
		const added = vi.spyOn(window, 'addEventListener');
		const removed = vi.spyOn(window, 'removeEventListener');
		const { unmount } = renderHook(() => useThemeVersion());
		const listener = added.mock.calls.find(
			([type]) => type === THEME_APPLIED_EVENT
		)?.[1];
		expect(listener).toBeDefined();

		unmount();

		expect(removed).toHaveBeenCalledWith(THEME_APPLIED_EVENT, listener);
		added.mockRestore();
		removed.mockRestore();
	});
});
