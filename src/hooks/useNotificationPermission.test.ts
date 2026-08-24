// @vitest-environment jsdom

import { renderHook, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useNotificationPermission } from './useNotificationPermission';

/**
 * The permission request must only ever fire from a user gesture (Safari
 * enforces this, Chromium down-ranks silent prompts) and only while the
 * browser still reports 'default'. The hook itself is placement-agnostic;
 * AuthenticatedApp is its only consumer, so anonymous visitors on the login
 * page are never prompted (owner report, 2026-08-19).
 */
describe('useNotificationPermission', () => {
	let requestPermission: ReturnType<typeof vi.fn>;
	let permission: NotificationPermission;

	beforeEach(() => {
		permission = 'default';
		requestPermission = vi.fn().mockResolvedValue('granted');
		vi.stubGlobal(
			'Notification',
			class {
				static get permission() {
					return permission;
				}
				static requestPermission = requestPermission;
			}
		);
	});

	afterEach(() => {
		cleanup();
		vi.unstubAllGlobals();
	});

	it('does not ask before any user gesture', () => {
		renderHook(() => useNotificationPermission());

		expect(requestPermission).not.toHaveBeenCalled();
	});

	it('asks exactly once, on the first pointer gesture', () => {
		renderHook(() => useNotificationPermission());

		window.dispatchEvent(new Event('pointerdown'));
		window.dispatchEvent(new Event('pointerdown'));

		expect(requestPermission).toHaveBeenCalledTimes(1);
	});

	it('never asks when the browser already decided', () => {
		permission = 'denied';
		renderHook(() => useNotificationPermission());

		window.dispatchEvent(new Event('pointerdown'));

		expect(requestPermission).not.toHaveBeenCalled();
	});

	it('never asks after unmount (gesture listeners are cleaned up)', () => {
		const { unmount } = renderHook(() => useNotificationPermission());

		unmount();
		window.dispatchEvent(new Event('pointerdown'));

		expect(requestPermission).not.toHaveBeenCalled();
	});
});
