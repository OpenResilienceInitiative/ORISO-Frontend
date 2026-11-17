// @vitest-environment oriso-jsdom
import * as React from 'react';
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vite-plus/test';
import { ActiveSessionContext } from '../../globalState';
import type { AgencyConversationPolicy } from '../../globalState/interfaces/ConversationFeatureSettings';
import { useRecommendAllowedInModality } from './useRecommendAllowedInModality';

vi.mock('../../utils/authenticatedTenant', () => ({
	getAuthenticatedTenantId: () => 4,
	subscribeToAuthenticatedTenant: () => () => {}
}));

const session = (liveChat: boolean) =>
	({
		item: {
			id: 11,
			agencyId: 21,
			registrationType: liveChat ? 'ANONYMOUS' : 'REGISTERED',
			conversationType: liveChat ? 'LIVE_CHAT' : 'AGENCY_COUNSELLING',
			postcode: liveChat ? 0 : 10115
		},
		isSession: true,
		isGroup: false
	}) as any;

const policy = (enabled: boolean | null): AgencyConversationPolicy => ({
	agencyId: 21,
	tenantId: 4,
	state: 'ready',
	settings: { featureLiveChatFurtherCounsellingEnabled: enabled }
});

const allowed = (
	activeSession: any,
	agencyFeaturePolicy?: AgencyConversationPolicy
) =>
	renderHook(() => useRecommendAllowedInModality(), {
		wrapper: ({ children }) => (
			<ActiveSessionContext.Provider
				value={{ activeSession, agencyFeaturePolicy }}
			>
				{children}
			</ActiveSessionContext.Provider>
		)
	}).result.current;

describe('useRecommendAllowedInModality (FE#2251)', () => {
	it('leaves the 1:1 conversation as before, whatever the centre switch says', () => {
		expect(allowed(session(false), policy(false))).toBe(true);
		expect(allowed(session(false))).toBe(true);
	});

	it('allows the live chat only when the centre switched it on', () => {
		expect(allowed(session(true), policy(true))).toBe(true);
		expect(allowed(session(true), policy(false))).toBe(false);
		expect(allowed(session(true), policy(null))).toBe(false);
	});

	it('refuses the live chat while the centre answer is missing or for another centre', () => {
		expect(allowed(session(true))).toBe(false);
		expect(
			allowed(session(true), { ...policy(true), state: 'loading' })
		).toBe(false);
		expect(allowed(session(true), { ...policy(true), agencyId: 22 })).toBe(
			false
		);
	});
});
