import { MenuEffectsSettings } from '../../features/menu-effects/MenuEffectsSettings';
import { hasUserAuthority, AUTHORITIES } from '../../globalState';
import { AppConfigInterface } from '../../globalState/interfaces';
import {
	COLUMN_LEFT,
	COLUMN_RIGHT,
	SingleComponentType,
	TabGroups
} from '../../utils/tabsHelper';
import { PasswordReset } from '../passwordReset/PasswordReset';
import { TwoFactorAuth } from '../twoFactorAuth/TwoFactorAuth';
import { EncryptionSettingsPanel } from './EncryptionSettings';
// import { MagicLinksLoginFeature } from './MagicLinksLoginFeature';
import { ConsultantNotifications } from './ConsultantNotifications';
import { EmailNotification } from './EmailNotifications';
import { NotificationSettingsPanel } from './NotificationSettings';
import { DeleteAccount } from './DeleteAccount';
import { Locale } from './Locale';
import { KeyboardShortcutsSettings } from '../../features/keyboard-shortcuts/components/KeyboardShortcutsSettings';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined';
import KeyOutlinedIcon from '@mui/icons-material/KeyOutlined';
import NotificationsOutlinedIcon from '@mui/icons-material/NotificationsOutlined';
import LanguageOutlinedIcon from '@mui/icons-material/LanguageOutlined';
import KeyboardOutlinedIcon from '@mui/icons-material/KeyboardOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import NotificationsActiveOutlinedIcon from '@mui/icons-material/NotificationsActiveOutlined';
import AnimationOutlinedIcon from '@mui/icons-material/AnimationOutlined';
import { BrowserNotification } from './BrowserNotifications';
import { isSupported as isBrowserNotificationSupported } from '../../utils/notificationHelpers';

export const profileRoutesSettings = (
	selectableLocales: string[],
	settings: AppConfigInterface
): (TabGroups | SingleComponentType)[] => [
	{
		title: 'profile.routes.settings.security.title',
		url: '/sicherheit',
		elements: [
			{
				component: PasswordReset,
				icon: LockOutlinedIcon,
				column: COLUMN_LEFT,
				order: 1
			},
			// {
			// 	component: MagicLinksLoginFeature,
			// 	column: COLUMN_LEFT,
			// 	order: 2
			// },
			{
				condition: (userData) => userData.twoFactorAuth?.isEnabled,
				component: TwoFactorAuth,
				icon: ShieldOutlinedIcon,
				column: COLUMN_LEFT,
				order: 2
			},
			// #437 key backup + recovery: encryption settings (recovery key
			// setup / restore / reset). Self-handles the no-crypto case.
			{
				component: EncryptionSettingsPanel,
				icon: KeyOutlinedIcon,
				column: COLUMN_RIGHT,
				order: 3
			}
		]
	},
	{
		title: 'profile.routes.notifications.title',
		url: '/email',
		elements: [
			{
				condition: () =>
					!!settings?.releaseToggles?.enableNewNotifications,
				component: EmailNotification,
				column: COLUMN_LEFT,
				order: 1
			},
			{
				condition: () =>
					!!settings?.releaseToggles?.enableNewNotifications,
				component: NotificationSettingsPanel,
				column: COLUMN_RIGHT,
				order: 1
			},
			{
				condition: (userData) =>
					hasUserAuthority(
						AUTHORITIES.CONSULTANT_DEFAULT,
						userData
					) && !settings?.releaseToggles?.enableNewNotifications,
				component: ConsultantNotifications,
				icon: NotificationsOutlinedIcon,
				column: COLUMN_RIGHT,
				order: 4
			},
			// Legacy per-browser pop-up switch; the cross-device panel owns
			// this screen once enableNewNotifications is on (#1551).
			{
				condition: () =>
					!settings?.releaseToggles?.enableNewNotifications &&
					!!isBrowserNotificationSupported(),
				component: BrowserNotification,
				icon: NotificationsActiveOutlinedIcon,
				column: COLUMN_LEFT,
				order: 4
			}
		]
	},
	{
		title: 'profile.routes.display',
		url: '/anzeige',
		elements: [
			{
				component: MenuEffectsSettings,
				icon: AnimationOutlinedIcon,
				column: COLUMN_RIGHT,
				order: 2
			},
			{
				condition: () => selectableLocales.length > 1,
				component: Locale,
				icon: LanguageOutlinedIcon,
				column: COLUMN_RIGHT,
				order: 5
			}
		]
	},
	{
		title: 'profile.routes.settings.keyboardShortcuts',
		url: '/tastatur',
		elements: [
			{
				component: KeyboardShortcutsSettings,
				icon: KeyboardOutlinedIcon,
				column: COLUMN_RIGHT,
				order: 6
			}
		]
	},
	{
		condition: (userData) =>
			hasUserAuthority(AUTHORITIES.ASKER_DEFAULT, userData),
		component: DeleteAccount,
		icon: DeleteOutlineIcon,
		boxed: false,
		order: 99,
		fullWidth: true
	}
];
