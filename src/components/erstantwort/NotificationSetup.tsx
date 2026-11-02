import { useAccountEmailCollectionAllowed } from '../../hooks/useAccountEmailCollectionAllowed';
import * as React from 'react';
import { useCallback, useContext, useEffect, useRef, useState } from 'react';
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
	getAuthenticatedAccountIdentity,
	subscribeToAuthenticatedTenant
} from '../../utils/authenticatedTenant';

/** Shared account/device setup, used by first enquiry and optional chat shortcuts.
 * Choice is derived from live account settings; a click is never completion.
 */
export const NotificationSetup = ({
	isEmailEnabled: configuredEmailEnabled = true,
	isBrowserEnabled = true,
	onStart,
	onEmailAccepted,
	onDone
}: {
	isEmailEnabled?: boolean;
	isBrowserEnabled?: boolean;
	onStart?: () => void;
	/** Server accepted the subscription; presentation retention is not permission. */
	onEmailAccepted?: () => void;
	/** A choice went through without an error: also when it changed nothing. */
	onDone?: () => void;
}) => {
	const { t } = useTranslation();
	const { userData, reloadUserData } = useContext(UserDataContext);
	const tenant = useTenant();
	const accountEmailAllowed = useAccountEmailCollectionAllowed();
	const isEmailEnabled = configuredEmailEnabled && accountEmailAllowed;
	const continuation = useRef(0);
	const acceptedEmailOperation = useRef<number | null>(null);
	const latestEmailEnabled = useRef(isEmailEnabled);
	latestEmailEnabled.current = isEmailEnabled;
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
	const [failedEmailReadback, setFailedEmailReadback] = useState<{
		choice: NotificationChoice;
		operation: number;
	} | null>(null);
	const chosen: NotificationChoice | null =
		emailActive && browserActive
			? 'BOTH'
			: emailActive
				? 'EMAIL'
				: browserActive
					? 'BROWSER'
					: null;

	const reset = useCallback(() => {
		continuation.current += 1;
		acceptedEmailOperation.current = null;
		setEmailOpen(false);
		setPending(null);
		setBusy(false);
		setAwaitingBrowser(false);
		setError(null);
		setFailedEmailReadback(null);
	}, []);
	useEffect(() => {
		reset();
		return () => {
			continuation.current += 1;
			acceptedEmailOperation.current = null;
		};
	}, [isBrowserEnabled, tenant?.id, userData?.userId, reset]);
	useEffect(() => {
		// A successful subscription's own reload temporarily withdraws capability.
		// It must not erase the requested, independently permitted browser step.
		if (acceptedEmailOperation.current !== continuation.current) reset();
	}, [isEmailEnabled, reset]);
	useEffect(() => {
		let identity = getAuthenticatedAccountIdentity();
		return subscribeToAuthenticatedTenant(() => {
			const next = getAuthenticatedAccountIdentity();
			if (next !== identity) reset();
			identity = next;
		});
	}, [reset]);

	const finish = async (
		choice: NotificationChoice,
		acceptedOperation?: number
	) => {
		const resuming =
			acceptedOperation !== undefined &&
			acceptedEmailOperation.current === acceptedOperation &&
			continuation.current === acceptedOperation;
		if (acceptedOperation !== undefined && !resuming) return;
		if (
			(!resuming && choice !== 'BROWSER' && !isEmailEnabled) ||
			(choice !== 'EMAIL' && !browserSupported)
		)
			return;
		const operation = acceptedOperation ?? ++continuation.current;
		if (!resuming) acceptedEmailOperation.current = null;
		const current = () => continuation.current === operation;
		setBusy(true);
		setError(null);
		setFailedEmailReadback(null);
		try {
			if (
				resuming ||
				(choice !== 'BROWSER' && (!emailActive || !consentEmailActive))
			) {
				if (!resuming) {
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
					if (!current() || !latestEmailEnabled.current) return;
					acceptedEmailOperation.current = operation;
					onEmailAccepted?.();
					if (!current()) return;
				}
				try {
					const saved = await reloadUserData();
					if (!current()) return;
					if (
						!saved?.email ||
						!saved?.emailNotifications?.emailNotificationsEnabled ||
						!saved?.emailNotifications?.settings
							?.newChatMessageNotificationEnabled ||
						!saved?.emailNotifications?.settings
							?.reassignmentNotificationEnabled
					)
						throw new Error('Not confirmed');
				} catch {
					if (current()) {
						setFailedEmailReadback({ choice, operation });
						setError(
							t('erstantwort.notificationChoice.refreshFailed')
						);
					}
					return;
				}
			}
			if (
				choice === 'BOTH' &&
				(!emailActive || !consentEmailActive) &&
				!browserActive
			) {
				// OS prompts need a fresh user gesture after the async email save.
				setAwaitingBrowser(true);
				return;
			}
			if (choice !== 'EMAIL' && !browserActive) {
				await optInToBrowserNotifications();
				if (!current()) return;
				setAwaitingBrowser(false);
				if (Notification.permission !== 'granted') {
					setError(t('erstantwort.notificationChoice.browserDenied'));
					return;
				}
			}
			if (current()) onDone?.();
		} catch {
			if (!current()) return;
			setError(t('erstantwort.notificationChoice.saveFailed'));
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

	const acceptedEmailActive =
		acceptedEmailOperation.current === continuation.current;
	if (!isEmailEnabled && !isBrowserEnabled && !acceptedEmailActive)
		return null;
	return (
		<>
			{acceptedEmailActive && (
				<p role="status">
					{t('erstantwort.notificationChoice.emailAccepted')}
				</p>
			)}
			{(isEmailEnabled || isBrowserEnabled) && (
				<NotificationChoiceCard
					onChoose={choose}
					chosen={chosen}
					controlled
					isEmailEnabled={isEmailEnabled}
					isBrowserNotificationSupported={browserSupported}
					busy={busy || emailOpen}
				/>
			)}
			{awaitingBrowser && (
				<button
					type="button"
					className="erstantwort__action"
					disabled={busy}
					onClick={() => void finish('BROWSER')}
				>
					{t('erstantwort.notificationChoice.enableBrowser')}
				</button>
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
			{failedEmailReadback && acceptedEmailActive && (
				<button
					type="button"
					className="erstantwort__action"
					disabled={busy}
					onClick={() =>
						void finish(
							failedEmailReadback.choice,
							failedEmailReadback.operation
						)
					}
				>
					{t('erstantwort.emailNotification.retryRefresh')}
				</button>
			)}
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
			{emailOpen && isEmailEnabled && (
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
