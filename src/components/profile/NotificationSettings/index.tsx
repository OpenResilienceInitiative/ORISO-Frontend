import * as React from 'react';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Headline } from '../../headline/Headline';
import { Text } from '../../text/Text';
import { Switch } from '../../Switch';
import { NotificationDenied } from '../BrowserNotifications/NotificationDenied';
import { useNotificationSettings } from '../../../hooks/useNotificationSettings';
import { NotificationConfigView } from './NotificationConfigDialog';
import { familyLabelKey } from '../../notificationsCenter/eventDescriptors/registry';
import {
	NotificationArea,
	setKindField
} from '../../../utils/notificationSettings/notificationConfig';
import { previewNotificationSound } from '../../../utils/notificationSettings/soundPlayback';
import { useNotifStatusViaSidebar } from '../../../utils/notificationStatusToggle';
import {
	PERMISSION_GRANTED,
	hasPermissions,
	isSupported,
	requestNotificationPermissionSafe
} from '../../../utils/notificationHelpers';
import './notificationSettingsPanel.styles.scss';

/**
 * WP-06 Slice 6b — cross-device notification settings panel.
 *
 * UI over the Slice 6a transport (`useNotificationSettings`): everything here
 * syncs through Matrix account data to every device/browser of the user —
 * except "silence this device", which is deliberately device-scoped
 * (MSC3890 pattern). Structure modeled on Element Web's notification settings
 * (master toggle → per-device → privacy/sound → per-family), reimplemented
 * on ORISO primitives (Switch, Headline, Text).
 */
export const NotificationSettingsPanel = () => {
	const { t } = useTranslation();
	const { settings, deviceSilenced, updateSettings, setDeviceSilenced } =
		useNotificationSettings();

	// Browser permission handling mirrors the legacy panel: enabling asks for
	// permission first; a hard "denied" shows the recovery hint instead.
	const [activeArea, setActiveArea] = useState<NotificationArea>('requests');
	const [notifStatusViaSidebar, setNotifStatusViaSidebar] =
		useNotifStatusViaSidebar();
	const [permission, setPermission] = useState<NotificationPermission>(
		isSupported() ? Notification.permission : 'denied'
	);

	const onBrowserToggle = useCallback(
		(enabled: boolean) => {
			if (!enabled) {
				updateSettings({ browserNotifications: { enabled: false } });
				return;
			}
			if (hasPermissions(PERMISSION_GRANTED)) {
				updateSettings({ browserNotifications: { enabled: true } });
				return;
			}
			// Safe wrapper: resolves in promise AND legacy-callback browsers
			// (old Safari) and never throws.
			requestNotificationPermissionSafe().then((result) => {
				setPermission(result);
				updateSettings({
					browserNotifications: {
						enabled: result === PERMISSION_GRANTED
					}
				});
			});
		},
		[updateSettings]
	);

	return (
		<div className="notifications__content">
			<div className="profile__content__title">
				<Headline
					text={t(
						'profile.notificationSettings.title',
						'Benachrichtigungen'
					)}
					semanticLevel="5"
				/>
				<Text
					text={t(
						'profile.notificationSettings.description',
						'Diese Einstellungen gelten für Ihr Konto auf allen Geräten und Browsern.'
					)}
					type="standard"
					className="tertiary"
				/>
			</div>

			<Switch
				titleKey="profile.notificationSettings.globalMute"
				checked={settings.globalMute}
				onChange={(checked) => updateSettings({ globalMute: checked })}
			/>
			<Switch
				titleKey="profile.notificationSettings.deviceSilence.title"
				descriptionKey="profile.notificationSettings.deviceSilence.description"
				checked={deviceSilenced}
				onChange={setDeviceSilenced}
			/>
			{/* Opt-in: global status button in the navigation rail (like the
			    Live Chat rail toggle) — flips the account-wide mute. */}
			<Switch
				titleKey="profile.notifications.config.statusButton.sidebarToggle"
				descriptionKey="profile.notifications.config.statusButton.sidebarToggleDescription"
				checked={notifStatusViaSidebar}
				onChange={setNotifStatusViaSidebar}
			/>

			<hr />

			{permission === 'denied' ? (
				<NotificationDenied />
			) : (
				<Switch
					titleKey="profile.notificationSettings.browser.title"
					descriptionKey="profile.notificationSettings.browser.description"
					checked={settings.browserNotifications.enabled}
					onChange={onBrowserToggle}
				/>
			)}
			<Switch
				titleKey="profile.notificationSettings.preview.title"
				descriptionKey="profile.notificationSettings.preview.description"
				checked={settings.browserNotifications.showMessagePreview}
				onChange={(checked) =>
					updateSettings({
						browserNotifications: {
							showMessagePreview: checked
						}
					})
				}
			/>
			<hr />

			{/* Harmonised model (2026-07-22): the config tabs live INLINE here
			    and replace the old flat per-family toggle list. Changes save
			    immediately, like every other switch on this page. The dialog
			    wrapper stays as the quick access from a conversation's menu. */}
			<NotificationConfigView
				config={settings.notificationConfig}
				activeArea={activeArea}
				onAreaChange={setActiveArea}
				onChange={(area, kind, field, value) =>
					updateSettings({
						notificationConfig: setKindField(
							settings.notificationConfig,
							area,
							kind,
							field,
							value as never
						)
					})
				}
				onPreview={previewNotificationSound}
			/>

			<hr />

			{/* System notifications stay a single global switch, outside the tabs. */}
			<Switch
				titleKey={familyLabelKey('system')}
				checked={settings.families.system}
				onChange={(checked) =>
					updateSettings({ families: { system: checked } })
				}
			/>
		</div>
	);
};
