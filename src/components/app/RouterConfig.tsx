import { lazy } from 'react';
import { isDesktop } from 'react-device-detect';
import { SessionsListWrapper } from '../sessionsList/SessionsListWrapper';
import {
	SESSION_LIST_TYPES,
	SESSION_TYPE_ARCHIVED,
	SESSION_TYPE_ENQUIRY,
	SESSION_TYPE_GROUP,
	SESSION_TYPE_SESSION
} from '../session/sessionHelpers';
import { AskerInfo } from '../askerInfo/AskerInfo';
import { Profile } from '../profile/Profile';
import { SessionViewEmpty } from '../session/SessionViewEmpty';
import { CreateConversationView } from '../conversationCreate/CreateConversationView';
import { GroupChatInfo } from '../groupChat/GroupChatInfo';
import { AUTHORITIES, hasUserAuthority } from '../../globalState';
import { AppConfigInterface } from '../../globalState/interfaces';
import { ReactComponent as OverviewIconOutline } from '../../resources/img/icons/overview_outline.svg';
import { ReactComponent as OverviewIconFilled } from '../../resources/img/icons/overview_filled.svg';
import { ReactComponent as ToolsIconOutline } from '../../resources/img/icons/tools_outline.svg';
import { ReactComponent as ToolsIconFilled } from '../../resources/img/icons/tools_filled.svg';
import { ReactComponent as CalendarIconOutline } from '../../resources/img/icons/calendar_outline.svg';
import { ReactComponent as CalendarIconFilled } from '../../resources/img/icons/calendar_filled.svg';
import { ReactComponent as NavCounsellorRequestIcon } from '../../resources/img/icons/navigation/counsellor_request_400.svg';
import { ReactComponent as NavCounsellorRequestIconFilled } from '../../resources/img/icons/navigation/counsellor_request_filled.svg';
import {
	NavChatsIcon,
	NavChatsIconHover,
	NavChatsIconFilled,
	NavActivityIcon,
	NavActivityIconHover,
	NavActivityIconFilled,
	NavProfileIcon,
	NavProfileIconHover,
	NavProfileIconFilled
} from './navigationSidebarIcons';
import { ToolsList } from '../tools/ToolsList';
import { OverviewPage } from '../../containers/overview/overview';
import { Booking } from '../../containers/bookings/components/Booking/booking';
import { BookingCancellation } from '../../containers/bookings/components/BookingCancellation/bookingCancellation';
import { BookingEvents } from '../../containers/bookings/components/BookingEvents/bookingEvents';
import { BookingReschedule } from '../../containers/bookings/components/BookingReschedule/bookingReschedule';
import { NotificationsCenter } from '../notificationsCenter/NotificationsCenter';
import { DraftsCenter } from '../draftsCenter/DraftsCenter';
import { SupportAccessPage } from '../supportAccess/SupportAccessPage';

const SessionView = lazy(() =>
	import('../session/SessionView').then((m) => ({ default: m.SessionView }))
);
const WriteEnquiry = lazy(() =>
	import('../enquiry/WriteEnquiry').then((m) => ({ default: m.WriteEnquiry }))
);

const showAppointmentsMenuItem = (userData, hasAssignedConsultant) => {
	return (
		userData.appointmentFeatureEnabled &&
		(hasUserAuthority(AUTHORITIES.CONSULTANT_DEFAULT, userData) ||
			(hasUserAuthority(AUTHORITIES.ASKER_DEFAULT, userData) &&
				hasAssignedConsultant))
	);
};

const showToolsMenuItem = (userData, consultingTypes, sessionsData, hasTools) =>
	hasTools;

const appointmentRoutes = [
	{
		path: '/booking',
		component: Booking
	},
	{
		path: '/booking/cancellation',
		component: BookingCancellation
	},
	{
		path: '/booking/reschedule',
		component: BookingReschedule
	},
	{
		path: '/booking/events',
		exact: false,
		component: BookingEvents
	}
];

const toolsRoutes = [
	{
		path: '/tools',
		component: ToolsList
	}
];

const overviewRoute = (settings: AppConfigInterface) => ({
	condition: () => settings.useOverviewPage && isDesktop,
	to: '/overview',
	icon: OverviewIconOutline,
	iconFilled: OverviewIconFilled,
	navSlot: 'row' as const,
	titleKeys: {
		large: 'navigation.overview'
	}
});

export const RouterConfigUser = (
	_settings: AppConfigInterface,
	hasAssignedConsultant: boolean
): any => {
	return {
		navigation: [
			{
				to: '/sessions/user/view',
				icon: NavChatsIcon,
				iconHover: NavChatsIconHover,
				iconFilled: NavChatsIconFilled,
				navSlot: 'row' as const,
				titleKeys: {
					large: 'navigation.consultant.enquiries',
					small: 'navigation.consultant.enquiries'
				}
			},
			{
				condition: (userData) => {
					return !hasUserAuthority(
						AUTHORITIES.ASKER_DEFAULT,
						userData
					);
				},
				to: '/notifications',
				icon: NavActivityIcon,
				iconHover: NavActivityIconHover,
				iconFilled: NavActivityIconFilled,
				navSlot: 'tile' as const,
				titleKeys: {
					large: 'navigation.activity'
				}
			},
			{
				condition: (userData) =>
					!userData.userName?.startsWith('Anonymous-'),
				to: '/profile',
				icon: NavProfileIcon,
				iconHover: NavProfileIconHover,
				iconFilled: NavProfileIconFilled,
				navSlot: 'row' as const,
				titleKeys: {
					large: 'navigation.myProfile'
				}
			},
			{
				condition: (userData) =>
					showAppointmentsMenuItem(userData, hasAssignedConsultant),
				to: '/booking/events',
				icon: CalendarIconOutline,
				iconFilled: CalendarIconFilled,
				navSlot: 'row' as const,
				titleKeys: {
					large: 'navigation.booking.events'
				}
			},
			{
				condition: showToolsMenuItem,
				to: '/tools',
				icon: ToolsIconOutline,
				iconFilled: ToolsIconFilled,
				navSlot: 'row' as const,
				titleKeys: {
					large: 'navigation.tools'
				}
			}
		],
		listRoutes: [
			{
				path: '/sessions/user/view/write/:sessionId?',
				component: SessionsListWrapper,
				exact: false,
				sessionTypes: [
					SESSION_TYPE_SESSION,
					SESSION_TYPE_ARCHIVED,
					SESSION_TYPE_GROUP,
					SESSION_TYPE_ENQUIRY
				]
			},
			{
				path: '/sessions/user/view/:groupId?/:sessionId?',
				component: SessionsListWrapper,
				exact: false,
				sessionTypes: [
					SESSION_TYPE_SESSION,
					SESSION_TYPE_ARCHIVED,
					SESSION_TYPE_GROUP,
					SESSION_TYPE_ENQUIRY
				]
			}
		],
		detailRoutes: [
			{
				path: '/sessions/user/view/write/:sessionId?',
				component: WriteEnquiry,
				type: SESSION_LIST_TYPES.ENQUIRY
			},
			// Sessions that have no group id yet (enquiry not started)
			{
				path: '/sessions/user/view/session/:sessionId',
				component: SessionView,
				type: SESSION_LIST_TYPES.MY_SESSION
			},
			// Sessions addressed by their Matrix group id
			{
				path: '/sessions/user/view/:groupId/:sessionId',
				component: SessionView,
				type: SESSION_LIST_TYPES.MY_SESSION
			},
			{
				path: '/sessions/user/view/',
				component: SessionViewEmpty,
				type: SESSION_LIST_TYPES.MY_SESSION
			}
		],
		profileRoutes: [
			{
				path: '/notifications',
				exact: true,
				component: NotificationsCenter
			},
			{
				path: '/drafts',
				exact: true,
				component: DraftsCenter
			},
			{
				path: '/profile',
				exact: false,
				component: Profile
			}
		],
		appointmentRoutes,
		toolsRoutes
	};
};

export const RouterConfigConsultant = (settings: AppConfigInterface): any => {
	return {
		plainRoutes: [],
		navigation: [
			overviewRoute(settings),
			{
				to: '/sessions/consultant/sessionPreview',
				icon: NavCounsellorRequestIcon,
				iconHover: NavCounsellorRequestIcon,
				iconFilled: NavCounsellorRequestIconFilled,
				navSlot: 'row' as const,
				titleKeys: {
					large: 'navigation.consultant.enquiries'
				}
			},
			{
				to: '/sessions/consultant/sessionView',
				icon: NavChatsIcon,
				iconHover: NavChatsIconHover,
				iconFilled: NavChatsIconFilled,
				navSlot: 'row' as const,
				titleKeys: {
					large: 'navigation.consultant.sessions.nav',
					small: 'navigation.consultant.sessions.small'
				}
			},
			{
				to: '/notifications',
				icon: NavActivityIcon,
				iconHover: NavActivityIconHover,
				iconFilled: NavActivityIconFilled,
				navSlot: 'tile' as const,
				titleKeys: {
					large: 'navigation.activity'
				}
			},
			// Drafts moved into the individual sections — it is no longer a
			// top-level rail item (Frank feedback 2026-07-19). The `/drafts`
			// route + DraftsCenter page below remain reachable from sections.
			{
				to: '/profile',
				icon: NavProfileIcon,
				iconHover: NavProfileIconHover,
				iconFilled: NavProfileIconFilled,
				navSlot: 'row' as const,
				titleKeys: {
					large: 'navigation.myProfile'
				}
			},
			{
				condition: showAppointmentsMenuItem,
				to: '/booking/events',
				icon: CalendarIconOutline,
				iconFilled: CalendarIconFilled,
				navSlot: 'row' as const,
				titleKeys: {
					large: 'navigation.booking.events'
				}
			}
		],
		listRoutes: [
			{
				path: '/sessions/consultant/sessionPreview/:groupId?/:sessionId?',
				component: SessionsListWrapper,
				sessionTypes: [SESSION_TYPE_ENQUIRY],
				type: SESSION_LIST_TYPES.ENQUIRY,
				exact: false
			},
			{
				path: '/sessions/consultant/sessionView/:groupId?/:sessionId?',
				component: SessionsListWrapper,
				sessionTypes: [
					SESSION_TYPE_SESSION,
					SESSION_TYPE_ARCHIVED,
					SESSION_TYPE_GROUP
				],
				type: SESSION_LIST_TYPES.MY_SESSION,
				exact: false
			}
		],
		detailRoutes: [
			// Sessions that have no group id yet (enquiry not started)
			{
				path: '/sessions/consultant/sessionPreview/session/:sessionId',
				component: SessionView,
				type: SESSION_LIST_TYPES.ENQUIRY
			},
			{
				path: '/sessions/consultant/sessionView/session/:sessionId',
				component: SessionView,
				type: SESSION_LIST_TYPES.MY_SESSION
			},
			// Sessions addressed by their Matrix group id
			{
				path: '/sessions/consultant/sessionPreview/:groupId/:sessionId',
				component: SessionView,
				type: SESSION_LIST_TYPES.ENQUIRY
			},
			{
				path: '/sessions/consultant/sessionView/:groupId/:sessionId/',
				component: SessionView,
				type: SESSION_LIST_TYPES.MY_SESSION
			},
			{
				path: '/sessions/consultant/sessionPreview/',
				component: SessionViewEmpty,
				type: SESSION_LIST_TYPES.ENQUIRY
			},
			{
				path: '/sessions/consultant/sessionView/',
				component: SessionViewEmpty,
				type: SESSION_LIST_TYPES.MY_SESSION
			},
			{
				path: '/sessions/consultant/sessionView/createGroupChat/',
				component: CreateConversationView,
				type: SESSION_LIST_TYPES.MY_SESSION
			},
			{
				path: '/sessions/consultant/sessionView/:groupId/:sessionId/editGroupChat',
				component: CreateConversationView,
				type: SESSION_LIST_TYPES.MY_SESSION
			}
		],
		userProfileRoutes: [
			// Sessions that have no group id yet (enquiry not started)
			{
				path: '/sessions/consultant/sessionPreview/session/:sessionId/userProfile',
				component: AskerInfo,
				type: SESSION_LIST_TYPES.ENQUIRY
			},
			{
				path: '/sessions/consultant/sessionView/session/:sessionId/userProfile',
				component: AskerInfo,
				type: SESSION_LIST_TYPES.MY_SESSION
			},
			// Sessions addressed by their Matrix group id
			{
				path: '/sessions/consultant/sessionPreview/:groupId/:sessionId/userProfile',
				component: AskerInfo,
				type: SESSION_LIST_TYPES.ENQUIRY
			},
			{
				path: '/sessions/consultant/sessionView/:groupId/:sessionId/userProfile',
				component: AskerInfo,
				type: SESSION_LIST_TYPES.MY_SESSION
			},
			{
				path: '/sessions/consultant/sessionView/:groupId/:sessionId/groupChatInfo',
				component: GroupChatInfo,
				type: SESSION_LIST_TYPES.MY_SESSION
			}
		],
		profileRoutes: [
			{
				path: '/notifications',
				exact: true,
				component: NotificationsCenter
			},
			{
				path: '/drafts',
				exact: true,
				component: DraftsCenter
			},
			{
				path: '/overview',
				component: OverviewPage
			},
			{
				path: '/profile',
				exact: false,
				component: Profile
			}
		],
		appointmentRoutes,
		toolsRoutes
	};
};

export const RouterConfigSupport = (): any => ({
	navigation: [
		{
			to: '/support',
			icon: NavChatsIcon,
			iconHover: NavChatsIconHover,
			iconFilled: NavChatsIconFilled,
			navSlot: 'row' as const,
			titleKeys: {
				large: 'supportAccess.navigation'
			}
		},
		{
			to: '/profile',
			icon: NavProfileIcon,
			iconHover: NavProfileIconHover,
			iconFilled: NavProfileIconFilled,
			navSlot: 'row' as const,
			titleKeys: {
				large: 'navigation.myProfile'
			}
		}
	],
	profileRoutes: [
		{
			path: '/support',
			exact: true,
			component: SupportAccessPage
		},
		{
			path: '/profile',
			exact: false,
			component: Profile
		}
	],
	plainRoutes: [],
	appointmentRoutes: [],
	toolsRoutes: []
});
