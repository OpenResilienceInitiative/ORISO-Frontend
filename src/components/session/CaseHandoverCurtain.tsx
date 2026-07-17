import * as React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import {
	apiGetCaseHandoverReasons,
	apiRequestCaseHandoverAccess,
	CaseHandoverReason,
	CaseHandoverStatus
} from '../../api/apiCaseHandover';
import { FETCH_ERRORS } from '../../api/fetchData';
import {
	isCaseHandoverDenied,
	isCaseHandoverPending
} from './caseHandoverHelpers';
import { ReactComponent as CaseHandoverIcon } from '../../resources/img/icons/case-handover/case-handover.svg';
import { ReactComponent as TutorialIcon } from '../../resources/img/icons/case-handover/tutorial.svg';
import './caseHandoverCurtain.styles';

/**
 * Access-control curtain in the conversation pane (Figma "CARX — Teamberatung
 * Case Handover", Screens 01–03, Sections 02–03). Replaces CaseHandoverGate.
 *
 * Wizard: intro ("How can I see the inquiry here?") → select reason (radio
 * list with keyboard shortcuts) → describe reason (free text) → request.
 * Pending / client-consent / denied states render as terminal curtain states.
 */

export type CaseHandoverCurtainStep =
	| 'intro'
	| 'reason'
	| 'describe'
	| 'pending'
	| 'consentPending'
	| 'denied';

const IconEyeOff = () => (
	<svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
		<path
			d="M15.775 12.975L14.325 11.525C14.475 10.7417 14.25 10.0083 13.65 9.325C13.05 8.64167 12.275 8.375 11.325 8.525L9.875 7.075C10.2083 6.925 10.5458 6.8125 10.8875 6.7375C11.2292 6.6625 11.6 6.625 12 6.625C13.25 6.625 14.3125 7.0625 15.1875 7.9375C16.0625 8.8125 16.5 9.875 16.5 11.125C16.5 11.525 16.4625 11.8958 16.3875 12.2375C16.3125 12.5792 16.1083 12.825 15.775 12.975ZM19.3 16.45L17.85 15.05C18.4833 14.5667 19.046 14.0375 19.538 13.4625C20.0293 12.8875 20.4417 12.2417 20.775 11.525C19.9417 9.84167 18.7460 8.50417 17.188 7.5125C15.6293 6.52083 13.9 6.025 12 6.025C11.5167 6.025 11.0417 6.05833 10.575 6.125C10.1083 6.19167 9.65 6.29167 9.2 6.425L7.65 4.875C8.34167 4.59167 9.05 4.38333 9.775 4.25C10.5 4.11667 11.2417 4.05 12 4.05C14.4833 4.05 16.7043 4.7375 18.663 6.1125C20.621 7.4875 22.0417 9.29167 22.925 11.525C22.5417 12.5083 22.0377 13.4167 21.413 14.25C20.7877 15.0833 20.0833 15.8167 19.3 16.45ZM19.8 22.6L15.6 18.45C15.0167 18.6333 14.4293 18.7708 13.838 18.8625C13.246 18.9542 12.6333 19 12 19C9.51667 19 7.29567 18.3125 5.337 16.9375C3.379 15.5625 1.95833 13.7583 1.075 11.525C1.425 10.6417 1.86667 9.82083 2.4 9.0625C2.93333 8.30417 3.54167 7.625 4.225 7.025L1.4 4.2L2.8 2.8L21.2 21.2L19.8 22.6ZM5.625 8.425C5.14167 8.85833 4.696 9.33333 4.288 9.85C3.87933 10.3667 3.54167 10.925 3.275 11.525C4.10833 13.2083 5.304 14.5458 6.862 15.5375C8.42067 16.5292 10.15 17.025 12 17.025C12.3167 17.025 12.6293 17.0042 12.938 16.9625C13.246 16.9208 13.5583 16.875 13.875 16.825L12.975 15.875C12.8083 15.925 12.6458 15.9625 12.4875 15.9875C12.3292 16.0125 12.1667 16.025 12 16.025C10.75 16.025 9.6875 15.5875 8.8125 14.7125C7.9375 13.8375 7.5 12.775 7.5 11.525C7.5 11.3583 7.51267 11.1958 7.538 11.0375C7.56267 10.8792 7.6 10.7167 7.65 10.55L5.625 8.425Z"
			fill="currentColor"
		/>
	</svg>
);

const IconArrowBack = () => (
	<svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
		<path
			d="M12 20L4 12L12 4L13.425 5.4L7.825 11H20V13H7.825L13.425 18.6L12 20Z"
			fill="currentColor"
		/>
	</svg>
);

const IconArrowForward = () => (
	<svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
		<path
			d="M12 20L10.575 18.6L16.175 13H4V11H16.175L10.575 5.4L12 4L20 12L12 20Z"
			fill="currentColor"
		/>
	</svg>
);

export interface CaseHandoverCurtainViewProps {
	step: CaseHandoverCurtainStep;
	topicLabel?: string;
	reasons: CaseHandoverReason[];
	reasonCode: string;
	explanation: string;
	isSubmitting?: boolean;
	error?: string;
	onStart: () => void;
	onBack: () => void;
	onNext: () => void;
	onReasonSelect: (code: string) => void;
	onExplanationChange: (value: string) => void;
	onSubmit: () => void;
}

/** Presentational curtain (stories render this directly). */
export const CaseHandoverCurtainView = ({
	step,
	topicLabel,
	reasons,
	reasonCode,
	explanation,
	isSubmitting = false,
	error,
	onStart,
	onBack,
	onNext,
	onReasonSelect,
	onExplanationChange,
	onSubmit
}: CaseHandoverCurtainViewProps) => {
	const { t: translate } = useTranslation();
	const selectedReason = useMemo(
		() => reasons.find((reason) => reason.code === reasonCode),
		[reasons, reasonCode]
	);
	const isMac =
		typeof navigator !== 'undefined' &&
		/mac/i.test(navigator.platform || '');
	const shortcutPrefix = isMac ? '⌘R' : 'Ctrl+R';

	const handleReasonListKeyDown = (
		event: React.KeyboardEvent<HTMLDivElement>
	) => {
		const digit = Number.parseInt(event.key, 10);
		if (!Number.isNaN(digit) && digit >= 1 && digit <= reasons.length) {
			event.preventDefault();
			onReasonSelect(reasons[digit - 1].code);
		}
	};

	const renderReasonList = (interactive: boolean) => (
		<div
			className="caseHandoverCurtain__reasons"
			role="radiogroup"
			aria-label={translate('caseHandover.curtain.reason.title')}
			onKeyDown={interactive ? handleReasonListKeyDown : undefined}
		>
			{reasons.map((reason, index) => {
				const isSelected = reasonCode === reason.code;
				return (
					<button
						type="button"
						key={reason.code}
						role="radio"
						aria-checked={isSelected}
						className={clsx(
							'caseHandoverCurtain__reason',
							isSelected &&
								'caseHandoverCurtain__reason--selected'
						)}
						onClick={
							interactive
								? () => onReasonSelect(reason.code)
								: undefined
						}
						disabled={!interactive}
						data-cy={`case-handover-reason-${reason.code}`}
					>
						<span
							className="caseHandoverCurtain__reasonRadio"
							aria-hidden
						/>
						<span className="caseHandoverCurtain__reasonLabel">
							{reason.label}
						</span>
						{reason.clientConsentRequired && (
							<span className="caseHandoverCurtain__reasonConsentHint">
								{translate(
									'caseHandover.policy.clientConsentRequired'
								)}
							</span>
						)}
						<kbd className="caseHandoverCurtain__reasonShortcut">
							{shortcutPrefix}+{index + 1}
						</kbd>
					</button>
				);
			})}
		</div>
	);

	return (
		<div className="caseHandoverCurtain" data-cy="case-handover-curtain">
			<div className="caseHandoverCurtain__card">
				<div className="caseHandoverCurtain__header">
					<span
						className="caseHandoverCurtain__headerIcon"
						aria-hidden
					>
						<IconEyeOff />
					</span>
					<h2 className="caseHandoverCurtain__headerTitle">
						{translate('caseHandover.hidden.title')}
					</h2>
				</div>
				{topicLabel && (
					<div className="caseHandoverCurtain__topicRow">
						<span className="caseHandoverCurtain__topicBadge">
							{topicLabel}
						</span>
					</div>
				)}

				<div className="caseHandoverCurtain__body">
					{step === 'intro' && (
						<>
							<div className="caseHandoverCurtain__hero">
								<CaseHandoverIcon
									className="caseHandoverCurtain__heroIcon"
									aria-hidden
								/>
								<h3 className="caseHandoverCurtain__title">
									{translate(
										'caseHandover.curtain.intro.title'
									)}
								</h3>
							</div>
							<p className="caseHandoverCurtain__copy">
								{translate('caseHandover.curtain.intro.copy')}
							</p>
							<div className="caseHandoverCurtain__introActions">
								<button
									type="button"
									className="caseHandoverCurtain__stepByStep"
									onClick={onStart}
									data-cy="case-handover-curtain-start"
								>
									<TutorialIcon
										className="caseHandoverCurtain__stepByStepIcon"
										aria-hidden
									/>
									{translate(
										'caseHandover.curtain.intro.cta'
									)}
								</button>
							</div>
						</>
					)}

					{(step === 'reason' || step === 'describe') && (
						<>
							<div className="caseHandoverCurtain__hero">
								<CaseHandoverIcon
									className="caseHandoverCurtain__heroIcon"
									aria-hidden
								/>
								<h3 className="caseHandoverCurtain__title">
									{step === 'reason'
										? translate(
												'caseHandover.curtain.reason.title'
											)
										: translate(
												'caseHandover.curtain.describe.title'
											)}
								</h3>
							</div>
							<p className="caseHandoverCurtain__copy">
								{step === 'reason'
									? translate(
											'caseHandover.curtain.reason.subtitle'
										)
									: translate(
											'caseHandover.curtain.describe.subtitle'
										)}
							</p>
							{renderReasonList(step === 'reason')}
							{step === 'describe' && (
								<textarea
									className="caseHandoverCurtain__explanation"
									value={explanation}
									onChange={(event) =>
										onExplanationChange(event.target.value)
									}
									placeholder={translate(
										'caseHandover.explanation.placeholder'
									)}
									aria-label={translate(
										'caseHandover.explanation.placeholder'
									)}
									rows={4}
									data-cy="case-handover-curtain-explanation"
								/>
							)}
							{error && (
								<p
									className="caseHandoverCurtain__error"
									role="alert"
								>
									{error}
								</p>
							)}
							<div className="caseHandoverCurtain__wizardActions">
								<button
									type="button"
									className="caseHandoverCurtain__navButton"
									onClick={onBack}
									disabled={step === 'reason'}
									aria-label={translate(
										'caseHandover.curtain.back'
									)}
									data-cy="case-handover-curtain-back"
								>
									<IconArrowBack />
								</button>
								<button
									type="button"
									className={clsx(
										'caseHandoverCurtain__navButton',
										'caseHandoverCurtain__navButton--primary'
									)}
									onClick={
										step === 'reason' ? onNext : onSubmit
									}
									disabled={
										step === 'reason'
											? !selectedReason
											: !explanation.trim() ||
												isSubmitting
									}
									aria-label={
										step === 'reason'
											? translate(
													'caseHandover.curtain.next'
												)
											: translate('caseHandover.submit')
									}
									data-cy="case-handover-curtain-next"
								>
									<IconArrowForward />
								</button>
							</div>
						</>
					)}

					{(step === 'pending' ||
						step === 'consentPending' ||
						step === 'denied') && (
						<>
							<div className="caseHandoverCurtain__hero">
								<CaseHandoverIcon
									className="caseHandoverCurtain__heroIcon"
									aria-hidden
								/>
								<h3 className="caseHandoverCurtain__title">
									{step === 'denied'
										? translate('caseHandover.denied.title')
										: translate(
												'caseHandover.pending.title'
											)}
								</h3>
							</div>
							<p className="caseHandoverCurtain__copy">
								{step === 'denied'
									? translate('caseHandover.denied.copy')
									: step === 'consentPending'
										? translate(
												'caseHandover.curtain.consentPending'
											)
										: translate(
												'caseHandover.pending.copy'
											)}
							</p>
						</>
					)}
				</div>
			</div>
		</div>
	);
};

interface CaseHandoverCurtainProps {
	sessionId: number;
	status: CaseHandoverStatus | null;
	onStatusChange: (status: CaseHandoverStatus) => void;
	topicLabel?: string;
}

/** Container: loads reasons, drives the wizard, submits the request. */
export const CaseHandoverCurtain = ({
	sessionId,
	status,
	onStatusChange,
	topicLabel
}: CaseHandoverCurtainProps) => {
	const { t: translate } = useTranslation();
	const [step, setStep] = useState<CaseHandoverCurtainStep>('intro');
	const [reasons, setReasons] = useState<CaseHandoverReason[]>([]);
	const [reasonCode, setReasonCode] = useState('');
	const [explanation, setExplanation] = useState('');
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [error, setError] = useState('');

	useEffect(() => {
		setStep('intro');
		setReasonCode('');
		setExplanation('');
		setError('');
		setIsSubmitting(false);
	}, [sessionId]);

	useEffect(() => {
		apiGetCaseHandoverReasons()
			.then((items) => {
				setReasons(items || []);
				setReasonCode((current) =>
					items?.some((item) => item.code === current) ? current : ''
				);
			})
			.catch(() => {
				setReasons([]);
				setError(translate('caseHandover.error.failed'));
			});
	}, [translate]);

	const derivedStep: CaseHandoverCurtainStep = useMemo(() => {
		if (status?.status === 'PENDING_CLIENT_CONSENT') {
			return 'consentPending';
		}
		if (isCaseHandoverPending(status?.status)) {
			return 'pending';
		}
		if (isCaseHandoverDenied(status?.status)) {
			return 'denied';
		}
		return step;
	}, [status?.status, step]);

	const handleSubmit = () => {
		if (!reasonCode || !explanation.trim() || isSubmitting) {
			setError(translate('caseHandover.error.required'));
			return;
		}
		setIsSubmitting(true);
		setError('');
		apiRequestCaseHandoverAccess(sessionId, reasonCode, explanation)
			.then((nextStatus) => {
				onStatusChange(nextStatus);
			})
			.catch((requestError) => {
				const message =
					requestError?.message === FETCH_ERRORS.FORBIDDEN
						? translate('caseHandover.error.forbidden')
						: translate('caseHandover.error.failed');
				setError(message);
			})
			.finally(() => setIsSubmitting(false));
	};

	return (
		<CaseHandoverCurtainView
			step={derivedStep}
			topicLabel={topicLabel}
			reasons={reasons}
			reasonCode={reasonCode}
			explanation={explanation}
			isSubmitting={isSubmitting}
			error={error}
			onStart={() => setStep('reason')}
			onBack={() => setStep('reason')}
			onNext={() => setStep('describe')}
			onReasonSelect={setReasonCode}
			onExplanationChange={setExplanation}
			onSubmit={handleSubmit}
		/>
	);
};
