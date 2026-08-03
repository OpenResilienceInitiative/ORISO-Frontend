// @vitest-environment jsdom

import { renderHook, waitFor } from '@testing-library/react';
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
});
