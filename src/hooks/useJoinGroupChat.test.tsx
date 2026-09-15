// @vitest-environment jsdom

import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiPutGroupChat, GROUP_CHAT_API } from '../api';
import { useJoinGroupChat } from './useJoinGroupChat';

vi.mock('../api', () => ({
	apiPutGroupChat: vi.fn(() => Promise.resolve()),
	GROUP_CHAT_API: { ASSIGN: '/assign', JOIN: '/join' }
}));

const tenant = vi.hoisted(() => ({
	current: { settings: { featureGroupChatV2Enabled: true } } as {
		settings: { featureGroupChatV2Enabled: boolean };
	} | null
}));
vi.mock('../globalState', () => ({
	useTenant: () => tenant.current
}));

describe('useJoinGroupChat', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		tenant.current = { settings: { featureGroupChatV2Enabled: true } };
	});

	it('assigns an invited user before the visible join action and says so', async () => {
		const { result } = renderHook(() => useJoinGroupChat());

		await expect(result.current.joinGroupChat('1013')).resolves.toBe(true);
		expect(apiPutGroupChat).toHaveBeenCalledWith(
			'1013',
			GROUP_CHAT_API.ASSIGN
		);
		expect(result.current.tenantReady).toBe(true);
	});

	it('does nothing while the tenant is still loading, and reports it', async () => {
		tenant.current = null;
		const { result } = renderHook(() => useJoinGroupChat());

		expect(result.current.tenantReady).toBe(false);
		await expect(result.current.joinGroupChat('1013')).resolves.toBe(false);
		expect(apiPutGroupChat).not.toHaveBeenCalled();
	});

	it('resolves false when the feature is off, so nobody navigates', async () => {
		tenant.current = { settings: { featureGroupChatV2Enabled: false } };
		const { result } = renderHook(() => useJoinGroupChat());

		await expect(result.current.joinGroupChat('1013')).resolves.toBe(false);
		expect(apiPutGroupChat).not.toHaveBeenCalled();
	});
});
