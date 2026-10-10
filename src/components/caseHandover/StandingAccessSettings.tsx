import { UserDataContext } from '../../globalState/context/UserDataContext';
import * as React from 'react';
import {
	useContext,
	useEffect,
	useId,
	useLayoutEffect,
	useRef,
	useState
} from 'react';
import { useTranslation } from 'react-i18next';
import {
	apiGetCaseHandoverConsentPreference,
	apiSaveCaseHandoverConsentPreference,
	type CaseHandoverConsentPreference
} from '../../api/apiCaseHandover';
import { M3Dialog } from '../m3Dialog/M3Dialog';
import { SurveillanceConsentIcon } from '../../resources/img/icons';
import { StandingAccessPreference } from './StandingAccessPreference';
import { useTenant } from '../../globalState/provider/TenantProvider';
import { notificationChannelPolicy } from '../erstantwort/notificationChannelPolicy';
import { useNotificationChannels } from '../erstantwort/useNotificationChannels';
import { NotificationSetup } from '../erstantwort/NotificationSetup';
import { Button, BUTTON_TYPES } from '../button/Button';
import { CaseHandoverInfoDialog } from './CaseHandoverClientCards';
import { ErstantwortSequence } from '../erstantwort/ErstantwortSequence';

/** Manual per-conversation setting. This never decides a pending request. */
export const StandingAccessSettings = ({
	sessionId,
	conversationType,
	accessMode,
	compact = false,
	onSetupNotifications
}: {
	sessionId: number;
	conversationType?: string;
	/** Only a persisted acceptance/grant notice supplies this context. */
	accessMode?: 'OPT_IN' | 'OPT_OUT' | 'NONE';
	/** Compact action inside an existing persisted chat notice. */
	compact?: boolean;
	onSetupNotifications?: () => void;
}) => {
	const { t } = useTranslation();
	const tenant = useTenant();
	const { userData } = useContext(UserDataContext);
	const policy = notificationChannelPolicy(
		tenant?.settings,
		conversationType
	);
	const { consentEmailActive } = useNotificationChannels(
		policy.emailAllowed,
		policy.browserAllowed
	);
	const [open, setOpen] = useState(false);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState(false);
	const [preference, setPreference] =
		useState<CaseHandoverConsentPreference | null>(null);
	const [recommendation, setRecommendation] = useState(false);
	const [setupStarted, setSetupStarted] = useState(false);
	const triggerId = useId();
	const opener = useRef<HTMLElement | null>(null);
	const generation = useRef(0);
	const requestSequence = useRef(0);
	const strengthened = useRef(false);
	useLayoutEffect(() => {
		generation.current += 1;
		opener.current = null;
		setOpen(false);
		setLoading(false);
		strengthened.current = false;
		setPreference(null);
		setRecommendation(false);
		setSetupStarted(false);
		setError(false);
		return () => {
			generation.current += 1;
		};
	}, [sessionId, tenant?.id, userData?.userId]);
	useEffect(() => {
		if (open || !opener.current) return;
		const node = opener.current;
		const context = generation.current;
		const request = requestSequence.current;
		opener.current = null;
		// A native disabled opener may lose focus before MUI can remember it.
		// Restore only this closed dialog's opener after MUI's own cleanup.
		queueMicrotask(() => {
			if (
				context === generation.current &&
				request === requestSequence.current &&
				node.isConnected
			)
				node.focus();
		});
	}, [open]);
	const checked = (value: CaseHandoverConsentPreference) => {
		if (
			value?.sessionId !== sessionId ||
			typeof value.alwaysAskBeforeAdditionalAccess !== 'boolean'
		) {
			throw new Error('Preference response does not match conversation');
		}
		return value;
	};
	const load = async () => {
		const operation = generation.current;
		const request = ++requestSequence.current;
		const isCurrent = () =>
			operation === generation.current &&
			request === requestSequence.current;
		setLoading(true);
		setError(false);
		try {
			const value = checked(
				await apiGetCaseHandoverConsentPreference(sessionId)
			);
			if (isCurrent()) setPreference(value);
		} catch {
			if (isCurrent()) {
				setPreference(null);
				setError(true);
			}
		} finally {
			if (isCurrent()) setLoading(false);
		}
	};
	const save = async (alwaysAsk: boolean): Promise<boolean> => {
		const operation = generation.current;
		const request = ++requestSequence.current;
		const previouslyEnabled =
			preference?.alwaysAskBeforeAdditionalAccess === true;
		checked(
			await apiSaveCaseHandoverConsentPreference(sessionId, alwaysAsk)
		);
		const saved = checked(
			await apiGetCaseHandoverConsentPreference(sessionId)
		);
		if (
			operation !== generation.current ||
			request !== requestSequence.current ||
			saved.alwaysAskBeforeAdditionalAccess !== alwaysAsk
		) {
			throw new Error('Preference was not confirmed');
		}
		strengthened.current = alwaysAsk && !previouslyEnabled;
		setPreference(saved);
		if (!alwaysAsk) setRecommendation(false);
		return saved.alwaysAskBeforeAdditionalAccess;
	};
	const closeSettings = () => {
		requestSequence.current += 1;
		setLoading(false);
		setOpen(false);
	};
	const preferenceContent = (
		<>
			{loading && (
				<p role="status">
					{t('caseHandover.standingPreference.loading')}
				</p>
			)}
			{error && (
				<div role="alert">
					<p>{t('caseHandover.error.failed')}</p>
					<button type="button" onClick={() => void load()}>
						{t('sessionList.reloadButton.label')}
					</button>
				</div>
			)}
			{!loading && preference && (
				<StandingAccessPreference
					conversationId={sessionId}
					alwaysAsk={preference.alwaysAskBeforeAdditionalAccess}
					onSave={save}
					onSaved={() => {
						closeSettings();
						// Voluntary recommendation only after the user strengthens the future gate.
						// A browser channel alone does not suppress this specific email suggestion.
						if (
							strengthened.current &&
							policy.emailAllowed &&
							!consentEmailActive
						)
							setRecommendation(true);
					}}
				/>
			)}
		</>
	);
	const openSettings = () => {
		opener.current = document.getElementById(triggerId);
		setOpen(true);
		void load();
	};
	return (
		<>
			{accessMode || compact ? (
				<Button
					className="caseHandoverInformational__more"
					ariaHasPopup="dialog"
					disabled={loading}
					item={{
						type: BUTTON_TYPES.LINK_INLINE,
						id: triggerId,
						label: t('caseHandover.consent.info.more')
					}}
					buttonHandle={openSettings}
				/>
			) : (
				<button
					type="button"
					id={triggerId}
					className="erstantwort__action"
					aria-haspopup="dialog"
					disabled={loading}
					onClick={openSettings}
				>
					{t('caseHandover.consent.info.title')}
				</button>
			)}
			{accessMode ? (
				<CaseHandoverInfoDialog
					open={open}
					mode={accessMode}
					onClose={closeSettings}
					onSetupNotifications={onSetupNotifications}
				>
					{preferenceContent}
				</CaseHandoverInfoDialog>
			) : (
				<M3Dialog
					open={open}
					onClose={closeSettings}
					closeLabel={t('app.close')}
					title={t('caseHandover.consent.info.title')}
					icon={
						<SurveillanceConsentIcon
							aria-hidden
							focusable="false"
						/>
					}
					actions={[
						{ label: t('app.close'), onClick: closeSettings }
					]}
				>
					{preferenceContent}
				</M3Dialog>
			)}

			{recommendation &&
				policy.emailAllowed &&
				(setupStarted || !consentEmailActive) && (
					<ErstantwortSequence
						skipAnimation
						bausteine={[
							{
								id: 'standingConsentNotifications',
								body: '',
								headline: ''
							}
						]}
						slots={{
							standingConsentNotifications: (
								<>
									<p>
										{t(
											'caseHandover.consent.info.notificationsCopy'
										)}
									</p>
									<NotificationSetup
										onStart={() => setSetupStarted(true)}
										isEmailEnabled={policy.emailAllowed}
										isBrowserEnabled={policy.browserAllowed}
									/>
								</>
							)
						}}
					/>
				)}
		</>
	);
};
