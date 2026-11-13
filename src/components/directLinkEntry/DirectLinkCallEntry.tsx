import * as React from 'react';
import { useContext, useEffect, useState } from 'react';
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
import { isInactiveDirectLinkError } from '../../api/apiDirectLinks';
import { useRegisterThenLogin } from '../registration/useRegisterThenLogin';
import { openDirectLinkConversation } from './directLinkEntryFlow';
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

const AuthenticatedApp = lazyWithReload(loadAuthenticatedApp);

export interface DirectLinkCallEntryDeps {
	/** Creates the account and signs in. */
	register: (account: CallEntryAccount) => Promise<void>;
	/** Opens the conversation and enters the app (a document load). */
	open: (token: string) => Promise<unknown>;
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
	const [sharedCallAccepted, setSharedCallAccepted] = useState(false);
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
			onSharedCallAccepted={() => setSharedCallAccepted(true)}
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
}: DirectLinkCallEntryProps & { onSharedCallAccepted: () => void }) => {
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
	const [joining, setJoining] = useState(false);
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
					context,
					account,
					locale,
					token
				) as never,
				false,
				tenant as never
			));
	const open =
		deps.open ?? ((value: string) => openDirectLinkConversation(value));

	// Not memoised: `register` reads the current locale and tenant.
	const handleJoin = async (account: CallEntryAccount) => {
		setJoining(true);
		try {
			if (!signedIn) {
				// Registration resets auth cookies. Never replace a session that
				// was opened in another tab while the consent room was on screen.
				if (isSharedCall && hasActiveAuthSession()) {
					window.location.reload();
					return false;
				}
				await register(account);
			}
			if (isSharedCall) onSharedCallAccepted();
			else await open(token);
			return true;
		} catch (error) {
			setJoining(false);
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
			closing={isSharedCall ? null : 'call'}
			consent={{ html: isSharedCall ? consent.html : '', department }}
			signedIn={signedIn}
			loginLink={
				isSharedCall && !signedIn ? (
					<a href={loginPathForDirectLink(token)}>
						{t('directLink.entry.haveAccount')}
					</a>
				) : undefined
			}
			onJoin={handleJoin}
			hidePassword={Boolean(
				context.temporaryAccount && context.hidePasswordField
			)}
			askPostcode={!signedIn && asksDirectLinkPostcode(context)}
			usernameEditable={isAskerDisplayNameTypingAllowed(
				tenant?.settings,
				'AGENCY_COUNSELLING'
			)}
		/>
	);
};
