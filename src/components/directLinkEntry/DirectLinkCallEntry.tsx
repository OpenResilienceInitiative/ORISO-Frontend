import * as React from 'react';
import { useContext, useState } from 'react';
import { useTranslation } from 'react-i18next';
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
import { useRegisterThenLogin } from '../registration/useRegisterThenLogin';
import { openDirectLinkConversation } from './directLinkEntryFlow';

/**
 * A registration through a counsellor direct link (ORISO-UserService#1486):
 * the link's token and its temporary flag go along. The server then creates
 * no enquiry; the person's own conversation is opened right after.
 */
export const directLinkRegistration = (
	context: InviteLinkContext,
	{ username, password }: Pick<CallEntryAccount, 'username' | 'password'>,
	locale: string,
	token: string
) => ({
	directLinkToken: token,
	temporary: Boolean(context.temporaryAccount),
	username,
	password,
	agencyId: String(context.agencyId ?? ''),
	postcode: '00000',
	termsAccepted: 'true',
	preferredLanguage: locale,
	consultingType:
		context.consultingTypeId != null
			? String(context.consultingTypeId)
			: '0',
	...(context.topicId != null ? { mainTopicId: String(context.topicId) } : {})
});

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
	deps?: Partial<DirectLinkCallEntryDeps>;
}

/**
 * An audio or video direct link opened without an account: the call entry
 * (#1386) as built — identity, device check, consent — on real devices.
 * "Beitreten" creates the account with the chosen User-ID and password,
 * opens the person's own conversation and enters the app on it, where the
 * knock dialog waits for the counsellor (`DirectLinkKnockGate`).
 */
export const DirectLinkCallEntry = ({
	token,
	context,
	modality,
	deps = {}
}: DirectLinkCallEntryProps) => {
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
			await register(account);
			await open(token);
			return true;
		} catch {
			setJoining(false);
			addNotification({
				notificationType: NOTIFICATION_TYPE_ERROR,
				title: t('directLink.entry.joinFailed'),
				text: '',
				closeable: true,
				timeout: 5000
			});
			return false;
		}
	};

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
			consent={{
				html: '',
				department:
					context.agencyId != null && context.topicId != null
						? {
								agencyId: context.agencyId,
								topicId: context.topicId
							}
						: null
			}}
			onJoin={handleJoin}
			hidePassword={Boolean(
				context.temporaryAccount && context.hidePasswordField
			)}
		/>
	);
};
