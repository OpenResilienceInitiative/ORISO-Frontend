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
import { useStandingAccessPreference } from './useStandingAccessPreference';
import { M3Dialog } from '../m3Dialog/M3Dialog';
import { SurveillanceConsentIcon } from '../../resources/img/icons';
import { StandingAccessPreference } from './StandingAccessPreference';
import { useTenant } from '../../globalState/provider/TenantProvider';
import { notificationChannelPolicy } from '../erstantwort/notificationChannelPolicy';
import { useNotificationChannels } from '../erstantwort/useNotificationChannels';
import { NotificationSetupMessage } from '../erstantwort/NotificationSetupMessage';
import { Button, BUTTON_TYPES } from '../button/Button';
import { CaseHandoverInfoDialog } from './CaseHandoverClientCards';

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
	const {
		loading,
		saving,
		error,
		preference,
		load,
		save,
		invalidate,
		didStrengthen
	} = useStandingAccessPreference(sessionId);
	const [recommendation, setRecommendation] = useState(false);
	const [setupStarted, setSetupStarted] = useState(false);
	const triggerId = useId();
	const opener = useRef<HTMLElement | null>(null);
	const generation = useRef(0);
	const requestSequence = useRef(0);
	useLayoutEffect(() => {
		generation.current += 1;
		opener.current = null;
		setOpen(false);
		setRecommendation(false);
		setSetupStarted(false);
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
	const closeSettings = () => {
		invalidate();
		requestSequence.current += 1;
		setOpen(false);
	};
	const preferenceContent = (
		<>
			{loading && (
				<p role="status">
					{t('caseHandover.standingPreference.loading')}
				</p>
			)}
			{error && !preference && (
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
					disabled={saving}
					onSave={save}
					onSaved={(alwaysAsk) => {
						if (!alwaysAsk && !setupStarted)
							setRecommendation(false);
						closeSettings();
						// Voluntary recommendation only after the user strengthens the future gate.
						// A browser channel alone does not suppress this specific email suggestion.
						if (
							didStrengthen() &&
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
		requestSequence.current += 1;
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
					<NotificationSetupMessage
						requireConsentEmail
						onStart={() => setSetupStarted(true)}
						isEmailEnabled={policy.emailAllowed}
						isBrowserEnabled={policy.browserAllowed}
						copy={
							<p>
								{t(
									'caseHandover.consent.info.notificationsCopy'
								)}
							</p>
						}
					/>
				)}
		</>
	);
};
