import { UserDataContext } from '../../globalState/context/UserDataContext';
import * as React from 'react';
import { useContext, useLayoutEffect, useRef, useState } from 'react';
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
import { ErstantwortSequence } from '../erstantwort/ErstantwortSequence';

/** Manual per-conversation setting. This never decides a pending request. */
export const StandingAccessSettings = ({
	sessionId,
	conversationType
}: {
	sessionId: number;
	conversationType?: string;
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
	const generation = useRef(0);
	const strengthened = useRef(false);
	useLayoutEffect(() => {
		generation.current += 1;
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
		setLoading(true);
		setError(false);
		try {
			const value = checked(
				await apiGetCaseHandoverConsentPreference(sessionId)
			);
			if (operation === generation.current) setPreference(value);
		} catch {
			if (operation === generation.current) {
				setPreference(null);
				setError(true);
			}
		} finally {
			if (operation === generation.current) setLoading(false);
		}
	};
	const save = async (alwaysAsk: boolean): Promise<boolean> => {
		const operation = generation.current;
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
			saved.alwaysAskBeforeAdditionalAccess !== alwaysAsk
		) {
			throw new Error('Preference was not confirmed');
		}
		strengthened.current = alwaysAsk && !previouslyEnabled;
		setPreference(saved);
		if (!alwaysAsk) setRecommendation(false);
		return saved.alwaysAskBeforeAdditionalAccess;
	};
	return (
		<>
			<button
				type="button"
				className="erstantwort__action"
				aria-haspopup="dialog"
				disabled={loading}
				onClick={() => {
					setOpen(true);
					void load();
				}}
			>
				{t('caseHandover.consent.info.title')}
			</button>
			<M3Dialog
				open={open}
				onClose={() => setOpen(false)}
				closeLabel={t('app.close')}
				title={t('caseHandover.consent.info.title')}
				icon={<SurveillanceConsentIcon aria-hidden focusable="false" />}
				actions={[
					{ label: t('app.close'), onClick: () => setOpen(false) }
				]}
			>
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
							setOpen(false);
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
			</M3Dialog>
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
