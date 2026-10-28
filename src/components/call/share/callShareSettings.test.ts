import { describe, expect, it, vi } from 'vite-plus/test';
import { defaultCallShareSettings, detectWebShare } from './callShareSettings';

describe('defaultCallShareSettings (#1794)', () => {
	it('starts with knocking and a temporary account switched on', () => {
		expect(defaultCallShareSettings()).toEqual({
			knock: true,
			temporaryAccount: true
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
