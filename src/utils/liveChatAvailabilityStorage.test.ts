// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import {
	LIVE_CHAT_AVAILABILITY_CHANGE_EVENT,
	LIVE_CHAT_AVAILABILITY_STORAGE_KEY,
	LEGACY_LIVE_CHAT_AVAILABILITY_STORAGE_KEY,
	persistLiveChatAvailabilityPreference,
	readLiveChatAvailabilityPreference
} from './liveChatAvailabilityStorage';

describe('live-chat availability storage keys', () => {
	beforeEach(() => {
		localStorage.clear();
	});

	it('namespaces storage under oriso, not under the Caritas legacy prefix', () => {
		expect(LIVE_CHAT_AVAILABILITY_STORAGE_KEY).toBe(
			'oriso_liveChatAvailability'
		);
		expect(LIVE_CHAT_AVAILABILITY_CHANGE_EVENT).toBe(
			'oriso:liveChatAvailabilityChange'
		);
	});

	it('still reads a preference written under the legacy Caritas key', () => {
		localStorage.setItem(LEGACY_LIVE_CHAT_AVAILABILITY_STORAGE_KEY, '1');

		expect(readLiveChatAvailabilityPreference()).toBe(true);
	});

	it('migrates the legacy key away once the preference is written again', () => {
		localStorage.setItem(LEGACY_LIVE_CHAT_AVAILABILITY_STORAGE_KEY, '1');

		persistLiveChatAvailabilityPreference(true);

		expect(localStorage.getItem(LIVE_CHAT_AVAILABILITY_STORAGE_KEY)).toBe(
			'1'
		);
		expect(
			localStorage.getItem(LEGACY_LIVE_CHAT_AVAILABILITY_STORAGE_KEY)
		).toBeNull();
	});

	it('clears both the current and the legacy key when switching off', () => {
		localStorage.setItem(LEGACY_LIVE_CHAT_AVAILABILITY_STORAGE_KEY, '1');
		localStorage.setItem(LIVE_CHAT_AVAILABILITY_STORAGE_KEY, '1');

		persistLiveChatAvailabilityPreference(false);

		expect(readLiveChatAvailabilityPreference()).toBe(false);
		expect(
			localStorage.getItem(LEGACY_LIVE_CHAT_AVAILABILITY_STORAGE_KEY)
		).toBeNull();
	});
});
