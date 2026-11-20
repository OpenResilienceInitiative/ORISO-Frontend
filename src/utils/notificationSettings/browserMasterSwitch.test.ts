// @vitest-environment oriso-jsdom
import { afterEach, describe, expect, it } from 'vite-plus/test';
import {
	effectiveBrowserNotificationsEnabled,
	recordBrowserNotificationsChoice
} from './browserMasterSwitch';

/**
 * FE#1211 (Frank, 18 Nov): "Benachrichtigungen in diesem Browser erhalten"
 * was off in every new browser, so nobody got a banner until they found the
 * switch. Once the browser has granted permission it now counts as on, until
 * the user decides otherwise in this browser.
 */
describe('effectiveBrowserNotificationsEnabled', () => {
	afterEach(() => localStorage.clear());

	it('is on when the browser granted permission and nobody chose yet', () => {
		expect(effectiveBrowserNotificationsEnabled(false, 'granted')).toBe(
			true
		);
	});

	it('stays off without permission', () => {
		expect(effectiveBrowserNotificationsEnabled(false, 'default')).toBe(
			false
		);
		expect(effectiveBrowserNotificationsEnabled(false, 'denied')).toBe(
			false
		);
	});

	it('keeps an explicit "off" in this browser', () => {
		recordBrowserNotificationsChoice(false);
		expect(effectiveBrowserNotificationsEnabled(false, 'granted')).toBe(
			false
		);
	});

	it('keeps an explicit "on"', () => {
		recordBrowserNotificationsChoice(true);
		expect(effectiveBrowserNotificationsEnabled(true, 'granted')).toBe(
			true
		);
	});

	it('never turns on without permission, whatever was stored', () => {
		recordBrowserNotificationsChoice(true);
		expect(effectiveBrowserNotificationsEnabled(true, 'denied')).toBe(
			false
		);
	});
});
