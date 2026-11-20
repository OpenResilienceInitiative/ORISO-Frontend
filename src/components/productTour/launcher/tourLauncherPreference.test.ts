// @vitest-environment oriso-jsdom
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { act, renderHook } from '@testing-library/react';
import {
	readTourLauncherVisible,
	useTourLauncherVisible,
	writeTourLauncherVisible
} from './tourLauncherPreference';

describe('tour launcher preference', () => {
	afterEach(() => window.localStorage.clear());

	it('is shown by default and per user', () => {
		expect(readTourLauncherVisible('a')).toBe(true);
		writeTourLauncherVisible('a', false);
		expect(readTourLauncherVisible('a')).toBe(false);
		expect(readTourLauncherVisible('b')).toBe(true);
		writeTourLauncherVisible('a', true);
		expect(readTourLauncherVisible('a')).toBe(true);
	});

	it('stays shown when there is no user or storage throws', () => {
		expect(readTourLauncherVisible(undefined)).toBe(true);
		const spy = vi
			.spyOn(Storage.prototype, 'getItem')
			.mockImplementation(() => {
				throw new Error('blocked');
			});
		expect(readTourLauncherVisible('a')).toBe(true);
		spy.mockRestore();
	});

	it('re-renders every reader when the switch changes', () => {
		const first = renderHook(() => useTourLauncherVisible('u1'));
		const second = renderHook(() => useTourLauncherVisible('u1'));
		act(() => first.result.current[1](false));
		expect(first.result.current[0]).toBe(false);
		expect(second.result.current[0]).toBe(false);
		act(() => second.result.current[1](true));
		expect(first.result.current[0]).toBe(true);
	});
});
