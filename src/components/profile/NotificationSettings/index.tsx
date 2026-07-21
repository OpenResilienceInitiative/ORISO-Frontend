import * as React from 'react';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Headline } from '../../headline/Headline';
import { Text } from '../../text/Text';
import { Switch } from '../../Switch';
import { NotificationDenied } from '../BrowserNotifications/NotificationDenied';
import { useNotificationSettings } from '../../../hooks/useNotificationSettings';
import { NotificationConfigDialog } from './NotificationConfigDialog';
import { ReactComponent as NotificationSettingsIcon } from '../../../resources/img/icons/notification_settings.svg';
import { ALL_FAMILIES } from '../../../utils/notificationSettings/model';
import { familyLabelKey } from '../../notificationsCenter/eventDescriptors';
import {
	PERMISSION_GRANTED,
	hasPermissions,
	isSupported
} from '../../../utils/notificationHelpers';

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
	const [configDialogOpen, setConfigDialogOpen] = useState(false);
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
			Notification.requestPermission().then((result) => {
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
			<button
				type="button"
				className="notificationSettings__soundEntry"
				onClick={() => setConfigDialogOpen(true)}
				data-cy="notif-config-entry"
			>
				<NotificationSettingsIcon />
				<span>{t('profile.notifications.config.title')}</span>
			</button>
			<NotificationConfigDialog
				open={configDialogOpen}
				config={settings.notificationConfig}
				onConfirm={(notificationConfig) => {
					updateSettings({ notificationConfig });
					setConfigDialogOpen(false);
				}}
				onClose={() => setConfigDialogOpen(false)}
			/>

			<hr />

			<div className="profile__content__title">
				<Headline
					text={t(
						'profile.notificationSettings.families.title',
						'Benachrichtigen bei'
					)}
					semanticLevel="5"
				/>
				<Text
					text={t(
						'profile.notificationSettings.families.description',
						'Wählen Sie, welche Ereignis-Familien Benachrichtigungen auslösen dürfen.'
					)}
					type="standard"
					className="tertiary"
				/>
			</div>
			{ALL_FAMILIES.map((family) => (
				<Switch
					key={family}
					titleKey={familyLabelKey(family)}
					checked={settings.families[family]}
					onChange={(checked) =>
						updateSettings({ families: { [family]: checked } })
					}
				/>
			))}
		</div>
	);
};
