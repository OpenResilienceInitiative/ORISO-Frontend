// @vitest-environment jsdom

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiPutGroupChat, GROUP_CHAT_API } from '../api';
import { useJoinGroupChat } from './useJoinGroupChat';

vi.mock('../api', () => ({
	apiPutGroupChat: vi.fn(() => Promise.resolve()),
	GROUP_CHAT_API: { ASSIGN: '/assign', JOIN: '/join' }
}));

vi.mock('../globalState', () => ({
	useTenant: () => ({ settings: { featureGroupChatV2Enabled: true } })
}));

describe('useJoinGroupChat', () => {
	beforeEach(() => vi.clearAllMocks());

	it('joins a V2 Series through the canonical join endpoint', () => {
		const { result } = renderHook(() => useJoinGroupChat());

		act(() => result.current.joinGroupChat('1013'));

		expect(apiPutGroupChat).toHaveBeenCalledWith(
			'1013',
			GROUP_CHAT_API.JOIN
		);
	});
});
