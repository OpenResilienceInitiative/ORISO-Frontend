// @vitest-environment oriso-jsdom
import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vite-plus/test';
import useIsFirstVisit, { STORAGE_KEY_VISITED } from './useIsFirstVisit';

/*
 * #2272 follow-up: the login page's brand intro (2.5 s of full red before the
 * form) played in every new tab, and a returning visit painted one frame of
 * the closed red stage because the hook said "first visit" until its effect.
 */
describe('useIsFirstVisit', () => {
	beforeEach(() => {
		localStorage.clear();
		sessionStorage.clear();
	});

	it('is a first visit only once per browser', () => {
		expect(renderHook(() => useIsFirstVisit()).result.current).toBe(true);
		sessionStorage.clear(); // a new tab
		expect(renderHook(() => useIsFirstVisit()).result.current).toBe(false);
	});

	it('knows a returning visit on the first render already', () => {
		localStorage.setItem(STORAGE_KEY_VISITED, 'true');
		const renders: boolean[] = [];
		renderHook(() => {
			const value = useIsFirstVisit();
			renders.push(value);
			return value;
		});
		expect(renders[0]).toBe(false);
	});

	it('counts an earlier visit in this tab too', () => {
		sessionStorage.setItem(STORAGE_KEY_VISITED, 'true');
		expect(renderHook(() => useIsFirstVisit()).result.current).toBe(false);
	});
});
