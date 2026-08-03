// @vitest-environment jsdom

import * as React from 'react';
import { describe, expect, it, vi } from 'vitest';

const Stub = () => React.createElement('div');

vi.mock('../../globalState', () => ({
	AUTHORITIES: {
		ASKER_DEFAULT: 'ASKER_DEFAULT',
		CONSULTANT_DEFAULT: 'CONSULTANT_DEFAULT'
	},
	hasUserAuthority: vi.fn(() => false)
}));
vi.mock('../sessionsList/SessionsListWrapper', () => ({
	SessionsListWrapper: Stub
}));
vi.mock('../askerInfo/AskerInfo', () => ({ AskerInfo: Stub }));
vi.mock('../profile/Profile', () => ({ Profile: Stub }));
vi.mock('../session/SessionViewEmpty', () => ({ SessionViewEmpty: Stub }));
vi.mock('../conversationCreate/CreateConversationView', () => ({
	CreateConversationView: Stub
}));
vi.mock('../groupChat/GroupChatInfo', () => ({ GroupChatInfo: Stub }));
vi.mock('../tools/ToolsList', () => ({ ToolsList: Stub }));
vi.mock('../../containers/overview/overview', () => ({ OverviewPage: Stub }));
vi.mock('../../containers/bookings/components/Booking/booking', () => ({
	Booking: Stub
}));
vi.mock(
	'../../containers/bookings/components/BookingCancellation/bookingCancellation',
	() => ({ BookingCancellation: Stub })
);
vi.mock(
	'../../containers/bookings/components/BookingEvents/bookingEvents',
	() => ({ BookingEvents: Stub })
);
vi.mock(
	'../../containers/bookings/components/BookingReschedule/bookingReschedule',
	() => ({ BookingReschedule: Stub })
);
vi.mock('../notificationsCenter/NotificationsCenter', () => ({
	NotificationsCenter: Stub
}));
vi.mock('../draftsCenter/DraftsCenter', () => ({ DraftsCenter: Stub }));
vi.mock('../../resources/img/icons/overview_outline.svg', () => ({
	ReactComponent: Stub
}));
vi.mock('../../resources/img/icons/overview_filled.svg', () => ({
	ReactComponent: Stub
}));
vi.mock('../../resources/img/icons/tools_outline.svg', () => ({
	ReactComponent: Stub
}));
vi.mock('../../resources/img/icons/tools_filled.svg', () => ({
	ReactComponent: Stub
}));
vi.mock('../../resources/img/icons/calendar_outline.svg', () => ({
	ReactComponent: Stub
}));
vi.mock('../../resources/img/icons/calendar_filled.svg', () => ({
	ReactComponent: Stub
}));
vi.mock(
	'../../resources/img/icons/navigation/counsellor_request_400.svg',
	() => ({
		ReactComponent: Stub
	})
);
vi.mock(
	'../../resources/img/icons/navigation/counsellor_request_filled.svg',
	() => ({
		ReactComponent: Stub
	})
);

const { RouterConfigConsultant, RouterConfigUser } = await import(
	'./RouterConfig'
);
const { hasUserAuthority } = await import('../../globalState');

const settings = {
	useOverviewPage: false,
	urls: {}
} as any;

describe('RouterConfigConsultant navigation', () => {
	it('keeps drafts as a route but not as a top-level rail item', () => {
		const routerConfig = RouterConfigConsultant(settings);
		const navigation = routerConfig.navigation;

		// Drafts moved into the individual sections — no longer a rail item.
		expect(navigation.map((item) => item.to)).toEqual(
			expect.arrayContaining(['/notifications', '/profile'])
		);
		expect(navigation.map((item) => item.to)).not.toContain('/drafts');

		// The DraftsCenter page itself stays reachable via its route.
		expect(routerConfig.profileRoutes).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					path: '/drafts',
					exact: true
				})
			])
		);

		const notificationIndex = navigation.findIndex(
			(item) => item.to === '/notifications'
		);
		const profileIndex = navigation.findIndex(
			(item) => item.to === '/profile'
		);
		expect(notificationIndex).toBeGreaterThanOrEqual(0);
		expect(profileIndex).toBeGreaterThan(notificationIndex);
	});
});

describe('RouterConfigUser navigation', () => {
	it('hides the Activity Timeline from askers', () => {
		vi.mocked(hasUserAuthority).mockReturnValue(true);
		const routerConfig = RouterConfigUser(settings);
		const timelineItem = routerConfig.navigation.find(
			(item) => item.to === '/notifications'
		);

		expect(
			timelineItem.condition({ grantedAuthorities: ['ASKER_DEFAULT'] })
		).toBe(false);
	});
});
