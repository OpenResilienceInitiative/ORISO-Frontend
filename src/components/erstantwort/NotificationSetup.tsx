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
import {
	DEFAULT_FIRST_TONE,
	NotificationBrowserDialog
} from './NotificationBrowserDialog';
import { notificationSettingsStore } from '../../utils/notificationSettings/store';
import { AREA_KINDS } from '../../utils/notificationSettings/notificationConfig';
import {
	NOTIFICATION_TONE_IDS,
	type SoundId
} from '../../utils/notificationSettings/model';

/** Shared account/device setup, used by first enquiry and optional chat shortcuts.
 * Choice is derived from live account settings; a click is never completion.
 */
export const NotificationSetup = ({
	isEmailEnabled = true,
	isBrowserEnabled = true,
	onStart
}: {
	isEmailEnabled?: boolean;
	isBrowserEnabled?: boolean;
	onStart?: () => void;
}) => {
	const { t } = useTranslation();
	const { userData, reloadUserData } = useContext(UserDataContext);
	const tenant = useTenant();
	const continuation = useRef(0);
	const {
		emailActive,
		consentEmailActive,
		browserActive,
		browserSupported,
		browserSilenced
	} = useNotificationChannels(isEmailEnabled, isBrowserEnabled);
	const [pending, setPending] = useState<NotificationChoice | null>(null);
	const [emailOpen, setEmailOpen] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);
	const [awaitingBrowser, setAwaitingBrowser] = useState(false);
	const [browserDialogOpen, setBrowserDialogOpen] = useState(false);
	// Only used to re-render: the permission itself is read live below.
	const [, setPermissionCheck] = useState(0);
	const browserBlocked =
		browserSupported && Notification.permission === 'denied';
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
		setBrowserDialogOpen(false);
		setError(null);
		return () => {
			continuation.current += 1;
		};
	}, [isEmailEnabled, isBrowserEnabled, tenant?.id, userData?.userId]);

	// The person may lift a browser block in the browser settings and come
	// back to this page: read the permission again on return.
	useEffect(() => {
		if (!browserSupported) return;
		const recheck = () => setPermissionCheck((count) => count + 1);
		const onVisibility = () => {
			if (document.visibilityState !== 'hidden') recheck();
		};
		window.addEventListener('focus', recheck);
		document.addEventListener('visibilitychange', onVisibility);
		return () => {
			window.removeEventListener('focus', recheck);
			document.removeEventListener('visibilitychange', onVisibility);
		};
	}, [browserSupported]);

	/** Resolves true only when the browser opt-in really completed. */
	const finish = async (choice: NotificationChoice): Promise<boolean> => {
		if (
			(choice !== 'BROWSER' && !isEmailEnabled) ||
			(choice !== 'EMAIL' && !browserSupported)
		)
			return false;
		const operation = continuation.current;
		const current = () => continuation.current === operation;
		setBusy(true);
		setError(null);
		let completed = false;
		try {
			if (choice !== 'BROWSER' && (!emailActive || !consentEmailActive)) {
				await apiPatchUserData({
					emailNotifications: {
						...userData?.emailNotifications,
						emailNotificationsEnabled: true,
						settings: {
							...userData?.emailNotifications?.settings,
							newChatMessageNotificationEnabled: true,
							reassignmentNotificationEnabled: true
						}
					}
				});
				if (!current()) return false;
				const saved = await reloadUserData();
				if (!current()) return false;
				if (
					!saved?.email ||
					!saved?.emailNotifications?.emailNotificationsEnabled ||
					!saved?.emailNotifications?.settings
						?.newChatMessageNotificationEnabled ||
					!saved?.emailNotifications?.settings
						?.reassignmentNotificationEnabled
				)
					throw new Error('Not confirmed');
			}
			if (
				choice === 'BOTH' &&
				(!emailActive || !consentEmailActive) &&
				!browserActive
			) {
				// OS prompts need a fresh user gesture after the async email save.
				setAwaitingBrowser(true);
				setBrowserDialogOpen(true);
				return false;
			}
			if (choice !== 'EMAIL' && !browserActive) {
				await optInToBrowserNotifications();
				if (!current()) return false;
				setAwaitingBrowser(false);
				completed = Notification.permission === 'granted';
				if (Notification.permission !== 'granted') {
					// A blocked site never shows the permission prompt again;
					// the person has to lift the block in the address bar.
					setError(
						t(
							Notification.permission === 'denied'
								? 'erstantwort.notificationChoice.browserBlockedHelp'
								: 'erstantwort.notificationChoice.browserDenied'
						)
					);
				}
			}
		} catch {
			if (!current()) return false;
			setError(t('erstantwort.notificationChoice.saveFailed'));
		} finally {
			if (current()) {
				setPending(null);
				setBusy(false);
			}
		}
		return completed;
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
		} else if (choice === 'BROWSER' && !browserActive) {
			// The tone and the one permission click live in a dialog.
			setBrowserDialogOpen(true);
		} else void finish(choice);
	};

	/** The tone the account already uses for new conversation messages. */
	const storedTone = (): SoundId | undefined => {
		const sound =
			notificationSettingsStore.getState().settings.notificationConfig
				.conversations?.standard?.sound;
		return sound && [...NOTIFICATION_TONE_IDS, 'none'].includes(sound)
			? sound
			: undefined;
	};

	/** Keep the chosen tone for the conversation and request areas. */
	const rememberTone = (tone: SoundId) => {
		const { notificationConfig } =
			notificationSettingsStore.getState().settings;
		const next = { ...notificationConfig };
		(['requests', 'conversations'] as const).forEach((area) => {
			next[area] = { ...next[area] };
			AREA_KINDS[area].forEach((kind) => {
				next[area][kind] = { ...next[area][kind], sound: tone };
			});
		});
		notificationSettingsStore.updateSettings({
			notificationConfig: next
		});
	};

	const confirmBrowser = (tone: SoundId, changed: boolean) => {
		// No await before the permission request: it needs this click.
		const operation = continuation.current;
		void finish('BROWSER')
			.then((completed) => {
				// Another account or tenant may be active by now.
				if (!completed || continuation.current !== operation) return;
				// A tone is kept only when the browser said yes, and only a
				// tone the person actually changed replaces their settings.
				if (
					Notification.permission === 'granted' &&
					changed &&
					tone !== storedTone()
				)
					rememberTone(tone);
			})
			.finally(() => setBrowserDialogOpen(false));
	};

	if (!isEmailEnabled && !isBrowserEnabled) return null;
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
			{awaitingBrowser && !browserDialogOpen && (
				<>
					<p role="status">
						{t('erstantwort.notificationChoice.emailSavedNext')}
					</p>
					<button
						type="button"
						className="erstantwort__action"
						disabled={busy}
						onClick={() => setBrowserDialogOpen(true)}
					>
						{t('erstantwort.notificationChoice.enableBrowser')}
					</button>
				</>
			)}
			{browserBlocked && !error && (
				<p>{t('erstantwort.notificationChoice.browserBlockedHelp')}</p>
			)}
			{isBrowserEnabled && !browserSupported && (
				<p>{t('erstantwort.notificationChoice.browserUnsupported')}</p>
			)}
			{browserActive && browserSilenced && (
				<p role="status">
					{t('erstantwort.notificationChoice.browserSilenced')}
				</p>
			)}
			{error && <p role="alert">{error}</p>}
			{chosen && (
				<p role="status">
					{t('erstantwort.notificationChoice.active', {
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
					})}
				</p>
			)}
			{browserDialogOpen && (
				<NotificationBrowserDialog
					emailJustSaved={awaitingBrowser}
					blocked={browserBlocked}
					busy={busy}
					initialTone={storedTone() ?? DEFAULT_FIRST_TONE}
					onClose={() => setBrowserDialogOpen(false)}
					onConfirm={confirmBrowser}
				/>
			)}
			{emailOpen && (
				<ErstantwortEmailOverlay
					userName={userData?.userName}
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
