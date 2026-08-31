// @vitest-environment jsdom

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as React from 'react';
import { describe, expect, it, vi } from 'vitest';

const Stub = () => React.createElement('div');
// Distinct stubs so the profile-icon assertions below can tell the
// single-person design-system assets apart from every other rail icon.
const ProfileOutlineStub = () => React.createElement('div');
const ProfileFilledStub = () => React.createElement('div');

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
vi.mock('../../resources/img/icons/profil_outline.svg', () => ({
	ReactComponent: ProfileOutlineStub
}));
vi.mock('../../resources/img/icons/profil_filled.svg', () => ({
	ReactComponent: ProfileFilledStub
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

describe('"My profile" rail icon', () => {
	// #981: the rail used an inlined `supervised_user_circle` glyph (adult with
	// a supervised child). A profile is always a single person — for the
	// counsellor who reported it and for askers alike — so both role configs
	// must point at the single-person design-system assets.
	it.each([
		['consultant', () => RouterConfigConsultant(settings)],
		['asker', () => RouterConfigUser(settings, false)]
	])('uses the single-person profile asset for %s', (_role, build) => {
		const profileItem = build().navigation.find(
			(item) => item.to === '/profile'
		);

		expect(profileItem).toBeDefined();
		expect(profileItem.icon).toBe(ProfileOutlineStub);
		expect(profileItem.iconHover).toBe(ProfileOutlineStub);
		expect(profileItem.iconFilled).toBe(ProfileFilledStub);
	});
});

describe('RouterConfigUser navigation', () => {
	it('does not hide My profile behind an Anonymous- username prefix (#1216)', () => {
		const source = readFileSync(
			join(process.cwd(), 'src/components/app/RouterConfig.tsx'),
			'utf8'
		);
		expect(source).not.toMatch(/startsWith\(\s*['"]Anonymous-['"]\s*\)/);

		const profileItem = RouterConfigUser(settings, false).navigation.find(
			(item) => item.to === '/profile'
		);

		expect(profileItem).toBeDefined();
		expect(profileItem.condition).toBeUndefined();
	});

	it('keeps the Activity Timeline rail item and route but hides it from askers', () => {
		const routerConfig = RouterConfigUser(settings, false);
		const timelineItem = routerConfig.navigation.find(
			(item) => item.to === '/notifications'
		);

		// The rail item must exist — this fails if the route is removed.
		expect(timelineItem).toBeDefined();

		// Askers (ASKER_DEFAULT authority) must not see the timeline …
		const askerData = { grantedAuthorities: ['ASKER_DEFAULT'] };
		vi.mocked(hasUserAuthority).mockReturnValue(true);
		expect(timelineItem.condition(askerData)).toBe(false);
		expect(hasUserAuthority).toHaveBeenCalledWith(
			'ASKER_DEFAULT',
			askerData
		);

		// … while non-asker users do.
		vi.mocked(hasUserAuthority).mockReturnValue(false);
		expect(
			timelineItem.condition({
				grantedAuthorities: ['CONSULTANT_DEFAULT']
			})
		).toBe(true);

		// The NotificationsCenter page itself stays reachable via its route.
		expect(routerConfig.profileRoutes).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					path: '/notifications',
					exact: true
				})
			])
		);
	});
});
