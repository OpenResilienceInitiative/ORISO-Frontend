import * as React from 'react';
import { useContext, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { UserDataContext } from '../../globalState/context/UserDataContext';
import { apiPatchUserData } from '../../api/apiPatchUserData';
import { useNotificationChannels } from './useNotificationChannels';
import { useTenant } from '../../globalState/provider/TenantProvider';
import { optInToBrowserNotifications } from '../../utils/notificationHelpers';
import {
	NotificationChoice,
	NotificationChoiceCard
} from './NotificationChoiceCard';
import { ErstantwortEmailOverlay } from './ErstantwortEmailOverlay';

/** Shared account/device setup, used by first enquiry and optional chat shortcuts.
 * Choice is derived from live account settings; a click is never completion.
 */
export const NotificationSetup = ({
	isEmailEnabled = true,
	onStart
}: {
	isEmailEnabled?: boolean;
	onStart?: () => void;
}) => {
	const { t } = useTranslation();
	const { userData, reloadUserData } = useContext(UserDataContext);
	const tenant = useTenant();
	const continuation = useRef(0);
	const { emailActive, browserActive, browserSupported, browserSilenced } =
		useNotificationChannels(isEmailEnabled);
	const [pending, setPending] = useState<NotificationChoice | null>(null);
	const [emailOpen, setEmailOpen] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);
	const [awaitingBrowser, setAwaitingBrowser] = useState(false);
	const chosen: NotificationChoice | null =
		emailActive && browserActive
			? 'BOTH'
			: emailActive
				? 'EMAIL'
				: browserActive
					? 'BROWSER'
					: null;

	useEffect(() => {
		continuation.current += 1;
		setEmailOpen(false);
		setPending(null);
		setBusy(false);
		setAwaitingBrowser(false);
		setError(null);
		return () => {
			continuation.current += 1;
		};
	}, [isEmailEnabled, tenant?.id, userData?.userId]);

	const finish = async (choice: NotificationChoice) => {
		if (
			(choice !== 'BROWSER' && !isEmailEnabled) ||
			(choice !== 'EMAIL' && !browserSupported)
		)
			return;
		const operation = continuation.current;
		const current = () => continuation.current === operation;
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
				if (!current()) return;
				const saved = await reloadUserData();
				if (!current()) return;
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
				if (!current()) return;
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
			if (!current()) return;
			setError(
				t(
					'erstantwort.notificationChoice.saveFailed',
					'Die Einstellung konnte nicht bestätigt werden. Bitte versuchen Sie es erneut.'
				)
			);
		} finally {
			if (current()) {
				setPending(null);
				setBusy(false);
			}
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
		onStart?.();
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
			{browserActive && browserSilenced && (
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
						continuation.current += 1;
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
