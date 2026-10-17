import { UserDataContext } from '../../globalState/context/UserDataContext';
import { useStandingAccessPreference } from './useStandingAccessPreference';
import { StandingAccessPreference } from './StandingAccessPreference';
import { useNotificationChannels } from '../erstantwort/useNotificationChannels';
import * as React from 'react';
import NotificationsNoneOutlined from '@mui/icons-material/NotificationsNoneOutlined';
import './CaseHandoverConversation.styles.scss';
import {
	useEffect,
	useRef,
	useState,
	useContext,
	useLayoutEffect
} from 'react';
import { useTenant } from '../../globalState/provider/TenantProvider';
import { useTranslation } from 'react-i18next';
import { CaseHandoverConsentCard } from './CaseHandoverClientCards';
import { ErstantwortSequence } from '../erstantwort/ErstantwortSequence';
import { notificationChannelPolicy } from '../erstantwort/notificationChannelPolicy';
import { NotificationSetup } from '../erstantwort/NotificationSetup';

/** The caller keys this continuation by session, so transient setup never moves
 * into another conversation. Account/device settings remain their existing stores. */
export const CaseHandoverConversation = ({
	sessionId,
	conversationType,
	...consent
}: React.ComponentProps<typeof CaseHandoverConsentCard> & {
	sessionId?: number;
	conversationType?: string;
}) => {
	const { t } = useTranslation();
	const tenant = useTenant();
	const channels = notificationChannelPolicy(
		tenant?.settings,
		conversationType
	);
	const future = useStandingAccessPreference(sessionId, true);
	const { consentEmailActive } = useNotificationChannels(
		channels.emailAllowed,
		channels.browserAllowed
	);
	const [notificationsOpen, setNotificationsOpen] = useState(false);
	const [recommendation, setRecommendation] = useState(false);
	const [setupStarted, setSetupStarted] = useState(false);
	const { userData } = useContext(UserDataContext);
	const [focusRequest, setFocusRequest] = useState(0);
	const notificationMessage = useRef<HTMLDivElement>(null);
	useLayoutEffect(() => {
		setNotificationsOpen(false);
		setRecommendation(false);
		setSetupStarted(false);
		setFocusRequest(0);
	}, [sessionId, tenant?.id, userData?.userId]);

	useEffect(() => {
		if (!focusRequest) return;
		// The M3 dialog first completes its close transition and restores focus.
		const timer = window.setTimeout(() => {
			notificationMessage.current?.scrollIntoView?.({
				behavior: 'smooth',
				block: 'nearest'
			});
			notificationMessage.current?.focus();
		}, 300);
		return () => window.clearTimeout(timer);
	}, [focusRequest]);

	const futureControl = sessionId ? (
		<>
			{future.loading && (
				<p role="status">
					{t('caseHandover.standingPreference.loading')}
				</p>
			)}
			{future.error && !future.preference && (
				<div role="alert">
					<p>{t('caseHandover.error.failed')}</p>
					<button type="button" onClick={() => void future.load()}>
						{t('sessionList.reloadButton.label')}
					</button>
				</div>
			)}
			{future.preference && (
				<StandingAccessPreference
					conversationId={sessionId}
					alwaysAsk={
						future.preference.alwaysAskBeforeAdditionalAccess
					}
					disabled={future.loading || future.saving}
					onSave={future.save}
					onSaved={(alwaysAsk) => {
						if (!alwaysAsk) setRecommendation(false);
						if (
							future.didStrengthen() &&
							channels.emailAllowed &&
							!consentEmailActive
						)
							setRecommendation(true);
					}}
				/>
			)}
		</>
	) : null;
	return (
		<>
			<CaseHandoverConsentCard
				{...consent}
				futurePreference={futureControl}
				futurePreferenceInDialog={futureControl}
				onSetupNotifications={
					channels.emailAllowed || channels.browserAllowed
						? () => {
								setNotificationsOpen(true);
								setFocusRequest((value) => value + 1);
							}
						: undefined
				}
			/>
			{(notificationsOpen ||
				setupStarted ||
				(recommendation && !consentEmailActive)) &&
				(channels.emailAllowed || channels.browserAllowed) && (
					<div
						ref={notificationMessage}
						className="caseHandoverNotificationMessage"
						tabIndex={-1}
						role="region"
						aria-label={t(
							'caseHandover.consent.info.notificationsAction'
						)}
					>
						<ErstantwortSequence
							skipAnimation
							bausteine={[
								{
									id: 'handoverNotifications',
									body: '',
									headline: ''
								}
							]}
							slots={{
								handoverNotifications: (
									<>
										<h3 className="caseHandoverNotificationTitle">
											<NotificationsNoneOutlined
												aria-hidden
											/>
											{t(
												'caseHandover.consent.info.notificationsAction'
											)}
										</h3>
										<NotificationSetup
											onStart={() =>
												setSetupStarted(true)
											}
											isBrowserEnabled={
												channels.browserAllowed
											}
											isEmailEnabled={
												channels.emailAllowed
											}
										/>
									</>
								)
							}}
						/>
					</div>
				)}
		</>
	);
};
