import { getCounsellingDpaFailure } from '../../api/counsellingDpaFailure';
import React, {
	useCallback,
	useContext,
	useEffect,
	useRef,
	useState
} from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
	Box,
	Button,
	IconButton,
	InputAdornment,
	Typography
} from '@mui/material';
import {
	isRedeemInviteLinkSessionResponse,
	isPausedInvite,
	redeemInviteLink,
	RedeemInviteLinkLegacyResponse
} from '../../api/apiRedeemInviteLink';
import { apiGetInviteLinkContext } from '../../api/apiGetInviteLinkContext';
import { apiFinishAnonymousConversation } from '../../api/apiFinishAnonymousConversation';
import { isConsultantAccessToken } from '../auth/consultantLoginBlock';
import { hasActiveAuthSession } from '../auth/auth';
import { getValueFromCookie } from '../sessionCookie/accessSessionCookie';
import { LocaleContext, TenantContext } from '../../globalState';
import { GlobalComponentContext } from '../../globalState/provider/GlobalComponentContext';
import { redirectToApp } from '../registration/autoLogin';
import { useRegisterThenLogin } from '../registration/useRegisterThenLogin';
import {
	applyRedeemSessionCredentials,
	assignInviteSessionDisplayName
} from './inviteLinkHelpers';
import { LiveChatEntryRoom } from '../anonymousChat/entryRoom/LiveChatEntryRoom';
import {
	mintInviteGuestCredentials,
	rerollInviteGuestUsername
} from './inviteLinkIdentity';
import {
	InviteSessionResumeError,
	rememberInviteSession,
	resolveReusableInviteSession
} from './inviteSessionReuse';
import { StageLayout } from '../stageLayout/StageLayout';
import { Loading } from '../app/Loading';
import { AnimalAvatar } from '../pseudonym/AnimalAvatar';
import { OrisoTextField } from '../form/OrisoTextField';
import genDiceIcon from '../../resources/img/registration-md3/icons/gen-dice.svg';
import {
	registrationMd3,
	registrationScreenIntroSx,
	registrationScreenTitleSx
} from '../registration/registrationDesign/registrationDesign';
import type { Pseudonym } from '../../utils/anonName/engine';
import {
	apiRequestDirectInvitationRenewal,
	directInvitationAccessError,
	isRoomNotEncryptedError,
	isExpiredDirectLinkError,
	isInactiveDirectLinkError
} from '../../api/apiDirectLinks';
import {
	downloadInvitationIcs,
	InvitationBeforeStart,
	InvitationExpired,
	type NewLinkRequestState
} from '../directInvitation/InvitationEntryStates';
import {
	invitationEntryPhase,
	timerDelay
} from '../directInvitation/invitationModel';
import { invitationErrorEntry } from '../directInvitation/invitationErrorSnackbar';
import { appSnackbarStack } from '../m3Snackbar/snackbarStack';
import { M3SnackbarHost } from '../m3Snackbar/M3SnackbarHost';
import type { InviteLinkContext } from '../../api/apiGetInviteLinkContext';
import type { DirectLinkMedium } from '../conversationCreate/directLink/directLink';
import {
	directLinkCallsAllowed,
	directLinkMediumOf,
	loginPathForDirectLink,
	openDirectLinkConversation
} from '../directLinkEntry/directLinkEntryFlow';
import { DirectLinkCallEntry } from '../directLinkEntry/DirectLinkCallEntry';
import { directLinkRegistration } from '../directLinkEntry/directLinkRegistration';
import {
	asksDirectLinkPostcode,
	isDirectLinkPostcodeMissing
} from '../directLinkEntry/directLinkPostcode';
import { DirectLinkPostcodeField } from '../directLinkEntry/DirectLinkPostcodeField';

/**
 * Landing page for invite links.
 *
 * New topic-based links (External Inbounds): redeem creates an anonymous
 * session and returns tokens — user goes straight to the waiting room.
 *
 * Legacy agency links: redeem returns agency/consultingType; guest confirms a
 * rolled User-ID, then we register an asker and redirect into the app.
 */
/** A counsellor session this browser still holds — expired cookies do not count. */
const holdsCounsellorSession = (): boolean =>
	hasActiveAuthSession() &&
	isConsultantAccessToken(getValueFromCookie('keycloak'));

/**
 * A redeem whose response is discarded because a counsellor signed in while it
 * ran: the POST already created the guest and a queue entry. Finish that
 * session with the guest's own token — never the counsellor's, and without
 * storing the guest's anywhere — so no phantom waits in the queue.
 */
const withdrawDiscardedGuest = (data: {
	sessionId: number;
	accessToken: string;
}) => {
	void apiFinishAnonymousConversation(data.sessionId, data.accessToken).catch(
		() => undefined
	);
};

const inviteErrorText = (
	error: unknown,
	translate: (key: string) => string
) => {
	/* ORISO-UserService#1563: a link switched off while the page was open
	   answers 410 on the registration too, not only on the context lookup. */
	if (isInactiveDirectLinkError(error)) {
		return translate('directLink.entry.inactive');
	}
	const failure = getCounsellingDpaFailure(error);
	if (failure) {
		return translate(
			failure.retryable
				? 'counselling.dpa.unavailable.inviteText'
				: `${failure.key}.text`
		);
	}
	return error instanceof Error
		? error.message
		: translate('inviteLink.error.generic');
};
/**
 * #2252: who may enter decides the account the page creates. Guests only:
 * always a temporary one; accounts only: always a permanent one; both: the
 * link's default, with "Anmelden" as the other way.
 */
const withAccessMode = (context: InviteLinkContext): InviteLinkContext => {
	switch (context.accessMode) {
		case 'GUESTS_ONLY':
			return { ...context, temporaryAccount: true };
		case 'ACCOUNTS_ONLY':
			return {
				...context,
				temporaryAccount: false,
				hidePasswordField: false
			};
		default:
			return context;
	}
};

/** #2252: the waiting room is not open yet (the server's `callOpensAt`). */
const callOpensLater = (context: InviteLinkContext | null) =>
	Boolean(context?.appointmentStartTime && context?.appointmentEndTime) &&
	invitationEntryPhase(new Date(), {
		callOpensAt: context?.callOpensAt
	}) === 'beforeStart';

const statusOf = (error: unknown) =>
	error instanceof Response ? error.status : undefined;

/**
 * #2252: the text of a refusal the invitation itself gives: a 403 that names
 * the only way in, a 1:1 that is not encrypted (409), or a conversation
 * Matrix could not reach (502/503), which the person may simply try again.
 */
const accessErrorText = async (
	error: unknown,
	translate: (key: string) => string
) => {
	const only = await directInvitationAccessError(error);
	if (only === 'guests')
		return translate('directInvitation.entry.access.guestsOnly');
	if (only === 'accounts')
		return translate('directInvitation.entry.access.accountsOnly');
	if (await isRoomNotEncryptedError(error))
		return translate('directInvitation.entry.roomNotEncrypted');
	const status = statusOf(error);
	if (status === 502 || status === 503)
		return translate('directInvitation.entry.roomUnavailable');
	return null;
};

export const InviteLink = () => {
	const { t } = useTranslation();
	const navigate = useNavigate();
	const { token, topicSlug } = useParams<{
		token: string;
		topicSlug?: string;
	}>();
	const tenantContext = useContext(TenantContext);
	const localeContext = useContext(LocaleContext);
	const { Stage } = useContext(GlobalComponentContext);
	const tenant = tenantContext?.tenant;
	const locale = localeContext?.locale ?? 'de';
	const [status, setStatus] = useState<
		| 'loading'
		| 'identity'
		| 'registering'
		| 'error'
		| 'paused'
		| 'room'
		| 'invite'
		| 'staff'
		| 'directCall'
		| 'directOpening'
		| 'beforeStart'
		| 'expired'
	>('loading');
	/* #2252: "Neuen Link anfragen" on the expired page. */
	const [newLinkRequest, setNewLinkRequest] =
		useState<NewLinkRequestState>('idle');
	/* #2252: the person chose the chat before the call opens, or the time came. */
	const pastBeforeStartRef = useRef(false);
	/* #1795: a counsellor's direct link. Chat guests use the identity step
	   below; call guests the call entry; signed-in people go straight in. */
	const [directLink, setDirectLink] = useState<{
		context: InviteLinkContext;
		medium: DirectLinkMedium;
		signedIn?: boolean;
	} | null>(null);
	/* A live-chat link the room opens before it is redeemed. */
	const [liveTopic, setLiveTopic] = useState<{
		topicId: number;
		tenantId: number | null;
		consultingTypeId?: number;
	} | null>(null);
	const [roomSessionId, setRoomSessionId] = useState<number | null>(null);
	const [errorMessage, setErrorMessage] = useState('');
	const [dpaFailure, setDpaFailure] =
		useState<ReturnType<typeof getCounsellingDpaFailure>>(null);
	const [legacyRedeem, setLegacyRedeem] =
		useState<RedeemInviteLinkLegacyResponse | null>(null);
	const [identity, setIdentity] = useState<Pseudonym | null>(null);
	const [username, setUsername] = useState('');
	const [password, setPassword] = useState('');
	const [postcode, setPostcode] = useState('');
	const [postcodeTried, setPostcodeTried] = useState(false);
	const registerThenLogin = useRegisterThenLogin();
	/* The account exists and only the login after it failed (#1533). The
	   identity stays on screen as it was — it is now the account's — and
	   "continue" only tries the login again. */
	const [loginRetry, setLoginRetry] = useState(false);
	const hidePasswordField = Boolean(
		directLink?.context.temporaryAccount &&
			directLink.context.hidePasswordField
	);
	/* #1795: a registered direct-link account enters a postcode (statistics
	   only); a temporary one keeps the placeholder. After the account exists
	   the step only retries the login. */
	const askPostcode = Boolean(
		directLink && !loginRetry && asksDirectLinkPostcode(directLink.context)
	);
	const hasRunRef = useRef(false);
	/* Whether the page is still on screen. The lookups before a redeem can take
	   seconds; leaving meanwhile must not create a guest behind the person's
	   back. A ref (not the effect's own cleanup) so React's development
	   double-mount, which reruns nothing because of `hasRunRef`, keeps going. */
	const mountedRef = useRef(true);
	useEffect(() => {
		mountedRef.current = true;
		return () => {
			mountedRef.current = false;
		};
	}, []);
	const [resumeAttempt, setResumeAttempt] = useState(0);
	const [resumeFailed, setResumeFailed] = useState(false);

	useEffect(() => {
		if (!token) {
			setStatus('error');
			setErrorMessage(t('inviteLink.error.missingToken'));
			return;
		}
		if (hasRunRef.current) return;
		hasRunRef.current = true;

		(async () => {
			try {
				// The public context can report a paused link without creating an
				// account or showing an existing waiting room or staff notice.
				let expired = false;
				const read = await apiGetInviteLinkContext(token).catch(
					async (error) => {
						if (await isPausedInvite(error)) throw error;
						/* #2252: an expired or replaced invitation has its own page. */
						expired = await isExpiredDirectLinkError(error);
						return null;
					}
				);
				if (!mountedRef.current) return;
				if (expired) {
					setStatus('expired');
					return;
				}
				const context = read ? withAccessMode(read) : read;
				if (holdsCounsellorSession()) {
					setStatus('staff');
					return;
				}

				/* A reload must not cost a second place in the queue. Redeem
				   mints a fresh anonymous account and a fresh queue entry
				   every time it is called — right for a second guest, wrong
				   for the same guest coming back, who then waits behind
				   their own abandoned entry (#1404). If this browser already
				   holds a live session for this link, walk back into it. */
				const reusableSessionId =
					await resolveReusableInviteSession(token);
				if (reusableSessionId !== null) {
					if (!mountedRef.current) return;
					if (holdsCounsellorSession()) {
						setStatus('staff');
						return;
					}
					setRoomSessionId(reusableSessionId);
					setStatus('room');
					return;
				}

				if (context?.linkKind === 'CALL') {
					if (!mountedRef.current) return;
					if (holdsCounsellorSession()) {
						setStatus('staff');
						return;
					}
					if (
						context.chatType !== 'AUDIO' &&
						context.chatType !== 'VIDEO'
					) {
						setStatus('error');
						setErrorMessage(t('directLink.entry.inactive'));
						return;
					}
					setDirectLink({
						context,
						medium: context.chatType,
						signedIn: hasActiveAuthSession()
					});
					setStatus('directCall');
					return;
				}
				const directMedium = directLinkMediumOf(context);
				if (context && directMedium) {
					if (!mountedRef.current) return;
					if (holdsCounsellorSession()) {
						setStatus('staff');
						return;
					}
					setDirectLink({ context, medium: directMedium });
					/* #2252: before the waiting room opens, the date and the
					   calendar entry first; the chat is one click away. */
					if (
						!pastBeforeStartRef.current &&
						callOpensLater(context)
					) {
						setStatus('beforeStart');
						return;
					}
					if (hasActiveAuthSession()) {
						/* Signed in: the own conversation, then the app. */
						setStatus('directOpening');
						await openDirectLinkConversation(token);
						return;
					}
					/* A person without a session, at an audio or video link of a
					   counselling without calls: say so now instead of at
					   "Beitreten" (#2012). A signed-in asker and a counsellor keep
					   their flow above; the server decides for them. */
					if (directMedium !== 'CHAT') {
						const callsAllowed =
							await directLinkCallsAllowed(context);
						if (!mountedRef.current) return;
						/* Someone may have signed in in another tab meanwhile; the
						   call entry would register a guest over that session. */
						if (holdsCounsellorSession()) {
							setStatus('staff');
							return;
						}
						if (hasActiveAuthSession()) {
							setStatus('directOpening');
							await openDirectLinkConversation(token);
							return;
						}
						if (!callsAllowed) {
							setStatus('error');
							setErrorMessage(
								t('directLink.entry.callsDisabled')
							);
							return;
						}
						setStatus('directCall');
						return;
					}
					const minted = mintInviteGuestCredentials(locale);
					setLegacyRedeem({
						tenantId: context.tenantId ?? 0,
						agencyId: context.agencyId ?? 0,
						consultingTypeId: context.consultingTypeId,
						topicId: context.topicId
					});
					setIdentity(minted.identity);
					setUsername(minted.username);
					setPassword(minted.password);
					setStatus('identity');
					return;
				}
				if (
					context?.chatType === 'LIVE_CHAT' &&
					typeof context.topicId === 'number'
				) {
					setLiveTopic({
						topicId: context.topicId,
						tenantId: context.tenantId,
						consultingTypeId: context.consultingTypeId ?? undefined
					});
					setStatus('invite');
					return;
				}

				/* The lookups above can take seconds; a counsellor may have signed
				   in in another tab meanwhile. Same check as before the room's
				   redeem, so no path overwrites her. */
				if (!mountedRef.current) return;
				if (holdsCounsellorSession()) {
					setStatus('staff');
					return;
				}
				const data = await redeemInviteLink(token);

				if (isRedeemInviteLinkSessionResponse(data)) {
					/* Left the page while the POST ran: the guest exists now, so
					   withdraw it rather than install it on another page. */
					if (!mountedRef.current) {
						withdrawDiscardedGuest(data);
						return;
					}
					if (holdsCounsellorSession()) {
						withdrawDiscardedGuest(data);
						setStatus('staff');
						return;
					}
					/* Tokens first, then the entry room on this very page —
					   no hard redirect into the session's gates any more.
					   The room hands over to the session itself once a
					   counsellor has accepted and consent is given. */
					applyRedeemSessionCredentials(data);
					rememberInviteSession(token, data.sessionId);
					/* A courtesy name before anyone can look: without it
					   the counsellor's queue shows `anon_N` (#1216). Not
					   awaited — there is no page load to race any more, and
					   the room must not wait up to five seconds on a name
					   the guest is about to confirm or reroll at its door.
					   That choice wins over this one. */
					void assignInviteSessionDisplayName(data, locale);
					setRoomSessionId(data.sessionId);
					setStatus('room');
					return;
				}

				const minted = mintInviteGuestCredentials(locale);
				setLegacyRedeem(data);
				setIdentity(minted.identity);
				setUsername(minted.username);
				setPassword(minted.password);
				setStatus('identity');
			} catch (err: unknown) {
				if (await isExpiredDirectLinkError(err)) {
					if (mountedRef.current) setStatus('expired');
					return;
				}
				if (await isPausedInvite(err)) {
					if (mountedRef.current) setStatus('paused');
					return;
				}
				const failure = getCounsellingDpaFailure(err);
				setDpaFailure(failure);
				setResumeFailed(err instanceof InviteSessionResumeError);
				setStatus('error');
				setErrorMessage(
					(await accessErrorText(err, t)) ?? inviteErrorText(err, t)
				);
			}
		})();
	}, [token, locale, resumeAttempt, t]);

	const redeemForRoom = useCallback(async (): Promise<number> => {
		if (!token) throw new Error(t('inviteLink.error.missingToken'));
		/* Again here, not only on arrival: cookies are shared across tabs, and a
		   counsellor may have signed in elsewhere while this tab waited. */
		if (holdsCounsellorSession()) {
			setStatus('staff');
			throw new Error('A counsellor is signed in in this browser');
		}
		let data;
		try {
			data = await redeemInviteLink(token);
			if (!isRedeemInviteLinkSessionResponse(data)) {
				throw new Error('Invite link did not open a live-chat session');
			}
		} catch (err) {
			if (await isPausedInvite(err)) {
				if (mountedRef.current) setStatus('paused');
				throw err;
			}
			const failure = getCounsellingDpaFailure(err);
			setDpaFailure(failure);
			/* The link itself failed — consumed, withdrawn, or unreachable. Retrying
			   the name cannot fix that, so this is the unusable-invite page the
			   on-arrival flow showed, not the room's "name not saved". */
			setResumeFailed(false);
			setErrorMessage(inviteErrorText(err, t));
			setStatus('error');
			throw err;
		}
		/* Left the page after "Zum Warteraum" while the POST ran: the guest
		   exists now, so withdraw it rather than install it on another page. */
		if (!mountedRef.current) {
			withdrawDiscardedGuest(data);
			throw new Error('The invite page was left while the redeem ran');
		}
		/* And once more after the POST returns: it takes time, and the guest's
		   tokens must not land over a counsellor who signed in meanwhile. */
		if (holdsCounsellorSession()) {
			withdrawDiscardedGuest(data);
			setStatus('staff');
			throw new Error(
				'A counsellor signed in while the invite was redeemed'
			);
		}
		applyRedeemSessionCredentials(data);
		rememberInviteSession(token, data.sessionId);
		return data.sessionId;
	}, [token, t]);

	const handleReroll = useCallback(() => {
		if (!identity) return;
		const next = rerollInviteGuestUsername(identity, locale);
		setIdentity(next.identity);
		setUsername(next.username);
	}, [identity, locale]);

	const handleContinue = useCallback(async () => {
		if (!legacyRedeem || !username || !password) return;
		if (isDirectLinkPostcodeMissing(askPostcode, postcode)) {
			setPostcodeTried(true);
			return;
		}
		setStatus('registering');
		try {
			await registerThenLogin.submit(
				/* ORISO-UserService#1486: a direct-link registration carries the
				   link and its temporary flag (one builder for chat and call);
				   the server then creates no enquiry. */
				(directLink && token
					? directLinkRegistration(
							directLink.context,
							{ username, password, postcode },
							locale,
							token
						)
					: {
							username,
							password,
							agencyId: String(legacyRedeem.agencyId),
							postcode: '00000',
							termsAccepted: 'true',
							preferredLanguage: locale,
							consultingType:
								legacyRedeem.consultingTypeId != null
									? String(legacyRedeem.consultingTypeId)
									: '0',
							...(legacyRedeem.topicId != null
								? { mainTopicId: String(legacyRedeem.topicId) }
								: {})
						}) as any,
				false,
				tenant as any
			);
			if (directLink && token) {
				/* The account exists and is signed in: the own conversation
				   with the counsellor, not a new enquiry. */
				await openDirectLinkConversation(token);
				return;
			}
			redirectToApp(undefined, { navigate });
		} catch (err: unknown) {
			if (await isExpiredDirectLinkError(err)) {
				if (mountedRef.current) setStatus('expired');
				return;
			}
			if (await isPausedInvite(err)) {
				if (mountedRef.current) setStatus('paused');
				return;
			}
			const accessText = await accessErrorText(err, t);
			if (accessText) {
				setStatus('error');
				setErrorMessage(accessText);
				return;
			}
			/* The account exists, so a failed login is retried on the identity
			   step — but not when the link was switched off meanwhile (410):
			   no retry can open it, and the person is told so (#2012). */
			if (
				registerThenLogin.accountCreated() &&
				!isInactiveDirectLinkError(err)
			) {
				setLoginRetry(true);
				setStatus('identity');
				return;
			}
			const failure = getCounsellingDpaFailure(err);
			setDpaFailure(failure);
			setStatus('error');
			setErrorMessage(inviteErrorText(err, t));
		}
	}, [
		legacyRedeem,
		username,
		password,
		locale,
		tenant,
		navigate,
		t,
		registerThenLogin,
		directLink,
		token,
		askPostcode,
		postcode
	]);

	/* #2252: on to the chat (or, once it opens, the waiting room). */
	const continuePastBeforeStart = useCallback(() => {
		pastBeforeStartRef.current = true;
		hasRunRef.current = false;
		setStatus('loading');
		setResumeAttempt((attempt) => attempt + 1);
	}, []);

	/* #2252: only a person already in the conversation may ask. A person
	   with an account signs in first and comes back to this page; a guest
	   whose temporary account is not signed in here cannot ask (the page
	   says so). */
	const signInForNewLink = useCallback(() => {
		if (token) window.location.assign(loginPathForDirectLink(token));
	}, [token]);
	const requestNewLink = useCallback(async () => {
		if (!token) return;
		setNewLinkRequest('sending');
		try {
			await apiRequestDirectInvitationRenewal(token);
			if (mountedRef.current) setNewLinkRequest('sent');
		} catch {
			if (!mountedRef.current) return;
			setNewLinkRequest('idle');
			appSnackbarStack.enqueue(
				invitationErrorEntry({
					id: 'direct-invitation-request-failed',
					title: t('directInvitation.entry.expired.failedTitle'),
					text: t('directInvitation.entry.expired.failed'),
					t
				})
			);
		}
	}, [t, token]);

	const diceLabel = t('anonymousChat.pseudonym.changeName');

	if (status === 'invite') {
		return (
			<LiveChatEntryRoom
				invite={{
					topicId: liveTopic?.topicId,
					tenantId: liveTopic?.tenantId,
					consultingTypeId: liveTopic?.consultingTypeId,
					redeem: redeemForRoom
				}}
				topicSlug={topicSlug}
			/>
		);
	}

	if (status === 'loading' || status === 'directOpening') {
		return <Loading />;
	}

	if (status === 'directCall' && directLink && token) {
		return (
			<DirectLinkCallEntry
				token={token}
				context={directLink.context}
				modality={directLink.medium === 'VIDEO' ? 'video' : 'audio'}
				signedIn={directLink.signedIn}
			/>
		);
	}

	if (status === 'beforeStart' && directLink && token) {
		return (
			<InvitationBeforeStartPage
				context={directLink.context}
				token={token}
				onContinue={continuePastBeforeStart}
			/>
		);
	}

	if (status === 'expired' && token) {
		return (
			<>
				<InvitationExpired
					requestState={newLinkRequest}
					signedIn={hasActiveAuthSession()}
					onRequestNewLink={requestNewLink}
					onSignIn={signInForNewLink}
				/>
				{/* The public page has no app shell: its pop-ups need a host. */}
				<M3SnackbarHost />
			</>
		);
	}

	if (status === 'room' && roomSessionId !== null) {
		return (
			<LiveChatEntryRoom
				sessionId={roomSessionId}
				topicSlug={topicSlug}
			/>
		);
	}

	return (
		<StageLayout
			stage={<Stage hasAnimation={false} isReady={true} />}
			showLegalLinks
			showRegistrationLink={false}
		>
			<Box sx={{ maxWidth: 480, mx: 'auto', my: '40px', px: 2 }}>
				{status === 'paused' && (
					<Typography
						component="h1"
						role="alert"
						sx={registrationScreenTitleSx}
					>
						{t('inviteLink.paused')}
					</Typography>
				)}
				{status === 'staff' && (
					<Box role="alert" data-cy="invite-staff-session">
						<Typography
							component="h1"
							sx={{ mb: 1, ...registrationScreenTitleSx }}
						>
							{t('liveChat.entry.staff.headline')}
						</Typography>
						<Typography sx={registrationScreenIntroSx}>
							{t('liveChat.entry.staff.text')}
						</Typography>
					</Box>
				)}
				{status === 'registering' && (
					<p>{t('registration.registering')}</p>
				)}
				{status === 'identity' && identity && (
					<Box>
						<Typography
							component="h1"
							sx={{ mb: 1, ...registrationScreenTitleSx }}
						>
							{t('registration.account.headline')}
						</Typography>
						<Typography
							sx={{ mb: 3, ...registrationScreenIntroSx }}
						>
							{t('registration.account.subline')}
						</Typography>
						<Box
							sx={{
								display: 'flex',
								alignItems: 'center',
								gap: 2,
								mb: 1
							}}
						>
							<AnimalAvatar avatar={identity.avatar} size={48} />
							<Typography
								variant="body2"
								sx={{ color: registrationMd3.onSurfaceVariant }}
							>
								{identity.displayName}
							</Typography>
						</Box>
						<OrisoTextField
							value={username}
							placeholder={t(
								'registration.account.username.label'
							)}
							helperText={t('registration.account.username.info')}
							fullWidth
							autoComplete="username"
							inputProps={{
								'aria-label': t(
									'registration.account.username.label'
								),
								'readOnly': true
							}}
							InputProps={{
								readOnly: true,
								endAdornment: !loginRetry && (
									<InputAdornment position="end">
										<IconButton
											edge="end"
											onClick={handleReroll}
											aria-label={diceLabel}
											title={diceLabel}
											sx={{
												'color':
													registrationMd3.onSurfaceVariant,
												'&:hover': {
													backgroundColor:
														registrationMd3.focusLayer
												},
												'&:focus-visible': {
													outline: `2px solid ${registrationMd3.focus}`,
													outlineOffset: 2
												}
											}}
										>
											<Box
												component="img"
												src={genDiceIcon}
												alt=""
												sx={{ width: 20, height: 20 }}
											/>
										</IconButton>
									</InputAdornment>
								)
							}}
						/>
						{/* #1486: the platform may hide a temporary guest's
						    password; the account still gets the generated one. */}
						{!hidePasswordField && (
							<OrisoTextField
								value={password}
								placeholder={t(
									'registration.account.password.label'
								)}
								helperText={t('anonymousChat.password.warning')}
								fullWidth
								autoComplete="new-password"
								inputProps={{
									'aria-label': t(
										'registration.account.password.label'
									),
									'readOnly': true
								}}
								InputProps={{
									readOnly: true
								}}
							/>
						)}
						{askPostcode && (
							<DirectLinkPostcodeField
								value={postcode}
								onChange={setPostcode}
								showError={postcodeTried}
							/>
						)}
						{loginRetry && (
							<Typography
								role="status"
								sx={{
									mt: 3,
									...registrationScreenIntroSx
								}}
							>
								{t('registration.accountCreated.retry')}
							</Typography>
						)}
						<Button
							fullWidth
							variant="contained"
							onClick={handleContinue}
							sx={{
								'mt': 3,
								'textTransform': 'none',
								'backgroundColor': registrationMd3.primary,
								'color': registrationMd3.onPrimary,
								'&:hover': {
									backgroundColor: registrationMd3.primaryDark
								},
								'&:focus-visible': {
									outline: `2px solid ${registrationMd3.focus}`,
									outlineOffset: 2
								}
							}}
						>
							{t('anonymousChat.pseudonym.continueWithSelection')}
						</Button>
						{directLink &&
							token &&
							!loginRetry &&
							directLink.context.accessMode !== 'GUESTS_ONLY' && (
								<Button
									fullWidth
									href={loginPathForDirectLink(token)}
									data-cy="direct-link-login"
									sx={{
										mt: 1,
										textTransform: 'none',
										color: registrationMd3.primary
									}}
								>
									{t('directLink.entry.haveAccount')}
								</Button>
							)}
					</Box>
				)}
				{status === 'error' && (
					<div>
						<h3>
							{t(
								dpaFailure
									? `${dpaFailure.key}.title`
									: resumeFailed
										? 'inviteLink.resume.title'
										: 'inviteLink.error.title'
							)}
						</h3>
						<p>
							{resumeFailed
								? t('inviteLink.resume.message')
								: errorMessage}
						</p>
						{(resumeFailed || dpaFailure?.retryable) && (
							<Button
								onClick={() => {
									hasRunRef.current = false;
									setResumeFailed(false);
									setDpaFailure(null);
									setStatus('loading');
									setResumeAttempt((attempt) => attempt + 1);
								}}
							>
								{t('inviteLink.resume.retry')}
							</Button>
						)}
					</div>
				)}
			</Box>
		</StageLayout>
	);
};

/**
 * #2252: the entry page before the call waiting room opens. It moves on by
 * itself at `callOpensAt` for a call; the chat is open at once.
 */
const InvitationBeforeStartPage = ({
	context,
	token,
	onContinue
}: {
	context: InviteLinkContext;
	token: string;
	onContinue: () => void;
}) => {
	const { t } = useTranslation();
	const start = new Date(context.appointmentStartTime ?? NaN);
	const end = new Date(context.appointmentEndTime ?? NaN);
	const opensAtMs = Date.parse(context.callOpensAt ?? '');
	const isCall = context.chatType === 'AUDIO' || context.chatType === 'VIDEO';
	useEffect(() => {
		if (!isCall || !Number.isFinite(opensAtMs)) return undefined;
		const opens = new Date(opensAtMs);
		let timer: number;
		/* setTimeout fires at once beyond ~24.8 days: wait in capped steps. */
		const arm = () => {
			if (Date.now() >= opensAtMs) {
				onContinue();
				return;
			}
			timer = window.setTimeout(arm, timerDelay(opens));
		};
		timer = window.setTimeout(arm, timerDelay(opens));
		return () => window.clearTimeout(timer);
	}, [opensAtMs, isCall, onContinue]);
	return (
		<InvitationBeforeStart
			slot={{ start, end }}
			callOpensAt={new Date(opensAtMs)}
			onAddToCalendar={() =>
				downloadInvitationIcs({
					title: t('directInvitation.entry.beforeStart.title'),
					slot: { start, end },
					url: `${window.location.origin}/invite/${token}`,
					uid: `direct-invitation-${token}`
				})
			}
			onOpenChat={onContinue}
		/>
	);
};
