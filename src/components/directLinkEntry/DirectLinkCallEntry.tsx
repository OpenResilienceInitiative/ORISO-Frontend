import * as React from 'react';
import { useContext, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@mui/material';
import {
	LocaleContext,
	NOTIFICATION_TYPE_ERROR,
	NotificationsContext,
	TenantContext
} from '../../globalState';
import type { InviteLinkContext } from '../../api/apiGetInviteLinkContext';
import {
	CallEntryAccount,
	CallEntryRoom
} from '../waitingRoom/callEntry/CallEntryRoom';
import { useLiveCallDevices } from '../waitingRoom/callEntry/useLiveCallDevices';
import {
	CallDeviceControls,
	CallModality
} from '../waitingRoom/callEntry/callEntryTypes';
import {
	apiCancelOwnCallKnock,
	apiGetOwnCallKnock,
	isInactiveDirectLinkError
} from '../../api/apiDirectLinks';
import { useRegisterThenLogin } from '../registration/useRegisterThenLogin';
import {
	DirectLinkNotAdmittedError,
	EntryMedia,
	openDirectLinkConversation,
	OpenDirectLinkDeps,
	PendingKnock
} from './directLinkEntryFlow';
import { waitForKnockAdmission } from './waitForKnockAdmission';
import { directLinkRegistration } from './directLinkRegistration';
import { asksDirectLinkPostcode } from './directLinkPostcode';
import { apiGetConsentText } from '../../api/apiGetConsentText';
import { useConsentSentences } from '../waitingRoom/useConsentSentences';
import { useConsentContext } from '../waitingRoom/useConsentContext';
import {
	resolveEntryRoomConsent,
	type DepartmentConsentState
} from '../anonymousChat/entryRoom/entryRoomConsent';
import { loadAuthenticatedApp } from '../app/appChunks';
import { lazyWithReload } from '../../utils/chunkLoadRecovery';
import { Loading } from '../app/Loading';
import { loginPathForDirectLink } from '../../utils/directLinkReturn';
import { SharedCallGuest } from './SharedCallGuest';
import { EntryRoomShell } from '../anonymousChat/entryRoom/EntryRoomShell';
import { hasActiveAuthSession } from '../auth/auth';
import { isAskerDisplayNameTypingAllowed } from '../../utils/askerAccountPolicy';
import { apiPatchUserData } from '../../api/apiPatchUserData';
import { avatarIdOfFile } from '../../utils/avatarChoice';
import {
	chosenDeviceLabel,
	joinMediaFrom,
	type DeviceChoice
} from '../call/prejoin/callPrejoin';
import {
	entryGuestAccountMode,
	withChosenAccount
} from '../guestAccountMode/guestAccountMode';

const AuthenticatedApp = lazyWithReload(loadAuthenticatedApp);

/** How long entry waits for the chosen animal to be stored (FE#2209). */
const AVATAR_SAVE_WAIT_MS = 5_000;

/** FE#2542: what the link page adds so the wait happens on it. */
export type EntryWait = Pick<
	OpenDirectLinkDeps,
	'waitForAdmission' | 'entryMedia'
>;

export interface DirectLinkCallEntryDeps {
	/** Creates the account and signs in. */
	register: (account: CallEntryAccount) => Promise<void>;
	/** Opens the conversation and enters the app (a document load). */
	open: (token: string, wait?: EntryWait) => Promise<unknown>;
	/** The wait on this page asks for the knock's answer (FE#2542). */
	getKnock: typeof apiGetOwnCallKnock;
	cancelKnock: typeof apiCancelOwnCallKnock;
	knockPollMs?: number;
	/** Stores the animal picked on this page on the new account (FE#2209). */
	saveAvatar: (avatarId: string) => Promise<unknown>;
	mediaDevices?: MediaDevices;
}

interface DirectLinkCallEntryProps {
	token: string;
	context: InviteLinkContext;
	modality: CallModality;
	signedIn?: boolean;
	deps?: Partial<DirectLinkCallEntryDeps>;
}

/**
 * The device and consent check shared by both kinds of call link. A running
 * call guest opens the call-only surface. A counsellor direct link opens
 * the person's own conversation and its knock gate.
 */
export const DirectLinkCallEntry = (props: DirectLinkCallEntryProps) => {
	const { t } = useTranslation();
	const [sharedCallAccepted, setSharedCallAccepted] = useState<{
		deviceChoice: DeviceChoice;
	} | null>(null);
	if (sharedCallAccepted) {
		return (
			<React.Suspense fallback={<Loading />}>
				<AuthenticatedApp
					onAppReady={() => undefined}
					onLogout={() => undefined}
					loginPath={loginPathForDirectLink(props.token)}
					content={
						<SharedCallGuest
							token={props.token}
							modality={props.modality}
							deviceChoice={sharedCallAccepted.deviceChoice}
						/>
					}
				/>
			</React.Suspense>
		);
	}
	if (
		props.context.linkKind === 'CALL' &&
		!props.signedIn &&
		(props.context.agencyId == null ||
			props.context.consultingTypeId == null)
	) {
		return (
			<EntryRoomShell
				kicker={t('calls.share.shareTitle')}
				statusLine={t('calls.share.signInToJoin')}
			>
				<Button href={loginPathForDirectLink(props.token)}>
					{t('directLink.entry.haveAccount')}
				</Button>
			</EntryRoomShell>
		);
	}
	return (
		<DirectLinkCallEntryForm
			{...props}
			onSharedCallAccepted={(deviceChoice) =>
				setSharedCallAccepted({ deviceChoice })
			}
		/>
	);
};

const DirectLinkCallEntryForm = ({
	token,
	context,
	modality,
	signedIn = false,
	deps = {},
	onSharedCallAccepted
}: DirectLinkCallEntryProps & {
	onSharedCallAccepted: (deviceChoice: DeviceChoice) => void;
}) => {
	const { t } = useTranslation();
	const { tenant } = useContext(TenantContext) ?? ({} as never);
	const { locale } = useContext(LocaleContext) ?? { locale: 'de' };
	const { addNotification } = useContext(NotificationsContext) ?? {
		addNotification: () => undefined
	};
	const registerThenLogin = useRegisterThenLogin();
	const [controls, setControls] = useState<CallDeviceControls>({
		micOn: true,
		cameraOn: true,
		selection: {}
	});
	const live = useLiveCallDevices(modality, controls, deps.mediaDevices);
	/*
	 * The device controls stay usable while registration and the avatar save
	 * run, so the handoff reads the latest choice, not the one from the click.
	 */
	const latestDevices = useRef({ controls, live });
	latestDevices.current = { controls, live };
	const [joining, setJoining] = useState(false);
	/*
	 * FE#2542: a link with knocking waits here, on the page the person already
	 * knows, until the counsellor lets them in. The app, and with it the knock
	 * dialog, used to open first: a second window with the same switches.
	 */
	const knocks =
		context.linkKind !== 'CALL' &&
		(context.admission === 'KNOCK' || context.knock === true);
	const [waiting, setWaiting] = useState(false);
	/* The account made on this page exists from then on: a second "Beitreten"
	   (turned down, or no longer waiting) must not register again. */
	const [registered, setRegistered] = useState(false);
	const hasAccount = signedIn || registered;
	const [notLetIn, setNotLetIn] = useState<'declined' | 'ended' | null>(null);
	const wait = useRef<{ knockId: number; stop: AbortController } | null>(
		null
	);
	useEffect(() => () => wait.current?.stop.abort(), []);
	const getKnock = deps.getKnock ?? apiGetOwnCallKnock;
	const cancelKnock = deps.cancelKnock ?? apiCancelOwnCallKnock;
	const waitForAdmission = (knock: PendingKnock) => {
		const stop = new AbortController();
		wait.current = { knockId: knock.knockId, stop };
		setWaiting(true);
		return waitForKnockAdmission(knock.knockId, {
			getKnock,
			signal: stop.signal,
			...(deps.knockPollMs ? { pollMs: deps.knockPollMs } : {})
		});
	};
	const stopWaiting = () => {
		const current = wait.current;
		if (!current) return;
		current.stop.abort();
		/* Best effort: the server ends an abandoned knock itself. */
		void cancelKnock(current.knockId).catch(() => undefined);
	};
	/* The switches as they are when the person is let in, not at the click. */
	const entryMedia = (): EntryMedia => {
		const { controls: now, live: found } = latestDevices.current;
		return {
			media: joinMediaFrom({
				modality,
				micOn: now.micOn,
				cameraOn: now.cameraOn,
				cameraAvailable: !found.cameraMissing,
				blocker: found.blocker,
				microphoneLabel: chosenDeviceLabel(
					found.devices?.microphone ?? [],
					now.selection.microphone
				),
				cameraLabel: chosenDeviceLabel(
					found.devices?.camera ?? [],
					now.selection.camera
				)
			}),
			...(modality === 'video' ? { cameraSwitch: now.cameraOn } : {}),
			selection: now.selection
		};
	};
	/* UserService#1662: the link's mode decides which account a new guest
	   gets. Under GUEST_CHOOSES the guest picks, starting without an account
	   (the Gesprächskreis entry's 0a); the context then reads as that choice
	   for password field, postcode and registration. */
	const guestChooses =
		!signedIn && entryGuestAccountMode(context) === 'GUEST_CHOOSES';
	const [temporaryChosen, setTemporaryChosen] = useState(true);
	const accountContext = withChosenAccount(context, temporaryChosen);
	const isSharedCall = context.linkKind === 'CALL';
	const agencyId = context.agencyId;
	const topicId = context.topicId;
	const department =
		agencyId != null && topicId != null ? { agencyId, topicId } : null;
	const consentDepartment = isSharedCall ? department : null;
	const { context: consentNames, pending: namesPending } =
		useConsentContext(consentDepartment);
	const sentences = useConsentSentences(consentDepartment?.agencyId);
	const [departmentConsent, setDepartmentConsent] =
		useState<DepartmentConsentState>({ status: 'idle' });
	useEffect(() => {
		if (!isSharedCall || agencyId == null || topicId == null) return;
		let active = true;
		void apiGetConsentText(agencyId, topicId).then((result) => {
			if (!active) return;
			setDepartmentConsent(
				result.status === 'ok'
					? {
							status: 'ok',
							sentence: result.consentText?.sentence ?? null,
							versionId: result.consentText?.versionId ?? null
						}
					: { status: 'unavailable' }
			);
		});
		return () => {
			active = false;
		};
	}, [isSharedCall, agencyId, topicId]);
	const consent = resolveEntryRoomConsent({
		...sentences,
		hasDepartment: consentDepartment !== null,
		department: departmentConsent,
		locale,
		context: consentNames
	});

	const register =
		deps.register ??
		((account: CallEntryAccount) =>
			registerThenLogin.submit(
				directLinkRegistration(
					accountContext,
					account,
					locale,
					token
				) as never,
				false,
				tenant as never
			));
	const open =
		deps.open ??
		((value: string, entryWait?: EntryWait) =>
			openDirectLinkConversation(value, entryWait));
	const saveAvatar =
		deps.saveAvatar ??
		((avatarId: string) => apiPatchUserData({ avatarId }));
	/*
	 * FE#2209: the animal picked here is what the counsellor's knock card and
	 * the call show, and both read it from the account. Never stored, every
	 * surface derived its own (lamb here, a frog on the knock card, a fox in
	 * the call). Not worth keeping anybody out of the call over: without it
	 * the account shows its derived animal, as before. The wait is bounded:
	 * the knock card reads the account, so a quick save is worth waiting for,
	 * but a stalled one must not hold the guest here until the 30 s request
	 * timeout. A save that lands later still updates the account.
	 */
	const keepChosenAvatar = async (account: CallEntryAccount) => {
		const file = account.identity?.avatar?.file;
		if (!file) return;
		let timer: ReturnType<typeof setTimeout> | undefined;
		try {
			await Promise.race([
				saveAvatar(avatarIdOfFile(file)),
				new Promise<void>((resolve) => {
					timer = setTimeout(resolve, AVATAR_SAVE_WAIT_MS);
				})
			]);
		} catch {
			// The derived animal stays; the person still gets in.
		} finally {
			clearTimeout(timer);
		}
	};

	// Not memoised: `register` reads the current locale and tenant.
	const handleJoin = async (account: CallEntryAccount) => {
		setJoining(true);
		setNotLetIn(null);
		try {
			if (!hasAccount) {
				// Registration resets auth cookies. Never replace a session that
				// was opened in another tab while the consent room was on screen.
				if (isSharedCall && hasActiveAuthSession()) {
					window.location.reload();
					return false;
				}
				await register(account);
				setRegistered(true);
				await keepChosenAvatar(account);
			}
			if (isSharedCall) {
				const current = latestDevices.current;
				onSharedCallAccepted({
					controls: current.controls,
					cameraAvailable: !current.live.cameraMissing,
					blocker: current.live.blocker,
					devices: current.live.devices
				});
			} else await open(token, { waitForAdmission, entryMedia });
			return true;
		} catch (error) {
			setJoining(false);
			setWaiting(false);
			const knockId = wait.current?.knockId;
			wait.current = null;
			/* Turned down or no longer waiting: the person stays here, and the
			   page says which; nothing failed. */
			if (error instanceof DirectLinkNotAdmittedError) {
				if (error.outcome === 'ended' && knockId !== undefined) {
					/* Best effort: nobody should be asked to let in a person
					   who stopped waiting. */
					void cancelKnock(knockId).catch(() => undefined);
				}
				setNotLetIn(
					error.outcome === 'declined' || error.outcome === 'ended'
						? error.outcome
						: null
				);
				return false;
			}
			const status = isSharedCall
				? (error as Response | undefined)?.status
				: undefined;
			addNotification({
				notificationType: NOTIFICATION_TYPE_ERROR,
				/* A switched-off link (410) cannot work on a retry. */
				title: t(
					isInactiveDirectLinkError(error)
						? 'directLink.entry.inactive'
						: status === 403
							? 'calls.share.joinForbidden'
							: 'directLink.entry.joinFailed'
				),
				text: '',
				closeable: true,
				timeout: 5000
			});
			return false;
		}
	};

	if (isSharedCall && (!consent.readable || namesPending)) return <Loading />;

	return (
		<CallEntryRoom
			modality={modality}
			devices={live.devices}
			stream={live.stream}
			micLevel={live.micLevel}
			blocker={live.blocker}
			cameraAvailable={!live.cameraMissing}
			onCameraRetry={live.retry}
			onBlockerAction={live.retry}
			onDeviceStateChange={setControls}
			joining={joining}
			/* No curtain over a wait: the person watches this page until let in. */
			closing={isSharedCall || knocks ? null : 'call'}
			waiting={waiting}
			onStopWaiting={stopWaiting}
			turnedDown={notLetIn === 'declined'}
			waitEnded={notLetIn === 'ended'}
			consent={{ html: isSharedCall ? consent.html : '', department }}
			signedIn={hasAccount}
			loginLink={
				isSharedCall && !signedIn ? (
					<a href={loginPathForDirectLink(token)}>
						{t('directLink.entry.haveAccount')}
					</a>
				) : undefined
			}
			onJoin={handleJoin}
			hidePassword={Boolean(
				accountContext.temporaryAccount &&
					accountContext.hidePasswordField
			)}
			askPostcode={!signedIn && asksDirectLinkPostcode(accountContext)}
			accountChoice={
				guestChooses
					? {
							temporary: temporaryChosen,
							onToggle: () =>
								setTemporaryChosen((value) => !value)
						}
					: undefined
			}
			usernameEditable={isAskerDisplayNameTypingAllowed(
				tenant?.settings,
				'AGENCY_COUNSELLING'
			)}
		/>
	);
};
