import * as React from 'react';
import { useCallback, useContext, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { UserDataContext } from '../../globalState';
import {
	TWO_FACTOR_SETTINGS_PATH,
	useOpenTwoFactorSettings
} from '../../hooks/useOpenTwoFactorSettings';
import { ErstantwortSequence } from './ErstantwortSequence';
import { ErstantwortEmailOverlay } from './ErstantwortEmailOverlay';
import { ErstantwortDisplayNameOverlay } from './ErstantwortDisplayNameOverlay';
import { SaveCredentialsCard } from './SaveCredentialsCard';
import { NotificationSetup } from './NotificationSetup';
import { useTenant } from '../../globalState/provider/TenantProvider';
import { notificationChannelPolicy } from './notificationChannelPolicy';
import { useNotificationChannels } from './useNotificationChannels';
import { EnquiryReceivedIllustration } from './EnquiryReceivedIllustration';
import {
	ErstantwortActionKind,
	parseErstantwortPayload
} from './erstantwortPayload';
import {
	ErstantwortLiveState,
	resolveErstantwortBausteine
} from './erstantwortResolve';
import { ErstantwortTrigger } from './erstantwortCatalogue';

/**
 * The chat-side container for the Erstantwort (ADR-018, ORISO-Frontend#772).
 *
 * It does exactly two things the pure renderer must not do: it reads the **live
 * completion state** (e-mail present, 2FA active) so an already-satisfied
 * action loses its button, and it wires the buttons to the routed endpoints
 * that already work. No new state, no new table, no new endpoint — ADR-018 §4.
 */

export interface ErstantwortMessageProps {
	/** The raw, already decrypted message body of the FIRST_RESPONSE event. */
	rawMessage?: string | null;
	/** Used only when no event exists — the client-side triggers of #825. */
	trigger?: ErstantwortTrigger;
	conversationType?: string | null;
	deadlineDays?: number;
	/**
	 * ORISO-Admin#602 switch 2. Left `undefined` until that card ships, which
	 * reads as "enabled" — the setting is opt-out and an unconfigured tenant
	 * must keep today's behaviour.
	 */
	isAskerEmailEnabled?: boolean;
	/** Re-renders of history skip the stagger; a fresh event plays it. */
	skipAnimation?: boolean;
	onFirstReveal?: () => void;
}

export const ErstantwortMessage: React.FC<ErstantwortMessageProps> = ({
	rawMessage,
	trigger,
	conversationType,
	deadlineDays,
	isAskerEmailEnabled,
	skipAnimation,
	onFirstReveal
}) => {
	const { t, i18n } = useTranslation();
	const { userData, reloadUserData } = useContext(UserDataContext);
	const openTwoFactorSettings = useOpenTwoFactorSettings();
	const navigate = useNavigate();
	const tenant = useTenant();
	const channels = notificationChannelPolicy(
		tenant?.settings,
		conversationType
	);
	const emailAllowed = isAskerEmailEnabled !== false && channels.emailAllowed;
	const { hasReachableChannel } = useNotificationChannels(
		emailAllowed,
		channels.browserAllowed
	);
	const [notificationSetupStarted, setNotificationSetupStarted] =
		useState(false);
	// Keep an in-progress setup visible through its saved confirmation. On reload,
	// existing reachability suppresses automatic invitations again.
	const offerNotificationSetup =
		(emailAllowed || channels.browserAllowed) &&
		(notificationSetupStarted || !hasReachableChannel);
	const [isEmailOverlayOpen, setIsEmailOverlayOpen] = useState(false);
	const [isDisplayNameOverlayOpen, setIsDisplayNameOverlayOpen] =
		useState(false);

	const state: ErstantwortLiveState = useMemo(
		() => ({
			hasEmail: Boolean(userData?.email),
			isTwoFactorEnabled: Boolean(userData?.twoFactorAuth?.isEnabled),
			isTwoFactorActive: Boolean(userData?.twoFactorAuth?.isActive),
			isAskerEmailEnabled: emailAllowed
		}),
		[
			userData?.email,
			userData?.twoFactorAuth?.isEnabled,
			userData?.twoFactorAuth?.isActive,
			emailAllowed
		]
	);

	const { bausteine: resolvedBausteine } = useMemo(
		() =>
			resolveErstantwortBausteine({
				rawMessage,
				trigger,
				context: { conversationType, deadlineDays },
				translate: (key, defaultValue) => t(key, defaultValue),
				state
			}),
		[rawMessage, trigger, conversationType, deadlineDays, t, state]
	);

	// A supported, frozen first-response invitation owns this live continuation.
	// Keep its words and links, but use the same channel chooser as post-dispatch.
	// Do not invent invitations for payloads that omitted them or for live chat.
	const parsed = parseErstantwortPayload(rawMessage);
	const persistedInvitation =
		conversationType !== 'LIVE_CHAT' &&
		parsed.status === 'ok' &&
		parsed.bausteine.some((item) => item.id === 'emailNotification');
	const hasChoice = resolvedBausteine.some(
		(item) => item.id === 'notificationChoice'
	);
	const offeredBausteine =
		offerNotificationSetup || parsed.status === 'ok'
			? resolvedBausteine
			: resolvedBausteine.filter(
					(item) => item.id !== 'notificationChoice'
				);
	const bausteine =
		persistedInvitation && !hasChoice
			? offeredBausteine.map((item) =>
					item.id === 'emailNotification'
						? { ...item, action: undefined }
						: item
				)
			: [...offeredBausteine];
	if (
		persistedInvitation &&
		offerNotificationSetup &&
		!hasChoice &&
		!bausteine.some((item) => item.id === 'emailNotification')
	) {
		// Tenant email-off silences the frozen email invitation; browser remains
		// an independent option through a distinct, current setup message.
		const choice = resolveErstantwortBausteine({
			trigger: 'AFTER_ENQUIRY_DISPATCHED',
			context: { conversationType },
			translate: (key, defaultValue) => t(key, defaultValue),
			state
		}).bausteine.find((item) => item.id === 'notificationChoice');
		if (choice) bausteine.push(choice);
	}

	const handleAction = useCallback(
		(kind: ErstantwortActionKind) => {
			switch (kind) {
				case 'ADD_EMAIL':
					setIsEmailOverlayOpen(true);
					break;
				case 'ENABLE_2FA':
					openTwoFactorSettings({ showBackupKey: true });
					break;
				case 'SET_DISPLAY_NAME':
					setIsDisplayNameOverlayOpen(true);
					break;
				case 'SAVE_CREDENTIALS':
					/* Handled inline by SaveCredentialsCard — there is no dialog
					   to open. The button exists only for keyboard users who
					   reach it before the card. */
					break;
				case 'SHOW_RECOVERY_KEY':
					/* The Ersatzschlüssel is generated silently at login and
					   parked for the Sicherheit panel (ADR-019), so this button
					   only has to take the person to where it already waits. */
					navigate(TWO_FACTOR_SETTINGS_PATH);
					break;
				default:
					break;
			}
		},
		[navigate, openTwoFactorSettings]
	);

	if (!bausteine.length) return null;

	return (
		<>
			<ErstantwortSequence
				bausteine={bausteine}
				compactFaq={conversationType !== 'LIVE_CHAT'}
				skipAnimation={skipAnimation}
				onAction={handleAction}
				onFirstReveal={onFirstReveal}
				slots={{
					enquiryReceived: <EnquiryReceivedIllustration />,
					emailNotification:
						persistedInvitation &&
						!hasChoice &&
						offerNotificationSetup ? (
							<NotificationSetup
								isEmailEnabled={emailAllowed}
								isBrowserEnabled={channels.browserAllowed}
								onStart={() =>
									setNotificationSetupStarted(true)
								}
							/>
						) : undefined,
					notificationChoice: offerNotificationSetup ? (
						<NotificationSetup
							isEmailEnabled={emailAllowed}
							isBrowserEnabled={channels.browserAllowed}
							onStart={() => setNotificationSetupStarted(true)}
						/>
					) : undefined,
					saveCredentials: (
						<SaveCredentialsCard
							userName={userData?.userName ?? ''}
						/>
					)
				}}
			/>
			{isEmailOverlayOpen && (
				<ErstantwortEmailOverlay
					onClose={() => setIsEmailOverlayOpen(false)}
					onSaved={reloadUserData}
				/>
			)}
			{isDisplayNameOverlayOpen && (
				<ErstantwortDisplayNameOverlay
					currentName={
						userData?.displayName || userData?.userName || ''
					}
					locale={i18n.language || 'de'}
					onClose={() => setIsDisplayNameOverlayOpen(false)}
					onSaved={reloadUserData}
				/>
			)}
		</>
	);
};
