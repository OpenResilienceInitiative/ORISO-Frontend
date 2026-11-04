import { useAccountEmailCollectionAllowed } from '../../hooks/useAccountEmailCollectionAllowed';
import * as React from 'react';
import {
	useCallback,
	useContext,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState
} from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
	AUTHORITIES,
	hasUserAuthority,
	UserDataContext
} from '../../globalState';
import {
	TWO_FACTOR_SETTINGS_PATH,
	useOpenTwoFactorSettings
} from '../../hooks/useOpenTwoFactorSettings';
import { ErstantwortSequence } from './ErstantwortSequence';
import {
	ErstantwortEmailOverlay,
	type EmailRefreshStatus
} from './ErstantwortEmailOverlay';
import { ErstantwortDisplayNameOverlay } from './ErstantwortDisplayNameOverlay';
import { SaveCredentialsCard } from './SaveCredentialsCard';
import { NotificationSetupCollapse } from './NotificationSetupMessage';
import { useTenant } from '../../globalState/provider/TenantProvider';
import { emailCollectionSetupPolicy } from './notificationChannelPolicy';
import { useNotificationChannels } from './useNotificationChannels';
import { EnquiryReceivedIllustration } from './EnquiryReceivedIllustration';
import {
	ErstantwortActionKind,
	parseErstantwortPayload
} from './erstantwortPayload';
import {
	ErstantwortLiveState,
	type ResolvedBaustein,
	resolveErstantwortBausteine
} from './erstantwortResolve';
import { ErstantwortTrigger } from './erstantwortCatalogue';
import { isAskerDisplayNameTypingAllowed } from '../../utils/askerAccountPolicy';
import {
	getAuthenticatedAccountIdentity,
	subscribeToAuthenticatedTenant
} from '../../utils/authenticatedTenant';

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
	/** Chat message id; lets an X on the notification setup survive a reload. */
	messageId?: string;
	/** Used only when no event exists — the client-side triggers of #825. */
	trigger?: ErstantwortTrigger;
	conversationType?: string | null;
	/** Alias changes belong to this conversation, never the login account. */
	sessionId?: number;
	displayName?: string;
	onDisplayNameSaved?: () => void;
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
	/**
	 * #420 preview: the text renders as in the chat, but nothing writes —
	 * no action buttons, no notification setup, no password shortcut.
	 */
	readOnly?: boolean;
}

export const ErstantwortMessage: React.FC<ErstantwortMessageProps> = ({
	rawMessage,
	messageId,
	trigger,
	conversationType,
	sessionId,
	displayName,
	onDisplayNameSaved,
	deadlineDays,
	isAskerEmailEnabled,
	skipAnimation,
	onFirstReveal,
	readOnly = false
}) => {
	const { t, i18n } = useTranslation();
	const { userData, reloadUserData } = useContext(UserDataContext);
	const openTwoFactorSettings = useOpenTwoFactorSettings();
	const navigate = useNavigate();
	const tenant = useTenant();
	const emailScope = useMemo(
		() => ({
			actorId: userData?.userId,
			tenantId: tenant?.id,
			sessionId,
			messageId,
			conversationType
		}),
		[userData?.userId, tenant?.id, sessionId, messageId, conversationType]
	);
	const [acceptedNotification, setAcceptedNotification] = useState<{
		scope: typeof emailScope;
		baustein: ResolvedBaustein;
		index: number;
	} | null>(null);
	const acceptedNotificationCurrent =
		acceptedNotification?.scope === emailScope;
	const channels = emailCollectionSetupPolicy(
		tenant?.settings,
		conversationType
	);
	const accountEmailAllowed = useAccountEmailCollectionAllowed();
	const emailAllowed =
		accountEmailAllowed &&
		isAskerEmailEnabled !== false &&
		channels.emailAllowed;
	const { hasReachableChannel } = useNotificationChannels(
		emailAllowed,
		channels.browserAllowed
	);
	const [notificationSetupStarted, setNotificationSetupStarted] =
		useState(false);
	// Keep an in-progress setup visible through its saved confirmation. On reload,
	// existing reachability suppresses automatic invitations again.
	const offerNotificationSetup =
		acceptedNotificationCurrent ||
		((emailAllowed || channels.browserAllowed) &&
			(notificationSetupStarted || !hasReachableChannel));
	// A persisted message keeps its place in the history after a channel is
	// reachable: the slot then starts as the one-line summary with "ändern"
	// instead of vanishing. No invitation is offered again (offerNotificationSetup
	// still decides that); a tenant without any channel has nothing to show.
	const showSetupSlot =
		acceptedNotificationCurrent || emailAllowed || channels.browserAllowed;

	const [emailOverlay, setEmailOverlay] = useState<{
		scope: typeof emailScope;
		id: number;
	} | null>(null);
	const [emailRefreshStatus, setEmailRefreshStatus] = useState<
		'editing' | EmailRefreshStatus
	>('editing');
	const latestEmailRefreshStatus = useRef(emailRefreshStatus);
	const updateEmailRefreshStatus = useCallback(
		(status: 'editing' | EmailRefreshStatus) => {
			latestEmailRefreshStatus.current = status;
			setEmailRefreshStatus(status);
		},
		[]
	);
	const latestEmailOverlay = useRef(emailOverlay);
	latestEmailOverlay.current = emailOverlay;
	const latestEmailScope = useRef(emailScope);
	latestEmailScope.current = emailScope;
	const latestEmailAllowed = useRef(emailAllowed);
	latestEmailAllowed.current = emailAllowed;
	const emailOpening = useRef(0);
	const closeEmailOverlay = useCallback(() => {
		latestEmailOverlay.current = null;
		setEmailOverlay(null);
		updateEmailRefreshStatus('editing');
	}, [updateEmailRefreshStatus]);
	const openEmailOverlay = useCallback(() => {
		if (
			!latestEmailAllowed.current ||
			latestEmailScope.current !== emailScope
		)
			return;
		const opening = { scope: emailScope, id: ++emailOpening.current };
		latestEmailOverlay.current = opening;
		updateEmailRefreshStatus('editing');
		setEmailOverlay(opening);
	}, [emailScope, updateEmailRefreshStatus]);
	// Layout effects: the overlay of an older scope closes in the same commit that
	// shows the new scope's action. A passive effect runs later and would also
	// close an overlay opened from that action in between.
	useLayoutEffect(() => {
		closeEmailOverlay();
		setAcceptedNotification(null);
	}, [emailScope, closeEmailOverlay]);
	useLayoutEffect(() => {
		if (!emailAllowed && latestEmailRefreshStatus.current === 'editing')
			closeEmailOverlay();
	}, [emailAllowed, closeEmailOverlay]);
	useEffect(() => {
		let identity = getAuthenticatedAccountIdentity();
		return subscribeToAuthenticatedTenant(() => {
			const next = getAuthenticatedAccountIdentity();
			if (next !== identity) {
				closeEmailOverlay();
				setAcceptedNotification(null);
			}
			identity = next;
		});
	}, [closeEmailOverlay]);
	useEffect(
		() => () => {
			latestEmailOverlay.current = null;
		},
		[]
	);
	const refreshAcceptedEmail = useCallback(
		(opening: NonNullable<typeof emailOverlay>) => {
			const current = () =>
				latestEmailOverlay.current === opening &&
				latestEmailScope.current === opening.scope;
			if (!current() || latestEmailRefreshStatus.current === 'pending')
				return;
			updateEmailRefreshStatus('pending');
			void reloadUserData()
				.then(() => {
					if (current()) updateEmailRefreshStatus('confirmed');
				})
				.catch(() => {
					if (current()) updateEmailRefreshStatus('failed');
				});
		},
		[reloadUserData, updateEmailRefreshStatus]
	);
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
		acceptedNotificationCurrent &&
		acceptedNotification &&
		!bausteine.some((item) => item.id === acceptedNotification.baustein.id)
	) {
		bausteine.splice(
			Math.min(acceptedNotification.index, bausteine.length),
			0,
			{ ...acceptedNotification.baustein, action: undefined }
		);
	}
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
					openEmailOverlay();
					break;
				case 'ENABLE_2FA':
					openTwoFactorSettings({ showBackupKey: true });
					break;
				case 'SET_DISPLAY_NAME':
					if (sessionId !== undefined)
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
		[navigate, openTwoFactorSettings, sessionId, openEmailOverlay]
	);

	/* The calls to action address the advice seeker. A counsellor reads the
	   same record but must not get its buttons: "Protect my access" would run
	   the advice seeker's 2FA flow on the counsellor's own account (#1844). */
	const offersActions =
		!readOnly &&
		!hasUserAuthority(AUTHORITIES.CONSULTANT_DEFAULT, userData);

	if (!bausteine.length && !emailOverlay) return null;

	const setupKey = JSON.stringify([
		emailScope.actorId,
		emailScope.tenantId,
		emailScope.sessionId,
		emailScope.messageId,
		emailScope.conversationType
	]);
	const recordAcceptedNotification = (
		id: 'emailNotification' | 'notificationChoice'
	) => {
		if (latestEmailScope.current !== emailScope) return;
		const index = bausteine.findIndex((item) => item.id === id);
		if (index >= 0) {
			setAcceptedNotification({
				scope: emailScope,
				baustein: bausteine[index],
				index
			});
		}
	};

	return (
		<>
			<ErstantwortSequence
				bausteine={bausteine.map((item) =>
					item.action?.kind === 'SET_DISPLAY_NAME' &&
					sessionId === undefined
						? { ...item, action: undefined }
						: item
				)}
				compactFaq={conversationType !== 'LIVE_CHAT'}
				skipAnimation={skipAnimation}
				onAction={offersActions ? handleAction : undefined}
				onFirstReveal={onFirstReveal}
				slots={{
					enquiryReceived: <EnquiryReceivedIllustration />,
					emailNotification:
						!readOnly &&
						persistedInvitation &&
						!hasChoice &&
						showSetupSlot ? (
							<NotificationSetupCollapse
								messageId={messageId}
								key={setupKey}
								onEmailAccepted={() =>
									recordAcceptedNotification(
										'emailNotification'
									)
								}
								isEmailEnabled={emailAllowed}
								isBrowserEnabled={channels.browserAllowed}
								onStart={() =>
									setNotificationSetupStarted(true)
								}
							/>
						) : undefined,
					notificationChoice:
						!readOnly && showSetupSlot ? (
							<NotificationSetupCollapse
								messageId={messageId}
								key={setupKey}
								onEmailAccepted={() =>
									recordAcceptedNotification(
										'notificationChoice'
									)
								}
								isEmailEnabled={emailAllowed}
								isBrowserEnabled={channels.browserAllowed}
								onStart={() =>
									setNotificationSetupStarted(true)
								}
							/>
						) : undefined,
					saveCredentials: (
						<SaveCredentialsCard
							userName={userData?.userName ?? ''}
							readOnly={readOnly}
						/>
					)
				}}
			/>
			{emailOverlay &&
				(emailAllowed || emailRefreshStatus !== 'editing') && (
					<ErstantwortEmailOverlay
						key={emailOverlay.id}
						refreshStatus={
							emailRefreshStatus === 'editing'
								? undefined
								: emailRefreshStatus
						}
						onRetryRefresh={() =>
							refreshAcceptedEmail(emailOverlay)
						}
						onClose={() => {
							if (latestEmailOverlay.current === emailOverlay)
								closeEmailOverlay();
						}}
						onSaved={() => {
							if (
								latestEmailOverlay.current !== emailOverlay ||
								latestEmailScope.current !==
									emailOverlay.scope ||
								!latestEmailAllowed.current
							)
								return;
							// The write is accepted; only read-only success survives the fail-closed reload.
							refreshAcceptedEmail(emailOverlay);
						}}
					/>
				)}
			{isDisplayNameOverlayOpen && sessionId !== undefined && (
				<ErstantwortDisplayNameOverlay
					key={sessionId}
					sessionId={sessionId}
					editable={isAskerDisplayNameTypingAllowed(
						tenant?.settings,
						conversationType ?? 'AGENCY_COUNSELLING'
					)}
					currentName={displayName || userData?.userName || ''}
					locale={i18n.language || 'de'}
					onClose={() => setIsDisplayNameOverlayOpen(false)}
					onSaved={() => onDisplayNameSaved?.()}
				/>
			)}
		</>
	);
};
