// @vitest-environment jsdom

import React from 'react';
import { act, render, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiGetTenantTheming } from '../api/apiGetTenantTheming';
import {
	getTenantSettings,
	setTenantSettings
} from '../utils/tenantSettingsHelper';
import { useSessionTenantSettings } from './useSessionTenantSettings';

vi.mock('../api/apiGetTenantTheming', () => ({
	apiGetTenantTheming: vi.fn()
}));

vi.mock('../utils/tenantSettingsHelper', () => ({
	getTenantSettings: vi.fn(),
	setTenantSettings: vi.fn()
}));

describe('useSessionTenantSettings', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(getTenantSettings).mockReturnValue({
			featureAudioCallsAnonymousChatsEnabled: true,
			featureVideoCallsAnonymousChatsEnabled: true
		});
	});

	it('refreshes tenant call permissions when the active session changes', async () => {
		vi.mocked(apiGetTenantTheming)
			.mockResolvedValueOnce({
				settings: {
					featureAudioCallsAnonymousChatsEnabled: true,
					featureVideoCallsAnonymousChatsEnabled: true
				}
			} as any)
			.mockResolvedValueOnce({
				settings: {
					featureAudioCallsAnonymousChatsEnabled: false,
					featureVideoCallsAnonymousChatsEnabled: false
				}
			} as any);

		const { result, rerender } = renderHook(
			({ sessionKey }) => useSessionTenantSettings(sessionKey),
			{ initialProps: { sessionKey: 'session-16' } }
		);

		await waitFor(() => expect(apiGetTenantTheming).toHaveBeenCalledTimes(1));
		rerender({ sessionKey: 'session-17' });

		await waitFor(() =>
			expect(
				result.current.settings
					.featureAudioCallsAnonymousChatsEnabled
			).toBe(false)
		);
		expect(
			result.current.settings.featureVideoCallsAnonymousChatsEnabled
		).toBe(false);
		expect(result.current.isLoading).toBe(false);
		expect(apiGetTenantTheming).toHaveBeenCalledTimes(2);
		expect(setTenantSettings).toHaveBeenLastCalledWith(
			expect.objectContaining({
				featureAudioCallsAnonymousChatsEnabled: false,
				featureVideoCallsAnonymousChatsEnabled: false
			})
		);
	});

	it('hides stale permissions on the first render after a session change', async () => {
		vi.mocked(apiGetTenantTheming).mockResolvedValue({
			settings: {
				featureAudioCallsAnonymousChatsEnabled: true,
				featureVideoCallsAnonymousChatsEnabled: true
			}
		} as any);
		const renders: Array<{ sessionKey: string; isLoading: boolean }> = [];
		const Probe = ({ sessionKey }: { sessionKey: string }) => {
			const { isLoading } = useSessionTenantSettings(sessionKey);
			renders.push({ sessionKey, isLoading });
			return null;
		};
		const view = render(<Probe sessionKey="session-16" />);

		await waitFor(() =>
			expect(renders.at(-1)).toEqual({
				sessionKey: 'session-16',
				isLoading: false
			})
		);
		renders.length = 0;

		view.rerender(<Probe sessionKey="session-17" />);

		expect(renders[0]).toEqual({
			sessionKey: 'session-17',
			isLoading: true
		});
	});

	it('retains the last valid settings when a refresh fails', async () => {
		vi.mocked(apiGetTenantTheming)
			.mockResolvedValueOnce({
				settings: {
					featureAudioCallsAnonymousChatsEnabled: false,
					featureVideoCallsAnonymousChatsEnabled: false
				}
			} as any)
			.mockRejectedValueOnce(new Error('temporary tenant refresh failure'));
		const { result, rerender } = renderHook(
			({ sessionKey }) => useSessionTenantSettings(sessionKey),
			{ initialProps: { sessionKey: 'session-16' } }
		);
		await waitFor(() => expect(result.current.isLoading).toBe(false));

		rerender({ sessionKey: 'session-17' });

		await waitFor(() => expect(apiGetTenantTheming).toHaveBeenCalledTimes(2));
		await waitFor(() => expect(result.current.isLoading).toBe(false));
		expect(result.current.settings).toEqual(
			expect.objectContaining({
				featureAudioCallsAnonymousChatsEnabled: false,
				featureVideoCallsAnonymousChatsEnabled: false
			})
		);
	});

	it('ignores an earlier session response that resolves last', async () => {
		const deferred = <T,>() => {
			let resolve!: (value: T) => void;
			const promise = new Promise<T>((resolvePromise) => {
				resolve = resolvePromise;
			});
			return { promise, resolve };
		};
		const first = deferred<any>();
		const second = deferred<any>();
		vi.mocked(apiGetTenantTheming)
			.mockReturnValueOnce(first.promise)
			.mockReturnValueOnce(second.promise);
		const { result, rerender } = renderHook(
			({ sessionKey }) => useSessionTenantSettings(sessionKey),
			{ initialProps: { sessionKey: 'session-16' } }
		);
		rerender({ sessionKey: 'session-17' });

		await act(async () => {
			second.resolve({
				settings: {
					featureAudioCallsAnonymousChatsEnabled: false,
					featureVideoCallsAnonymousChatsEnabled: false
				}
			});
			await second.promise;
		});
		await waitFor(() => expect(result.current.isLoading).toBe(false));

		await act(async () => {
			first.resolve({
				settings: {
					featureAudioCallsAnonymousChatsEnabled: true,
					featureVideoCallsAnonymousChatsEnabled: true
				}
			});
			await first.promise;
		});

		expect(result.current.settings).toEqual(
			expect.objectContaining({
				featureAudioCallsAnonymousChatsEnabled: false,
				featureVideoCallsAnonymousChatsEnabled: false
			})
		);
	});
});
