import * as React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
	apiGetCaseHandoverReasons,
	apiRequestCaseHandoverAccess,
	CaseHandoverReason,
	CaseHandoverStatus,
	FETCH_ERRORS
} from '../../api';
import {
	isCaseHandoverDenied,
	isCaseHandoverPending
} from './caseHandoverHelpers';
import './caseHandoverGate.styles';

interface CaseHandoverGateProps {
	sessionId: number;
	status: CaseHandoverStatus | null;
	onStatusChange: (status: CaseHandoverStatus) => void;
}

export const CaseHandoverGate = ({
	sessionId,
	status,
	onStatusChange
}: CaseHandoverGateProps) => {
	const { t: translate } = useTranslation();
	const [reasons, setReasons] = useState<CaseHandoverReason[]>([]);
	const [reasonCode, setReasonCode] = useState('');
	const [explanation, setExplanation] = useState('');
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [error, setError] = useState('');

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

	const selectedReason = useMemo(
		() => reasons.find((reason) => reason.code === reasonCode),
		[reasonCode, reasons]
	);

	const isPending = isCaseHandoverPending(status?.status);
	const isDenied = isCaseHandoverDenied(status?.status);
	const canSubmit =
		Boolean(reasonCode) && explanation.trim().length > 0 && !isSubmitting;

	const handleSubmit = () => {
		if (!canSubmit) {
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
		<div className="caseHandoverGate" data-cy="case-handover-gate">
			<div className="caseHandoverGate__shell">
				<div className="caseHandoverGate__header">
					<div className="caseHandoverGate__icon" aria-hidden>
						↕
					</div>
					<div>
						<h2 className="caseHandoverGate__title">
							{translate('caseHandover.hidden.title')}
						</h2>
						<p className="caseHandoverGate__copy">
							{isPending
								? translate('caseHandover.pending.copy')
								: isDenied
									? translate('caseHandover.denied.copy')
									: translate('caseHandover.copy')}
						</p>
					</div>
				</div>

				<div className="caseHandoverGate__statusRow">
					<span className="caseHandoverGate__statusBadge">
						{isPending
							? translate('caseHandover.list.awaitingApproval')
							: isDenied
								? translate('caseHandover.list.accessDenied')
								: translate('caseHandover.list.requestAccess')}
					</span>
					<span className="caseHandoverGate__policy">
						{status?.policyAuthority ||
							selectedReason?.policyAuthority ||
							translate('caseHandover.policy.defaultAuthority')}
					</span>
				</div>

				{!isPending && (
					<>
						<div
							className="caseHandoverGate__reasons"
							role="radiogroup"
							aria-label={translate('caseHandover.hidden.title')}
						>
							{reasons.map((reason) => (
								<label
									key={reason.code}
									className="caseHandoverGate__reason"
								>
									<input
										type="radio"
										name="case-handover-reason"
										value={reason.code}
										checked={reasonCode === reason.code}
										onChange={() =>
											setReasonCode(reason.code)
										}
									/>
									<span>{reason.label}</span>
									{reason.clientConsentRequired && (
										<small>
											{translate(
												'caseHandover.policy.clientConsentRequired'
											)}
										</small>
									)}
								</label>
							))}
						</div>
						<textarea
							className="caseHandoverGate__explanation"
							value={explanation}
							onChange={(event) =>
								setExplanation(event.target.value)
							}
							placeholder={translate(
								'caseHandover.explanation.placeholder'
							)}
							aria-label={translate(
								'caseHandover.explanation.placeholder'
							)}
						/>
						<button
							type="button"
							className="caseHandoverGate__submit"
							onClick={handleSubmit}
							disabled={!canSubmit}
						>
							{isSubmitting
								? translate('caseHandover.submitSending')
								: translate('caseHandover.submit')}
						</button>
					</>
				)}

				{error && <p className="caseHandoverGate__error">{error}</p>}
			</div>
		</div>
	);
};
