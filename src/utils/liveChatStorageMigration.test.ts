// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import {
	LIVE_CHAT_AVAILABILITY_STORAGE_KEY,
	persistLiveChatAvailabilityPreference,
	readLiveChatAvailabilityPreference
} from './liveChatAvailabilityStorage';
import { isLiveChatViaSidebar, setLiveChatViaSidebar } from './liveChatToggle';

/**
 * FE-H05 renamed the live-chat keys from `caritas_*` to `oriso_*`. Consultants
 * who set either preference before the rename must keep it — a silent reset
 * would drop them out of live-chat routing without any visible cause.
 */
const LEGACY_AVAILABILITY_KEY = 'caritas_liveChatAvailability';
const LEGACY_SIDEBAR_KEY = 'caritas_liveChatViaSidebar';

describe('live-chat storage key migration', () => {
	beforeEach(() => {
		localStorage.clear();
	});

	it('adopts a legacy availability preference and retires the old key', () => {
		localStorage.setItem(LEGACY_AVAILABILITY_KEY, '1');

		expect(readLiveChatAvailabilityPreference()).toBe(true);
		expect(localStorage.getItem(LIVE_CHAT_AVAILABILITY_STORAGE_KEY)).toBe(
			'1'
		);
		expect(localStorage.getItem(LEGACY_AVAILABILITY_KEY)).toBeNull();
	});

	it('adopts a legacy sidebar-placement preference and retires the old key', () => {
		localStorage.setItem(LEGACY_SIDEBAR_KEY, '1');

		expect(isLiveChatViaSidebar()).toBe(true);
		expect(localStorage.getItem('oriso_liveChatViaSidebar')).toBe('1');
		expect(localStorage.getItem(LEGACY_SIDEBAR_KEY)).toBeNull();
	});

	it('does not resurrect a legacy preference that was switched off', () => {
		localStorage.setItem(LEGACY_AVAILABILITY_KEY, '0');
		localStorage.setItem(LEGACY_SIDEBAR_KEY, '0');

		expect(readLiveChatAvailabilityPreference()).toBe(false);
		expect(isLiveChatViaSidebar()).toBe(false);
		expect(
			localStorage.getItem(LIVE_CHAT_AVAILABILITY_STORAGE_KEY)
		).toBeNull();
		expect(localStorage.getItem('oriso_liveChatViaSidebar')).toBeNull();
	});

	it('clears the legacy key when a preference is written under the new one', () => {
		localStorage.setItem(LEGACY_AVAILABILITY_KEY, '1');
		localStorage.setItem(LEGACY_SIDEBAR_KEY, '1');

		persistLiveChatAvailabilityPreference(false);
		setLiveChatViaSidebar(false);

		expect(localStorage.getItem(LEGACY_AVAILABILITY_KEY)).toBeNull();
		expect(localStorage.getItem(LEGACY_SIDEBAR_KEY)).toBeNull();
		expect(readLiveChatAvailabilityPreference()).toBe(false);
		expect(isLiveChatViaSidebar()).toBe(false);
	});
});
