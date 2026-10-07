import * as React from 'react';
import { useContext, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { UserDataContext } from '../../globalState/context/UserDataContext';
import { apiPatchUserData } from '../../api/apiPatchUserData';
import { useNotificationSettings } from '../../hooks/useNotificationSettings';
import { appConfig } from '../../utils/appConfig';
import {
	browserNotificationsSettings,
	isSupported,
	optInToBrowserNotifications
} from '../../utils/notificationHelpers';
import {
	NotificationChoice,
	NotificationChoiceCard
} from './NotificationChoiceCard';
import { ErstantwortEmailOverlay } from './ErstantwortEmailOverlay';

/** Shared account/device setup, used by first enquiry and optional chat shortcuts.
 * Choice is derived from live account settings; a click is never completion.
 */
export const NotificationSetup = ({
	isEmailEnabled = true
}: {
	isEmailEnabled?: boolean;
}) => {
	const { t } = useTranslation();
	const { userData, reloadUserData } = useContext(UserDataContext);
	const { settings, isSuppressed } = useNotificationSettings();
	const [pending, setPending] = useState<NotificationChoice | null>(null);
	const [emailOpen, setEmailOpen] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);
	const [awaitingBrowser, setAwaitingBrowser] = useState(false);
	const emailActive =
		isEmailEnabled &&
		Boolean(
			userData?.email &&
				userData?.emailNotifications?.emailNotificationsEnabled &&
				userData?.emailNotifications?.settings
					?.newChatMessageNotificationEnabled
		);
	const browserSupported = Boolean(isSupported());
	const browserActive =
		browserSupported &&
		Notification.permission === 'granted' &&
		(appConfig?.releaseToggles?.enableNewNotifications === true
			? settings.browserNotifications?.enabled
			: browserNotificationsSettings().enabled);
	const chosen: NotificationChoice | null =
		emailActive && browserActive
			? 'BOTH'
			: emailActive
				? 'EMAIL'
				: browserActive
					? 'BROWSER'
					: null;

	useEffect(() => {
		if (!isEmailEnabled) {
			setEmailOpen(false);
			setPending(null);
		}
	}, [isEmailEnabled]);

	const finish = async (choice: NotificationChoice) => {
		if (
			(choice !== 'BROWSER' && !isEmailEnabled) ||
			(choice !== 'EMAIL' && !browserSupported)
		)
			return;
		setBusy(true);
		setError(null);
		try {
			if (choice !== 'BROWSER' && !emailActive) {
				await apiPatchUserData({
					emailNotifications: {
						...userData?.emailNotifications,
						emailNotificationsEnabled: true,
						settings: {
							...userData?.emailNotifications?.settings,
							newChatMessageNotificationEnabled: true
						}
					}
				});
				const saved = await reloadUserData();
				if (
					!saved?.email ||
					!saved?.emailNotifications?.emailNotificationsEnabled ||
					!saved?.emailNotifications?.settings
						?.newChatMessageNotificationEnabled
				)
					throw new Error('Not confirmed');
			}
			if (choice === 'BOTH' && !emailActive && !browserActive) {
				// OS prompts need a fresh user gesture after the async email save.
				setAwaitingBrowser(true);
				return;
			}
			if (choice !== 'EMAIL' && !browserActive) {
				await optInToBrowserNotifications();
				setAwaitingBrowser(false);
				if (Notification.permission !== 'granted') {
					setError(
						t(
							'erstantwort.notificationChoice.browserDenied',
							'Browser-Benachrichtigungen sind nicht aktiviert. Bitte prüfen Sie die Berechtigung in Ihrem Browser.'
						)
					);
				}
			}
		} catch {
			setError(
				t(
					'erstantwort.notificationChoice.saveFailed',
					'Die Einstellung konnte nicht bestätigt werden. Bitte versuchen Sie es erneut.'
				)
			);
		} finally {
			setPending(null);
			setBusy(false);
		}
	};

	const choose = (choice: NotificationChoice) => {
		if (
			busy ||
			emailOpen ||
			(choice !== 'BROWSER' && !isEmailEnabled) ||
			(choice !== 'EMAIL' && !browserSupported)
		)
			return;
		setError(null);
		if (choice !== 'BROWSER' && !userData?.email) {
			setPending(choice);
			setEmailOpen(true);
		} else void finish(choice);
	};

	return (
		<>
			<NotificationChoiceCard
				onChoose={choose}
				chosen={chosen}
				controlled
				isEmailEnabled={isEmailEnabled}
				isBrowserNotificationSupported={browserSupported}
				busy={busy || emailOpen}
			/>
			{awaitingBrowser && (
				<button
					type="button"
					className="erstantwort__action"
					disabled={busy}
					onClick={() => void finish('BROWSER')}
				>
					{t(
						'erstantwort.notificationChoice.enableBrowser',
						'Browser aktivieren'
					)}
				</button>
			)}
			{!browserSupported && (
				<p>
					{t(
						'erstantwort.notificationChoice.browserUnsupported',
						'Dieser Browser unterstützt keine Browser-Benachrichtigungen.'
					)}
				</p>
			)}
			{browserActive && isSuppressed('messages') && (
				<p role="status">
					{t(
						'erstantwort.notificationChoice.browserSilenced',
						'Browser-Benachrichtigungen sind in Ihren Benachrichtigungseinstellungen stummgeschaltet.'
					)}
				</p>
			)}
			{error && <p role="alert">{error}</p>}
			{chosen && (
				<p role="status">
					{t(
						'erstantwort.notificationChoice.active',
						'Aktiviert: {{channel}}',
						{
							channel:
								chosen === 'BOTH'
									? t(
											'erstantwort.notificationChoice.channelBoth'
										)
									: chosen === 'EMAIL'
										? t(
												'erstantwort.notificationChoice.channelEmail'
											)
										: t(
												'erstantwort.notificationChoice.channelBrowser'
											)
						}
					)}
				</p>
			)}
			{emailOpen && (
				<ErstantwortEmailOverlay
					onClose={() => {
						setEmailOpen(false);
						setPending(null);
					}}
					onSaved={() => {
						setEmailOpen(false);
						// Continue only after the email endpoint accepted the address.
						if (pending) void finish(pending);
					}}
				/>
			)}
		</>
	);
};
