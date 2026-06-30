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
vi.mock('../../utils/videoCallHelpers', () => ({
	hasVideoCallFeature: vi.fn(() => false)
}));
vi.mock('../sessionsList/SessionsListWrapper', () => ({
	SessionsListWrapper: Stub
}));
vi.mock('../askerInfo/AskerInfo', () => ({ AskerInfo: Stub }));
vi.mock('../profile/Profile', () => ({ Profile: Stub }));
vi.mock('../session/SessionViewEmpty', () => ({ SessionViewEmpty: Stub }));
vi.mock('../groupChat/CreateChatView', () => ({ CreateGroupChatView: Stub }));
vi.mock('../groupChat/GroupChatInfo', () => ({ GroupChatInfo: Stub }));
vi.mock('../appointment/Appointments', () => ({ Appointments: Stub }));
vi.mock('../videoConference/VideoConference', () => ({ default: Stub }));
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

const { RouterConfigConsultant } = await import('./RouterConfig');

const settings = {
	useOverviewPage: false,
	disableVideoAppointments: true,
	urls: {
		consultantVideoConference: '/video'
	}
} as any;

describe('RouterConfigConsultant navigation', () => {
	it('exposes the existing drafts center in the consultant rail', () => {
		const routerConfig = RouterConfigConsultant(settings);
		const navigation = routerConfig.navigation;

		expect(navigation.map((item) => item.to)).toEqual(
			expect.arrayContaining(['/notifications', '/drafts', '/profile'])
		);
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
		const draftsIndex = navigation.findIndex(
			(item) => item.to === '/drafts'
		);
		const profileIndex = navigation.findIndex(
			(item) => item.to === '/profile'
		);

		expect(draftsIndex).toBeGreaterThan(notificationIndex);
		expect(draftsIndex).toBeLessThan(profileIndex);
		expect(navigation[draftsIndex]).toMatchObject({
			navSlot: 'row',
			titleKeys: {
				large: 'navigation.drafts'
			}
		});
	});
});
