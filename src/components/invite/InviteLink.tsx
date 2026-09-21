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
import { endpoints } from '../../resources/scripts/endpoints';
import { apiPostRegistration } from '../../api/apiPostRegistration';
import {
	isRedeemInviteLinkSessionResponse,
	redeemInviteLink,
	RedeemInviteLinkLegacyResponse
} from '../../api/apiRedeemInviteLink';
import { apiGetInviteLinkContext } from '../../api/apiGetInviteLinkContext';
import { isConsultantAccessToken } from '../auth/consultantLoginBlock';
import { hasActiveAuthSession } from '../auth/auth';
import { getValueFromCookie } from '../sessionCookie/accessSessionCookie';
import { LocaleContext, TenantContext } from '../../globalState';
import { GlobalComponentContext } from '../../globalState/provider/GlobalComponentContext';
import { redirectToApp } from '../registration/autoLogin';
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
import { AnimalAvatar } from '../pseudonym/AnimalAvatar';
import { OrisoTextField } from '../form/OrisoTextField';
import genDiceIcon from '../../resources/img/registration-md3/icons/gen-dice.svg';
import {
	registrationMd3,
	registrationScreenIntroSx,
	registrationScreenTitleSx
} from '../registration/registrationDesign/registrationDesign';
import type { Pseudonym } from '../../utils/anonName/engine';

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
		| 'room'
		| 'invite'
		| 'staff'
	>('loading');
	/* A live-chat link the room opens before it is redeemed. */
	const [liveTopic, setLiveTopic] = useState<{
		topicId: number;
		consultingTypeId?: number;
	} | null>(null);
	const [roomSessionId, setRoomSessionId] = useState<number | null>(null);
	const [errorMessage, setErrorMessage] = useState('');
	const [legacyRedeem, setLegacyRedeem] =
		useState<RedeemInviteLinkLegacyResponse | null>(null);
	const [identity, setIdentity] = useState<Pseudonym | null>(null);
	const [username, setUsername] = useState('');
	const [password, setPassword] = useState('');
	const hasRunRef = useRef(false);
	const [resumeAttempt, setResumeAttempt] = useState(0);
	const [resumeFailed, setResumeFailed] = useState(false);

	useEffect(() => {
		if (!token) {
			setStatus('error');
			setErrorMessage('Missing token');
			return;
		}
		if (hasRunRef.current) return;
		hasRunRef.current = true;

		/* A counsellor signed in in this browser must not be turned into a guest.
		   Redeeming writes the guest's tokens where hers are; her next heartbeat
		   then goes out as the guest, is refused, and she silently drops out of
		   the live count while her switch still reads live (Dev, 2026-09-21). */
		/* Only a session that is still alive: the invite route runs outside the
		   app that tears an expired one down, and a stale cookie signs nobody
		   out, so it must not lock anyone out either. */
		if (holdsCounsellorSession()) {
			setStatus('staff');
			return;
		}

		(async () => {
			try {
				/* A reload must not cost a second place in the queue. Redeem
				   mints a fresh anonymous account and a fresh queue entry
				   every time it is called — right for a second guest, wrong
				   for the same guest coming back, who then waits behind
				   their own abandoned entry (#1404). If this browser already
				   holds a live session for this link, walk back into it. */
				const reusableSessionId =
					await resolveReusableInviteSession(token);
				if (reusableSessionId !== null) {
					setRoomSessionId(reusableSessionId);
					setStatus('room');
					return;
				}

				/* Who is live is asked before anything is created: the room
				   gets the link's topic, offers names only if somebody is
				   there, and redeems once a name is chosen. The context is
				   public and redeems nothing. Without it — a link kind that
				   has none, or a failed lookup — the page redeems on arrival
				   as before, rather than leave the guest at a dead door. */
				const context = await apiGetInviteLinkContext(token).catch(
					() => null
				);
				if (
					context?.chatType === 'LIVE_CHAT' &&
					typeof context.topicId === 'number'
				) {
					setLiveTopic({
						topicId: context.topicId,
						consultingTypeId: context.consultingTypeId ?? undefined
					});
					setStatus('invite');
					return;
				}

				const data = await redeemInviteLink(token);

				if (isRedeemInviteLinkSessionResponse(data)) {
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
				setResumeFailed(err instanceof InviteSessionResumeError);
				setStatus('error');
				setErrorMessage(
					err instanceof Error
						? err.message
						: 'Invite link could not be used'
				);
			}
		})();
	}, [token, locale, resumeAttempt]);

	const redeemForRoom = useCallback(async (): Promise<number> => {
		if (!token) throw new Error('Missing token');
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
			/* The link itself failed — consumed, withdrawn, or unreachable. Retrying
			   the name cannot fix that, so this is the unusable-invite page the
			   on-arrival flow showed, not the room's "name not saved". */
			setResumeFailed(false);
			setErrorMessage(
				err instanceof Error
					? err.message
					: 'Invite link could not be used'
			);
			setStatus('error');
			throw err;
		}
		applyRedeemSessionCredentials(data);
		rememberInviteSession(token, data.sessionId);
		return data.sessionId;
	}, [token]);

	const handleReroll = useCallback(() => {
		if (!identity) return;
		const next = rerollInviteGuestUsername(identity, locale);
		setIdentity(next.identity);
		setUsername(next.username);
	}, [identity, locale]);

	const handleContinue = useCallback(async () => {
		if (!legacyRedeem || !username || !password) return;
		setStatus('registering');
		try {
			await apiPostRegistration(
				endpoints.registerAsker,
				{
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
				} as any,
				false,
				tenant as any
			);
			redirectToApp(undefined, { navigate });
		} catch (err: unknown) {
			setStatus('error');
			setErrorMessage(
				err instanceof Error
					? err.message
					: 'Invite link could not be used'
			);
		}
	}, [legacyRedeem, username, password, locale, tenant, navigate]);

	const diceLabel = t('anonymousChat.pseudonym.changeName', 'Name ändern');

	/* While it looks, and for a live-chat link after that, the room itself is
	   on screen — the same element throughout, so on a desktop the stage stays
	   and only the column changes. */
	if (status === 'loading' || status === 'invite') {
		return (
			<LiveChatEntryRoom
				invite={{
					topicId: liveTopic?.topicId,
					consultingTypeId: liveTopic?.consultingTypeId,
					redeem: redeemForRoom
				}}
				topicSlug={topicSlug}
			/>
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
				{status === 'staff' && (
					<Box role="alert" data-cy="invite-staff-session">
						<Typography
							component="h1"
							sx={{ mb: 1, ...registrationScreenTitleSx }}
						>
							{t(
								'liveChat.entry.staff.headline',
								'Sie sind als Beraterin angemeldet.'
							)}
						</Typography>
						<Typography sx={registrationScreenIntroSx}>
							{t(
								'liveChat.entry.staff.text',
								'Dieser Link würde Sie hier abmelden und Sie wären nicht mehr live. Öffnen Sie ihn zum Testen bitte in einem privaten Fenster.'
							)}
						</Typography>
					</Box>
				)}
				{status === 'registering' && (
					<p>
						{t(
							'registration.registering',
							'Registrierung läuft...'
						)}
					</p>
				)}
				{status === 'identity' && identity && (
					<Box>
						<Typography
							component="h1"
							sx={{ mb: 1, ...registrationScreenTitleSx }}
						>
							{t(
								'registration.account.headline',
								'Anmeldedaten erfassen'
							)}
						</Typography>
						<Typography
							sx={{ mb: 3, ...registrationScreenIntroSx }}
						>
							{t(
								'registration.account.subline',
								'Um Ihre Anonymität zu schützen, raten wir Ihnen, nicht Ihren tatsächlichen Namen oder Initialen zu verwenden.'
							)}
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
								'registration.account.username.label',
								'User-ID'
							)}
							helperText={t(
								'registration.account.username.info',
								'Anonymer Login-Name. Bitte keine echten Namen oder Initialen verwenden.'
							)}
							fullWidth
							autoComplete="username"
							inputProps={{
								'aria-label': t(
									'registration.account.username.label',
									'User-ID'
								),
								'readOnly': true
							}}
							InputProps={{
								readOnly: true,
								endAdornment: (
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
						<OrisoTextField
							value={password}
							placeholder={t(
								'registration.account.password.label',
								'Passwort'
							)}
							helperText={t(
								'anonymousChat.password.warning',
								'Bitte kopieren Sie das Passwort und speichern Sie es sicher, um später auf Ihr Konto zugreifen zu können.'
							)}
							fullWidth
							autoComplete="new-password"
							inputProps={{
								'aria-label': t(
									'registration.account.password.label',
									'Passwort'
								),
								'readOnly': true
							}}
							InputProps={{
								readOnly: true
							}}
						/>
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
							{t(
								'anonymousChat.pseudonym.continueWithSelection',
								'Weiter mit Auswahl'
							)}
						</Button>
					</Box>
				)}
				{status === 'error' && (
					<div>
						<h3>
							{t(
								resumeFailed
									? 'inviteLink.resume.title'
									: 'inviteLink.error.title',
								resumeFailed
									? 'Verbindung unterbrochen'
									: 'This invite link can no longer be used'
							)}
						</h3>
						<p>
							{resumeFailed
								? t(
										'inviteLink.resume.message',
										'Die Sitzung konnte gerade nicht geladen werden. Bitte versuchen Sie es erneut.'
									)
								: errorMessage}
						</p>
						{resumeFailed && (
							<Button
								onClick={() => {
									hasRunRef.current = false;
									setResumeFailed(false);
									setStatus('loading');
									setResumeAttempt((attempt) => attempt + 1);
								}}
							>
								{t(
									'inviteLink.resume.retry',
									'Erneut versuchen'
								)}
							</Button>
						)}
					</div>
				)}
			</Box>
		</StageLayout>
	);
};
