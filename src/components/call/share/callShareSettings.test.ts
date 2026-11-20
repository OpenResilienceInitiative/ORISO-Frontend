// @vitest-environment oriso-jsdom
import { describe, expect, it, vi } from 'vite-plus/test';
import {
	copyLinkToClipboard,
	defaultCallShareSettings,
	detectWebShare,
	effectiveCallShareSettings
} from './callShareSettings';

describe('defaultCallShareSettings (#1794)', () => {
	it('starts with knocking on and the guest choosing the account (#1662)', () => {
		expect(defaultCallShareSettings()).toEqual({
			knock: true,
			guestAccountMode: 'GUEST_CHOOSES'
		});
	});
});

describe('detectWebShare', () => {
	it('is null when the browser has no share menu', () => {
		expect(detectWebShare({})).toBeNull();
		expect(detectWebShare(undefined)).toBeNull();
	});

	it('calls navigator.share with the navigator as this', async () => {
		const nav = {
			share: vi.fn(function (this: unknown) {
				expect(this).toBe(nav);
				return Promise.resolve();
			})
		};
		const share = detectWebShare(nav);
		await share?.({ url: 'https://dev.oriso.example/x' });
		expect(nav.share).toHaveBeenCalledWith({
			url: 'https://dev.oriso.example/x'
		});
	});
});

describe('copyLinkToClipboard (review on #1910)', () => {
	it('resolves when the Clipboard API writes the link', async () => {
		const writeText = vi.fn(() => Promise.resolve());
		await copyLinkToClipboard('https://dev.oriso.example/x', {
			clipboard: { writeText }
		});
		expect(writeText).toHaveBeenCalledWith('https://dev.oriso.example/x');
	});

	it('rejects when the Clipboard API refuses', async () => {
		const writeText = vi.fn(() => Promise.reject(new Error('denied')));
		await expect(
			copyLinkToClipboard('x', { clipboard: { writeText } })
		).rejects.toThrow('denied');
	});

	it('rejects when the execCommand fallback copies nothing', async () => {
		const exec = vi.fn(() => false);
		await expect(copyLinkToClipboard('x', {}, exec)).rejects.toThrow();
		expect(exec).toHaveBeenCalledWith('copy');
	});

	it('resolves when the execCommand fallback copies', async () => {
		await expect(
			copyLinkToClipboard('x', {}, () => true)
		).resolves.toBeUndefined();
	});
});

describe('effectiveCallShareSettings (UserService#1662)', () => {
	it('falls back like the server when the chosen mode is not allowed', () => {
		expect(
			effectiveCallShareSettings(
				{ knock: false, guestAccountMode: 'TEMPORARY' },
				['GUEST_CHOOSES', 'PERMANENT']
			)
		).toEqual({ knock: false, guestAccountMode: 'PERMANENT' });
		expect(
			effectiveCallShareSettings(
				{ knock: false, guestAccountMode: 'PERMANENT' },
				['TEMPORARY', 'GUEST_CHOOSES']
			)
		).toEqual({ knock: false, guestAccountMode: 'GUEST_CHOOSES' });
	});

	it('keeps the settings when the mode is allowed, or nothing is known', () => {
		const settings = {
			knock: true,
			guestAccountMode: 'TEMPORARY' as const
		};
		expect(effectiveCallShareSettings(settings, ['TEMPORARY'])).toBe(
			settings
		);
		expect(effectiveCallShareSettings(settings, undefined)).toBe(settings);
	});
});
