import { AUTHORITIES, hasUserAuthority } from '../../globalState';
import { ConsultantInformation } from './ConsultantInformation';
import { ConsultantSpokenLanguages } from './ConsultantSpokenLanguages';
import { ConsultantAgencies } from './ConsultantAgencies';
import { AskerConsultingTypeData } from './AskerConsultingTypeData';
import { ConsultantPrivateData } from './ConsultantPrivateData';
import { AskerAboutMeData } from './AskerAboutMeData';
import { ConsultantStatistics } from './ConsultantStatistics';
import { AbsenceFormular } from './AbsenceFormular';
import { LiveChatAvailability } from './LiveChatAvailability';
import { EnableWalkthrough } from './EnableWalkthrough';
import { TourOverviewSection } from '../productTour/TourOverviewSection';
import { COLUMN_LEFT, COLUMN_RIGHT, TabsType } from '../../utils/tabsHelper';
import { isDesktop } from 'react-device-detect';
import { OverviewBookings } from './OverviewMobile/Bookings';
import { OverviewSessions } from './OverviewMobile/Sessions';
import { profileRoutesSettings } from './profileSettings.routes';
import { profileRoutesHelp } from './profileHelp.routes';
import { NotificationSettingsPanel } from './NotificationSettings';
import {
	TenantDataInterface,
	AppConfigInterface
} from '../../globalState/interfaces';
import { EmailNotification } from './EmailNotifications';
import { BrowserNotification } from './BrowserNotifications';
import { browserNotificationsSettings } from '../../utils/notificationHelpers';
import { AdditionalEnquiry } from './AdditionalEnquiry/AdditionalEnquiry';
import AccessAlarmOutlinedIcon from '@mui/icons-material/AccessAlarmOutlined';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import EventOutlinedIcon from '@mui/icons-material/EventOutlined';
import ExploreOutlinedIcon from '@mui/icons-material/ExploreOutlined';
import ForumOutlinedIcon from '@mui/icons-material/ForumOutlined';
import HomeWorkOutlinedIcon from '@mui/icons-material/HomeWorkOutlined';
import InsertChartOutlinedIcon from '@mui/icons-material/InsertChartOutlined';
import LanguageOutlinedIcon from '@mui/icons-material/LanguageOutlined';
import PersonOutlineIcon from '@mui/icons-material/PersonOutline';
import VisibilityOffOutlinedIcon from '@mui/icons-material/VisibilityOffOutlined';
import { ReactComponent as LiveConversationIcon } from '../../resources/img/icons/live_conv_type.svg';

const shouldShowOverview = (useOverviewPage: boolean, userData) =>
	useOverviewPage &&
	!isDesktop &&
	hasUserAuthority(AUTHORITIES.CONSULTANT_DEFAULT, userData);

const profileRoutes = (
	settings: AppConfigInterface,
	tenant: TenantDataInterface,
	selectableLocales: string[],
	isFirstVisit: boolean
): TabsType =>
	[
		{
			title: 'profile.routes.general.title',
			url: '/allgemeines',
			layout: 'cards',
			elements: [
				{
					condition: (userData) =>
						shouldShowOverview(settings.useOverviewPage, userData),
					title: 'navigation.overview',
					url: '/overview',
					elements: [
						{
							condition: (userData) =>
								shouldShowOverview(
									settings.useOverviewPage,
									userData
								),
							boxed: false,
							component: OverviewSessions,
							icon: ForumOutlinedIcon
						},
						{
							condition: (userData) =>
								shouldShowOverview(
									settings.useOverviewPage,
									userData
								),
							component: OverviewBookings,
							icon: EventOutlinedIcon,
							boxed: false
						}
					]
				},
				{
					title: 'profile.routes.general.public',
					url: '/oeffentlich',
					elements: [
						{
							condition: (userData) =>
								hasUserAuthority(
									AUTHORITIES.CONSULTANT_DEFAULT,
									userData
								),
							component: ConsultantInformation,
							icon: PersonOutlineIcon,
							column: COLUMN_LEFT
						},
						{
							condition: (userData) =>
								hasUserAuthority(
									AUTHORITIES.CONSULTANT_DEFAULT,
									userData
								),
							component: ConsultantSpokenLanguages,
							icon: LanguageOutlinedIcon,
							column: COLUMN_RIGHT
						},
						{
							condition: (userData) =>
								hasUserAuthority(
									AUTHORITIES.CONSULTANT_DEFAULT,
									userData
								),
							component: ConsultantAgencies,
							icon: HomeWorkOutlinedIcon,
							column: COLUMN_LEFT
						},
						{
							condition: (userData) =>
								hasUserAuthority(
									AUTHORITIES.CONSULTANT_DEFAULT,
									userData
								) && settings.enableWalkthrough,
							component: EnableWalkthrough,
							icon: ExploreOutlinedIcon,
							column: COLUMN_RIGHT
						},
						{
							condition: (userData) =>
								hasUserAuthority(
									AUTHORITIES.CONSULTANT_DEFAULT,
									userData
								) && settings.enableWalkthrough,
							component: TourOverviewSection,
							icon: ExploreOutlinedIcon,
							column: COLUMN_RIGHT
						},
						{
							condition: (userData) =>
								!hasUserAuthority(
									AUTHORITIES.CONSULTANT_DEFAULT,
									userData
								),
							component: AskerConsultingTypeData,
							boxed: false,
							order: 2,
							column: COLUMN_RIGHT
						},
						{
							condition: (userData) =>
								!hasUserAuthority(
									AUTHORITIES.CONSULTANT_DEFAULT,
									userData
								),
							component: AdditionalEnquiry,
							icon: AddCircleOutlineIcon,
							order: 3,
							column: COLUMN_RIGHT
						}
					]
				},
				{
					title: 'profile.routes.general.privat',
					url: '/privat',
					elements: [
						{
							condition: (userData) =>
								hasUserAuthority(
									AUTHORITIES.CONSULTANT_DEFAULT,
									userData
								),
							component: ConsultantPrivateData,
							icon: VisibilityOffOutlinedIcon,
							column: settings.enableWalkthrough
								? COLUMN_LEFT
								: COLUMN_RIGHT
						},
						{
							condition: (userData) =>
								!hasUserAuthority(
									AUTHORITIES.CONSULTANT_DEFAULT,
									userData
								),
							component: AskerAboutMeData,
							icon: PersonOutlineIcon,
							order: 1,
							column: COLUMN_LEFT
						}
					]
				}
			]
		},
		{
			title: 'profile.routes.activities.title',
			url: '/aktivitaeten',
			layout: 'cards',
			condition: (userData) =>
				hasUserAuthority(AUTHORITIES.CONSULTANT_DEFAULT, userData),
			elements: [
				{
					title: 'profile.routes.activities.statistics',
					url: '/statistik',
					elements: [
						{
							component: ConsultantStatistics,
							icon: InsertChartOutlinedIcon,
							condition: () =>
								tenant === null ||
								!!tenant?.settings?.featureStatisticsEnabled,
							column: COLUMN_LEFT
						}
					]
				},
				{
					title: 'profile.routes.activities.absence',
					url: '/abwesenheit',
					elements: [
						{
							condition: (userData) =>
								hasUserAuthority(
									AUTHORITIES.CONSULTANT_DEFAULT,
									userData
								),
							component: LiveChatAvailability,
							icon: LiveConversationIcon,
							column:
								tenant === null ||
								tenant?.settings?.featureStatisticsEnabled
									? COLUMN_RIGHT
									: COLUMN_LEFT,
							order: 1
						},
						{
							component: AbsenceFormular,
							icon: AccessAlarmOutlinedIcon,
							column:
								tenant === null ||
								tenant?.settings?.featureStatisticsEnabled
									? COLUMN_RIGHT
									: COLUMN_LEFT,
							order: 2
						}
					]
				}
			]
		},
		{
			title: 'profile.routes.notifications.title',
			url: '/notifications',
			condition: () => false,
			notificationBubble:
				isFirstVisit && !browserNotificationsSettings().visited,
			elements: [
				{
					title: 'profile.routes.notifications.title',
					url: '/email',
					elements: [
						{
							component: EmailNotification,
							column: COLUMN_LEFT
						}
					]
				},
				{
					title: 'profile.browserNotifications.title',
					notificationBubble:
						isFirstVisit && !browserNotificationsSettings().visited,
					url: '/browser',
					elements: [
						// Legacy per-browser panel (localStorage) while the new
						// notification system is toggled off …
						{
							component: BrowserNotification,
							column: COLUMN_RIGHT,
							condition: (userData) =>
								hasUserAuthority(
									AUTHORITIES.CONSULTANT_DEFAULT,
									userData
								) &&
								!settings?.releaseToggles
									?.enableNewNotifications
						},
						// … and the WP-06 Slice 6b cross-device panel (Matrix
						// account data) once it is on. Available to every role:
						// askers get notified about handover consent & messages.
						{
							component: NotificationSettingsPanel,
							column: COLUMN_RIGHT,
							condition: () =>
								!!settings?.releaseToggles
									?.enableNewNotifications
						}
					]
				}
			]
		},
		{
			title: 'profile.routes.settings.title',
			url: '/einstellungen',
			layout: 'cards',
			elements: profileRoutesSettings(selectableLocales, settings)
		},
		{
			title: 'profile.routes.help.title',
			url: '/hilfe',
			layout: 'cards',
			elements: profileRoutesHelp(settings)
		}
	] as TabsType;

export default profileRoutes;
