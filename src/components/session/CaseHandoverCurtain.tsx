import * as React from 'react';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
	apiGetCaseHandoverStatus,
	apiReclaimCaseHandover,
	apiRequestCaseHandoverAccess,
	CaseHandoverReason,
	CaseHandoverStatus
} from '../../api/apiCaseHandover';
import { FETCH_ERRORS } from '../../api/fetchData';
import { CaseHandoverReasonList } from '../caseHandover/CaseHandoverReasonList';
import { OrisoTextarea } from '../form/OrisoTextarea';
import {
	isCaseHandoverDenied,
	isCaseHandoverPending
} from './caseHandoverHelpers';
import { ReactComponent as CaseHandoverIcon } from '../../resources/img/icons/case-handover/case-handover-wizard.svg';
import { ReactComponent as TutorialIcon } from '../../resources/img/icons/case-handover/tutorial.svg';
import { ReactComponent as EyeClosedIcon } from '../../resources/img/icons/eye-closed.svg';
import './caseHandoverCurtain.styles';
import { ScrollableSection } from '../scrollableSection/ScrollableSection';
import { ScrollableSectionHeader } from '../scrollableSection/ScrollableSectionHeader';
import { ScrollableSectionBody } from '../scrollableSection/ScrollableSectionBody';
import { ScrollableSectionFooter } from '../scrollableSection/ScrollableSectionFooter';
import { SideScrollerFooter } from '../sideScrollerFooter/SideScrollerFooter';
import { ButtonGroup } from '../buttonGroup/ButtonGroup';
import { useCaseHandoverReasons } from '../caseHandover/useCaseHandoverReasons';
import { SessionTopic } from '../sessionHeader/SessionTopic';
import {
	activateCaseHandoverActor,
	clearCaseHandoverOperation,
	clearCaseHandoverOperationIfMatches,
	getCaseHandoverOperation,
	getOrCreateCaseHandoverOperation
} from '../caseHandover/caseHandoverOperationStore';

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
	<EyeClosedIcon width={22} height={22} fill="currentColor" aria-hidden />
);

export interface CaseHandoverCurtainViewProps {
	step: CaseHandoverCurtainStep;
	topicLabel?: string;
	reasons: CaseHandoverReason[];
	reasonCode: string;
	explanation: string;
	isSubmitting?: boolean;
	error?: string;
	/** Reasons finished loading and none came back (FE#1725 US26). */
	reasonsUnavailable?: boolean;
	/** Loading the reasons failed; offers `onRetryReasons`. */
	reasonsLoadFailed?: boolean;
	onRetryReasons?: () => void;
	onStart: () => void;
	onBack: () => void;
	onNext: () => void;
	onReasonSelect: (code: string) => void;
	onExplanationChange: (value: string) => void;
	onSubmit: () => void;
	/** The viewer is the counsellor a takeover moved this case away from. */
	canReclaim?: boolean;
	onReclaim?: () => void;
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
	reasonsUnavailable = false,
	reasonsLoadFailed = false,
	onRetryReasons,
	onStart,
	onBack,
	onNext,
	onReasonSelect,
	onExplanationChange,
	onSubmit,
	canReclaim = false,
	onReclaim
}: CaseHandoverCurtainViewProps) => {
	const { t: translate } = useTranslation();
	const selectedReason = useMemo(
		() => reasons.find((reason) => reason.code === reasonCode),
		[reasons, reasonCode]
	);
	// No reasons: say so instead of offering a Next that can never enable.
	const reasonsFailed = step === 'reason' && reasonsLoadFailed;
	const noReasons =
		step === 'reason' && (reasonsUnavailable || reasonsLoadFailed);

	return (
		<div className="caseHandoverCurtain" data-cy="case-handover-curtain">
			<div className="caseHandoverCurtain__card">
				<ScrollableSection bodyKey={step}>
					<ScrollableSectionHeader>
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
							<div className="sessionInfo__metaInfo">
								<SessionTopic name={topicLabel} />
							</div>
						)}
					</ScrollableSectionHeader>
					<ScrollableSectionBody>
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
									{canReclaim ? (
										<>
											<p className="caseHandoverCurtain__copy">
												{translate(
													'caseHandover.curtain.reclaim.copy'
												)}
											</p>
											{error && (
												<p
													className="caseHandoverCurtain__error"
													role="alert"
												>
													{error}
												</p>
											)}
											<div className="caseHandoverCurtain__introActions">
												<button
													type="button"
													className="caseHandoverCurtain__stepByStep"
													onClick={onReclaim}
													disabled={isSubmitting}
													data-cy="case-handover-curtain-reclaim"
												>
													{translate(
														'caseHandover.curtain.reclaim.cta'
													)}
												</button>
											</div>
										</>
									) : (
										<>
											<p className="caseHandoverCurtain__copy">
												{translate(
													'caseHandover.curtain.intro.copy'
												)}
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
									{reasonsFailed && (
										<div
											className="caseHandoverCurtain__loadFailed"
											role="alert"
											data-cy="case-handover-curtain-reasons-failed"
										>
											<p className="caseHandoverCurtain__empty">
												{translate(
													'caseHandover.curtain.reason.loadFailed'
												)}
											</p>
											{onRetryReasons && (
												<ButtonGroup
													variant="outline"
													items={[
														{
															label: translate(
																'caseHandover.curtain.reason.retry'
															),
															onClick:
																onRetryReasons,
															testingAttribute:
																'case-handover-curtain-reasons-retry'
														}
													]}
												/>
											)}
										</div>
									)}
									{noReasons && !reasonsFailed && (
										<p
											className="caseHandoverCurtain__empty"
											role="status"
											data-cy="case-handover-curtain-no-reasons"
										>
											{translate(
												'caseHandover.curtain.reason.empty'
											)}
										</p>
									)}
									<CaseHandoverReasonList
										reasons={reasons}
										reasonCode={reasonCode}
										interactive={step === 'reason'}
										onReasonSelect={onReasonSelect}
									/>
									{step === 'describe' && (
										<OrisoTextarea
											className="caseHandoverCurtain__explanation"
											value={explanation}
											onChange={(event) =>
												onExplanationChange(
													event.target.value
												)
											}
											placeholder={translate(
												'caseHandover.explanation.placeholder'
											)}
											minRows={4}
											fullWidth
											inputProps={{
												'data-cy':
													'case-handover-curtain-explanation'
											}}
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
												? translate(
														'caseHandover.denied.title'
													)
												: translate(
														'caseHandover.pending.title'
													)}
										</h3>
									</div>
									<p className="caseHandoverCurtain__copy">
										{step === 'denied'
											? translate(
													'caseHandover.denied.copy'
												)
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
					</ScrollableSectionBody>
					<ScrollableSectionFooter>
						{(step === 'reason' || step === 'describe') &&
							!noReasons && (
								<SideScrollerFooter
									variant="wizard"
									back={{
										label: translate(
											'caseHandover.curtain.back'
										),
										onClick: onBack,
										disabled: step === 'reason',
										dataCy: 'case-handover-curtain-back'
									}}
									next={{
										label:
											step === 'reason'
												? translate(
														'caseHandover.curtain.next'
													)
												: translate(
														'caseHandover.submit'
													),
										onClick:
											step === 'reason'
												? onNext
												: onSubmit,
										disabled:
											step === 'reason'
												? !selectedReason
												: !explanation.trim() ||
													isSubmitting,
										dataCy: 'case-handover-curtain-next'
									}}
								/>
							)}
					</ScrollableSectionFooter>
				</ScrollableSection>
			</div>
		</div>
	);
};

interface CaseHandoverCurtainProps {
	actorId: string;
	sessionId: number;
	status: CaseHandoverStatus | null;
	onStatusChange: (status: CaseHandoverStatus) => void;
	topicLabel?: string;
}

/** Container: loads reasons, drives the wizard, submits the request. */
export const CaseHandoverCurtain = ({
	actorId,
	sessionId,
	status,
	onStatusChange,
	topicLabel
}: CaseHandoverCurtainProps) => {
	const { t: translate } = useTranslation();
	const [step, setStep] = useState<CaseHandoverCurtainStep>('intro');
	const {
		reasons,
		loaded: reasonsLoaded,
		unavailable: reasonsUnavailable,
		failed: reasonsLoadFailed,
		retry: retryReasons
	} = useCaseHandoverReasons();
	const [reasonCode, setReasonCode] = useState('');
	const [explanation, setExplanation] = useState('');
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [error, setError] = useState('');
	const activeRequestRef = useRef<object | null>(null);

	useEffect(() => activateCaseHandoverActor(actorId), [actorId]);

	useLayoutEffect(() => {
		activeRequestRef.current = null;

		return () => {
			activeRequestRef.current = null;
		};
	}, [actorId, sessionId]);

	useEffect(() => {
		const retained = getCaseHandoverOperation({
			actorId,
			sessionId,
			kind: 'PULL'
		});
		setStep(retained ? 'describe' : 'intro');
		setReasonCode(retained?.reasonCode || '');
		setExplanation(retained?.explanation || '');
		setError('');
		setIsSubmitting(false);
	}, [actorId, sessionId]);

	// A retained reason that is no longer offered is dropped.
	useEffect(() => {
		if (!reasonsLoaded) return;
		setReasonCode((current) =>
			reasons.some((item) => item.code === current) ? current : ''
		);
	}, [reasons, reasonsLoaded]);

	const canReclaim = status?.canReclaim === true;

	const derivedStep: CaseHandoverCurtainStep = useMemo(() => {
		// An own request from before the reclaim action existed must not hide it.
		if (canReclaim) {
			return 'intro';
		}
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
	}, [canReclaim, status?.status, step]);

	const handleReclaim = () => {
		setIsSubmitting(true);
		setError('');
		apiReclaimCaseHandover(sessionId)
			.then(onStatusChange)
			.catch((reclaimError) => {
				setError(
					reclaimError?.message === FETCH_ERRORS.CONFLICT
						? translate('caseHandover.curtain.reclaim.unavailable')
						: reclaimError?.message === FETCH_ERRORS.FORBIDDEN
							? translate('caseHandover.error.forbidden')
							: translate('caseHandover.error.failed')
				);
			})
			.finally(() => setIsSubmitting(false));
	};

	const handleSubmit = () => {
		if (!reasonCode || !explanation.trim() || isSubmitting) {
			setError(translate('caseHandover.error.required'));
			return;
		}
		if (typeof status?.ownershipRevision !== 'number') {
			setError(translate('caseHandover.error.failed'));
			return;
		}
		setIsSubmitting(true);
		setError('');
		const requestIdentity = {};
		const requestSessionId = sessionId;
		const operation = getOrCreateCaseHandoverOperation({
			actorId,
			sessionId: requestSessionId,
			kind: 'PULL',
			expectedOwnershipRevision: status.ownershipRevision,
			reasonCode,
			explanation
		});
		activeRequestRef.current = requestIdentity;
		const isCurrentRequest = () =>
			activeRequestRef.current === requestIdentity;

		apiRequestCaseHandoverAccess(
			requestSessionId,
			reasonCode,
			explanation,
			operation.expectedOwnershipRevision,
			operation.operationId
		)
			.then((nextStatus) => {
				if (!isCurrentRequest()) {
					return;
				}
				if (nextStatus.sessionId !== requestSessionId) {
					setError(translate('caseHandover.error.failed'));
					return;
				}
				onStatusChange(nextStatus);
				clearCaseHandoverOperation(operation);
			})
			.catch(async (requestError) => {
				if (!isCurrentRequest()) {
					return;
				}
				if (requestError?.message === FETCH_ERRORS.CONFLICT) {
					try {
						const refreshed =
							await apiGetCaseHandoverStatus(requestSessionId);
						if (isCurrentRequest()) {
							onStatusChange(refreshed);
						}
					} catch {
						// Keep the original conflict visible when refresh fails.
					}
					if (isCurrentRequest()) {
						clearCaseHandoverOperationIfMatches(
							operation,
							operation.operationId
						);
					}
				}
				if (!isCurrentRequest()) {
					return;
				}
				const message =
					requestError?.message === FETCH_ERRORS.FORBIDDEN
						? translate('caseHandover.error.forbidden')
						: translate('caseHandover.error.failed');
				setError(message);
			})
			.finally(() => {
				if (!isCurrentRequest()) {
					return;
				}
				activeRequestRef.current = null;
				setIsSubmitting(false);
			});
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
			reasonsUnavailable={reasonsUnavailable}
			reasonsLoadFailed={reasonsLoadFailed}
			onRetryReasons={retryReasons}
			onStart={() => setStep('reason')}
			onBack={() => setStep('reason')}
			onNext={() => setStep('describe')}
			onReasonSelect={setReasonCode}
			onExplanationChange={setExplanation}
			onSubmit={handleSubmit}
			canReclaim={canReclaim}
			onReclaim={handleReclaim}
		/>
	);
};
