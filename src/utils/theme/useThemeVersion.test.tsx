// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
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
		const { result, unmount } = renderHook(() => useThemeVersion());
		const before = result.current;
		unmount();

		window.dispatchEvent(new Event(THEME_APPLIED_EVENT));

		expect(result.current).toBe(before);
	});
});
