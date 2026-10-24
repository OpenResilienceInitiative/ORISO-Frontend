// @vitest-environment oriso-jsdom
import { describe, expect, it, vi } from 'vite-plus/test';
import { createTenantPublicStoryFetch } from '../../.storybook/tenantPublicFixture';
import {
	resolveCallFeatureGates,
	type CallChatType
} from '../components/call/callFeatureGates';
import {
	beginStoryVerification,
	recordUnexpectedRequest
} from '../../.storybook/verification';

const endpoint = 'https://api.storybook.test/service/tenant/public/';
const origin = 'http://localhost:6006';

describe('ordinary tenant-public Storybook fixture', () => {
	it('returns the restricted object and unchanged optional settings for the exact GET', async () => {
		const delegate = vi.fn<typeof fetch>();
		const fixture = createTenantPublicStoryFetch(delegate, origin);
		const response = await fixture(endpoint);
		expect(response.status).toBe(200);
		expect(response.headers.get('content-type')).toBe('application/json');
		expect(await response.json()).toEqual({
			id: 1,
			name: 'ORISO Storybook',
			settings: {}
		});
		expect(delegate).not.toHaveBeenCalled();
	});

	it('keeps both legacy call modalities enabled for omitted flags in every chat type', async () => {
		const fixture = createTenantPublicStoryFetch(
			vi.fn<typeof fetch>(),
			origin
		);
		const { settings } = await (await fixture(endpoint)).json();
		const chatTypes: CallChatType[] = [
			'anonymous',
			'oneOnOne',
			'group',
			'supervision'
		];
		for (const chatType of chatTypes) {
			expect(resolveCallFeatureGates(settings, chatType)).toEqual({
				audio: true,
				video: true
			});
		}
	});

	it('preserves explicitly disabled call gates instead of enabling controls globally', async () => {
		const fixture = createTenantPublicStoryFetch(
			vi.fn<typeof fetch>(),
			origin,
			{
				featureAudioCallsOneOnOneChatsEnabled: false,
				featureVideoCallsOneOnOneChatsEnabled: true,
				featureGroupChatV2Enabled: true
			}
		);
		const { settings } = await (await fixture(endpoint)).json();
		expect(resolveCallFeatureGates(settings, 'oneOnOne')).toEqual({
			audio: false,
			video: true
		});
		expect(resolveCallFeatureGates(settings, 'group')).toEqual({
			audio: true,
			video: true
		});
		expect(settings.featureGroupChatV2Enabled).toBe(true);
		const disabled = createTenantPublicStoryFetch(
			vi.fn<typeof fetch>(),
			origin,
			{
				featureCallsEnabled: false
			}
		);
		expect(
			resolveCallFeatureGates(
				(await (await disabled(endpoint)).json()).settings,
				'oneOnOne'
			)
		).toEqual({ audio: false, video: false });
	});

	it('captures explicit true, false and language options once without sharing replies', async () => {
		const options = {
			featureAudioCallsAnonymousChatsEnabled: true,
			featureVideoCallsAnonymousChatsEnabled: false,
			activeLanguages: ['de', 'en']
		};
		const fixture = createTenantPublicStoryFetch(
			vi.fn<typeof fetch>(),
			origin,
			options
		);
		options.featureAudioCallsAnonymousChatsEnabled = false;
		options.activeLanguages.push('fr');
		const first = await (await fixture(new Request(endpoint))).json();
		expect(first.settings).toEqual({
			featureAudioCallsAnonymousChatsEnabled: true,
			featureVideoCallsAnonymousChatsEnabled: false,
			activeLanguages: ['de', 'en']
		});
		first.settings.activeLanguages.push('it');
		expect(
			(await (await fixture(endpoint)).json()).settings.activeLanguages
		).toEqual(['de', 'en']);
	});

	it('supports the configured local service origin and RequestInit GET override', async () => {
		const delegate = vi.fn<typeof fetch>();
		const fixture = createTenantPublicStoryFetch(delegate, origin);
		const response = await fixture(
			new Request(origin + '/service/tenant/public/', { method: 'POST' }),
			{ method: 'GET' }
		);
		expect((await response.json()).id).toBe(1);
		expect(delegate).not.toHaveBeenCalled();
	});

	it.each([
		['POST', endpoint],
		['OPTIONS', endpoint],
		['GET', endpoint + 'id/14'],
		['GET', endpoint.slice(0, -1)],
		['GET', endpoint + '?unexpected=1'],
		['GET', 'https://auth.storybook.test/service/tenant/public/']
	])('keeps strict rejection for %s %s', async (method, url) => {
		const delegate = vi.fn<typeof fetch>(async (input, init) =>
			recordUnexpectedRequest(new Request(input, init))
		);
		const fixture = createTenantPublicStoryFetch(delegate, origin);
		const finish = beginStoryVerification();
		try {
			await expect(fixture(url, { method })).rejects.toThrow(
				'Unexpected product API request'
			);
			expect(delegate).toHaveBeenCalledWith(url, { method });
		} finally {
			await expect(finish.complete()).rejects.toThrow(
				'unexpected-request'
			);
		}
	});

	it('restores the prior fetch through actual story completion for A→B→A', async () => {
		const original = globalThis.fetch;
		for (const enabled of [false, true, false]) {
			const fixture = createTenantPublicStoryFetch(original, origin, {
				featureAudioCallsAnonymousChatsEnabled: enabled
			});
			const finish = beginStoryVerification();
			globalThis.fetch = fixture;
			try {
				const response = await globalThis.fetch(endpoint);
				expect(
					(await response.json()).settings
						.featureAudioCallsAnonymousChatsEnabled
				).toBe(enabled);
			} finally {
				await finish.complete();
			}
			expect(globalThis.fetch).toBe(original);
		}
	});

	it('restores fetch even when strict verification rejects the story', async () => {
		const original = globalThis.fetch;
		const delegate = vi.fn<typeof fetch>(async (input, init) =>
			recordUnexpectedRequest(new Request(input, init))
		);
		const fixture = createTenantPublicStoryFetch(delegate, origin);
		const finish = beginStoryVerification();
		globalThis.fetch = fixture;
		try {
			await expect(
				globalThis.fetch(endpoint, { method: 'POST' })
			).rejects.toThrow('Unexpected product API request');
		} finally {
			await expect(finish.complete()).rejects.toThrow(
				'unexpected-request'
			);
		}
		expect(globalThis.fetch).toBe(original);
	});

	it('delegates an unrelated request with its original body and options intact', async () => {
		const response = new Response('owned local fixture', { status: 202 });
		const delegate = vi.fn<typeof fetch>().mockResolvedValue(response);
		const fixture = createTenantPublicStoryFetch(delegate, origin);
		const init = {
			method: 'POST',
			body: 'exact-body',
			headers: { 'X-Story': 'local' }
		};
		expect(await fixture('/service/drafts', init)).toBe(response);
		expect(delegate).toHaveBeenCalledWith('/service/drafts', init);
	});
});
