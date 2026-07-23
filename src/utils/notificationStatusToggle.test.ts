// @vitest-environment jsdom
/**
 * #576 — sidebar placement preference for the global notification-status
 * button, incl. the restricted-storage path (#586 review: the in-tab state
 * must survive failed localStorage writes via the CustomEvent detail).
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import {
	isNotifStatusViaSidebar,
	setNotifStatusViaSidebar,
	useNotifStatusViaSidebar
} from './notificationStatusToggle';

describe('notificationStatusToggle', () => {
	afterEach(() => {
		localStorage.clear();
		vi.restoreAllMocks();
	});

	it('persists and reads the placement preference', () => {
		expect(isNotifStatusViaSidebar()).toBe(false);
		setNotifStatusViaSidebar(true);
		expect(isNotifStatusViaSidebar()).toBe(true);
		setNotifStatusViaSidebar(false);
		expect(isNotifStatusViaSidebar()).toBe(false);
	});

	it('hook follows changes made elsewhere via the custom event', () => {
		const { result } = renderHook(() => useNotifStatusViaSidebar());
		expect(result.current[0]).toBe(false);
		act(() => setNotifStatusViaSidebar(true));
		expect(result.current[0]).toBe(true);
	});

	it('keeps the in-tab value when localStorage writes fail', () => {
		vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
			throw new Error('quota');
		});
		const { result } = renderHook(() => useNotifStatusViaSidebar());
		act(() => result.current[1](true));
		// storage write failed, but the event detail carried the value
		expect(result.current[0]).toBe(true);
	});
});
