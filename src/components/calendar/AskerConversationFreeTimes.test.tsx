// @vitest-environment oriso-jsdom
import * as React from 'react';
import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
	AskerConversationFreeTimes,
	permittedBookingMedia
} from './AskerConversationFreeTimes';

const panel = vi.fn((_props: { media?: readonly string[] }) => null);
vi.mock('./AskerFreeTimesPanel', () => ({
	AskerFreeTimesPanel: (props: { media?: readonly string[] }) => panel(props)
}));

let tenant: { settings?: Record<string, boolean>; isLoading: boolean };
let policyState: 'loading' | 'ready' | 'unavailable';
let consultingType: { isVideoCallAllowed?: boolean } | undefined;
vi.mock('../../hooks/useSessionTenantSettings', () => ({
	useSessionTenantSettings: () => tenant
}));
vi.mock('../../hooks/useSessionAgencyPolicy', () => ({
	useSessionAgencyPolicy: (_key: unknown, agencyId?: number) => ({
		policy: { agencyId: agencyId ?? null, state: policyState }
	})
}));
vi.mock('../../hooks/useConversationFeatureSettings', () => ({
	resolveFeaturesForAgencyPolicy: (settings: unknown) => settings ?? {}
}));
vi.mock('../../globalState', () => ({
	useConsultingType: () => consultingType
}));

const renderIt = () =>
	render(
		<AskerConversationFreeTimes
			sessionId={12}
			agencyId={7}
			consultingTypeId={1}
			chatType="oneOnOne"
			counsellorName="Laura Berger"
			loadSlots={vi.fn()}
			bookSlot={vi.fn()}
		/>
	);

describe('permittedBookingMedia', () => {
	it('offers the media whose calls are on, video first', () => {
		expect(
			permittedBookingMedia({
				videoCallAllowed: true,
				gates: { video: true, audio: true }
			})
		).toEqual(['VIDEO', 'PHONE']);
		expect(
			permittedBookingMedia({
				videoCallAllowed: true,
				gates: { video: true, audio: false }
			})
		).toEqual(['VIDEO']);
	});

	it('offers nothing where the consulting type has no calls', () => {
		expect(
			permittedBookingMedia({
				videoCallAllowed: false,
				gates: { video: true, audio: true }
			})
		).toEqual([]);
	});
});

describe('AskerConversationFreeTimes (FE#2494 *2c)', () => {
	beforeEach(() => {
		panel.mockClear();
		tenant = { settings: {}, isLoading: false };
		policyState = 'ready';
		consultingType = { isVideoCallAllowed: true };
	});

	it('hands the panel only the media the conversation permits', () => {
		tenant = {
			settings: { featureAudioCallsOneOnOneChatsEnabled: false },
			isLoading: false
		};
		renderIt();
		expect(panel).toHaveBeenCalledWith(
			expect.objectContaining({ media: ['VIDEO'] })
		);
	});

	it('shows no panel when no call may be booked', () => {
		tenant = { settings: { featureCallsEnabled: false }, isLoading: false };
		renderIt();
		expect(panel).not.toHaveBeenCalled();
	});

	it('waits for the tenant and agency answers', () => {
		policyState = 'loading';
		renderIt();
		expect(panel).not.toHaveBeenCalled();
	});
});
