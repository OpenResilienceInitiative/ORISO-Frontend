// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import {
	apiGetRegistrationAddon,
	isRegistrationRef,
	resetRegistrationAddonForTests,
	toRegistrationResult,
	useRegistrationAddon,
	useRegistrationTenantId
} from './registrationAddon';
import { apiGetTenantTheming } from '../api/apiGetTenantTheming';

vi.mock('../api/apiGetTenantTheming', () => ({
	apiGetTenantTheming: vi.fn()
}));

const answer = {
	contract: 'oriso-addon/v1',
	name: 'digisucht-finder',
	version: '1.0.0',
	react: '^19',
	appId: 'finder',
	title: { de: 'Beratungsstelle finden' },
	icon: '/service/addons/digisucht-finder/ui/icons/finder.svg',
	entry: '/service/addons/digisucht-finder/ui/entry.js',
	apiBase: '/service/addons/digisucht-finder/public/api'
};

const respond = (body: unknown, status = 200) =>
	vi
		.spyOn(globalThis, 'fetch')
		.mockResolvedValue(
			new Response(body == null ? null : JSON.stringify(body), { status })
		);

describe('registration add-on', () => {
	afterEach(() => {
		vi.restoreAllMocks();
		vi.useRealTimers();
		resetRegistrationAddonForTests();
	});

	it('asks for the Träger without a login and reads the app', async () => {
		const fetchMock = respond(answer);

		const found = await apiGetRegistrationAddon(7);

		const [url, init] = fetchMock.mock.calls[0];
		expect(String(url)).toMatch(
			/\/service\/addons\/public\/registration\?tenantId=7$/
		);
		expect(init?.credentials).toBe('omit');
		expect(found?.addon).toMatchObject({
			name: 'digisucht-finder',
			entry: answer.entry,
			apiBase: answer.apiBase
		});
		expect(found?.app).toEqual({
			id: 'finder',
			title: { de: 'Beratungsstelle finden' },
			slots: ['registration.agency-finder'],
			icon: answer.icon
		});
	});

	it('has none on 204, on errors and on a foreign contract', async () => {
		respond(null, 204);
		expect(await apiGetRegistrationAddon(7)).toBeNull();
		vi.restoreAllMocks();

		vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'));
		expect(await apiGetRegistrationAddon(7)).toBeNull();
		vi.restoreAllMocks();

		respond({ ...answer, contract: 'oriso-addon/v2' });
		expect(await apiGetRegistrationAddon(7)).toBeNull();
		vi.restoreAllMocks();

		respond({ ...answer, entry: 'https://evil.example/entry.js' });
		expect(await apiGetRegistrationAddon(7)).toBeNull();
	});

	it('gives up after the timeout', async () => {
		vi.useFakeTimers();
		vi.spyOn(globalThis, 'fetch').mockImplementation(
			(_url, init) =>
				new Promise((_resolve, reject) =>
					init?.signal?.addEventListener('abort', () =>
						reject(new DOMException('aborted', 'AbortError'))
					)
				)
		);

		const lookup = apiGetRegistrationAddon(7, 1000);
		await vi.advanceTimersByTimeAsync(1000);

		expect(await lookup).toBeNull();
	});

	it('loads once per Träger and reports none without a Träger', async () => {
		const fetchMock = respond(answer);

		const first = renderHook(() => useRegistrationAddon(7));
		expect(first.result.current.status).toBe('loading');
		await waitFor(() => expect(first.result.current.status).toBe('ready'));
		const second = renderHook(() => useRegistrationAddon(7));
		await waitFor(() => expect(second.result.current.status).toBe('ready'));

		expect(fetchMock).toHaveBeenCalledTimes(1);
		expect(
			renderHook(() => useRegistrationAddon(null)).result.current
		).toEqual({ status: 'none' });
	});

	it('looks the Träger up where the tenant context has no id', async () => {
		vi.mocked(apiGetTenantTheming).mockResolvedValue({ id: 4 } as never);

		expect(
			renderHook(() => useRegistrationTenantId(7, true)).result.current
		).toBe(7);
		expect(
			renderHook(() => useRegistrationTenantId(undefined, false)).result
				.current
		).toBeNull();
		const lookedUp = renderHook(() =>
			useRegistrationTenantId(undefined, true)
		);
		expect(lookedUp.result.current).toBeUndefined();
		await waitFor(() => expect(lookedUp.result.current).toBe(4));
		expect(apiGetTenantTheming).toHaveBeenCalledTimes(1);
		expect(apiGetTenantTheming).toHaveBeenCalledWith(null);
	});

	const hangingUntilAborted = () =>
		vi
			.spyOn(globalThis, 'fetch')
			.mockImplementation(
				(_url, init) =>
					new Promise((_resolve, reject) =>
						init?.signal?.addEventListener('abort', () =>
							reject(new DOMException('aborted', 'AbortError'))
						)
					)
			);

	it('stops waiting for the Träger after the fallback window', async () => {
		vi.useFakeTimers();
		vi.mocked(apiGetTenantTheming).mockReturnValue(new Promise(() => {}));

		const lookedUp = renderHook(() =>
			useRegistrationTenantId(undefined, true)
		);
		await act(() => vi.advanceTimersByTimeAsync(3999));
		expect(lookedUp.result.current).toBeUndefined();
		await act(() => vi.advanceTimersByTimeAsync(1));

		expect(lookedUp.result.current).toBeNull();
	});

	it('gives the add-on only what finding the Träger left of the window', async () => {
		vi.useFakeTimers();
		vi.mocked(apiGetTenantTheming).mockReturnValue(
			new Promise((resolve) =>
				setTimeout(() => resolve({ id: 4 } as never), 3000)
			)
		);
		hangingUntilAborted();

		const lookedUp = renderHook(() =>
			useRegistrationTenantId(undefined, true)
		);
		await act(() => vi.advanceTimersByTimeAsync(3000));
		expect(lookedUp.result.current).toBe(4);

		const addon = renderHook(() => useRegistrationAddon(4));
		await act(() => vi.advanceTimersByTimeAsync(999));
		expect(addon.result.current.status).toBe('loading');
		await act(() => vi.advanceTimersByTimeAsync(1));

		expect(addon.result.current).toEqual({ status: 'none' });
	});

	it('checks what the app hands back', () => {
		expect(
			toRegistrationResult({
				agencyId: 12,
				topicId: '3',
				postcode: '10115',
				consultingType: 0,
				registrationRef: 'abc_DEF-123'
			})
		).toEqual({
			agencyId: 12,
			topicId: 3,
			postcode: '10115',
			consultingType: 0,
			registrationRef: 'abc_DEF-123'
		});
		expect(
			toRegistrationResult({
				agencyId: 12,
				postcode: 'abc',
				registrationRef: 'no spaces'
			})
		).toEqual({ agencyId: 12 });
		expect(toRegistrationResult({ agencyId: 0 })).toBeNull();
		expect(toRegistrationResult(undefined)).toBeNull();
	});

	it('accepts only short refs of letters, digits, _ and -', () => {
		expect(isRegistrationRef('a'.repeat(64))).toBe(true);
		expect(isRegistrationRef('a'.repeat(65))).toBe(false);
		expect(isRegistrationRef('')).toBe(false);
		expect(isRegistrationRef('a/b')).toBe(false);
		expect(isRegistrationRef(5)).toBe(false);
	});
});
