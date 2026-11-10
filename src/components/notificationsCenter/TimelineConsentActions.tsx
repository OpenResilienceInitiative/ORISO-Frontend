import * as React from 'react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
	apiDecideCaseHandoverClientConsent,
	apiGetCaseHandoverRequestStatus,
	isPendingCaseHandoverStatus,
	type CaseHandoverStatus
} from '../../api/apiCaseHandover';
import { FETCH_ERRORS, X_REASON } from '../../api/fetchData';

interface DecisionResult {
	status: CaseHandoverStatus | null;
	failed: boolean;
}

export type TimelineConsentDecisions = Map<string, Promise<DecisionResult>>;

interface TimelineConsentActionsProps {
	accountId: string;
	sessionId: number;
	requestId: number;
	pendingDecisions: TimelineConsentDecisions;
	onConfirmed: () => void;
}

const canDecide = (status?: CaseHandoverStatus | null): boolean =>
	status?.status === 'PENDING' ||
	status?.status === 'PENDING_CLIENT_CONSENT' ||
	status?.status === 'GRANTED_PENDING_CLIENT_OPTOUT';

const isClosed = (status?: CaseHandoverStatus | null): boolean =>
	Boolean(status && !isPendingCaseHandoverStatus(status.status));

const exactStatus = (
	status: CaseHandoverStatus,
	sessionId: number,
	requestId: number
): CaseHandoverStatus => {
	if (
		!status?.status ||
		status.sessionId !== sessionId ||
		status.requestId !== requestId
	) {
		throw new Error('Consent status does not match the request');
	}
	return status;
};

const readStatus = (sessionId: number, requestId: number) =>
	apiGetCaseHandoverRequestStatus(sessionId, requestId).then((status) =>
		exactStatus(status, sessionId, requestId)
	);

const decide = async (
	sessionId: number,
	requestId: number,
	approved: boolean
): Promise<DecisionResult> => {
	let status: CaseHandoverStatus | null;
	try {
		status = exactStatus(
			await apiDecideCaseHandoverClientConsent(
				sessionId,
				requestId,
				approved
			),
			sessionId,
			requestId
		);
	} catch (error) {
		if (
			(error as Response)?.headers?.get(FETCH_ERRORS.X_REASON) ===
			X_REASON.CASE_OWNER_CHANGED
		) {
			return {
				status: {
					sessionId,
					requestId,
					status: 'OWNER_CHANGED',
					canViewContent: false,
					clientConsentRequired: true
				},
				failed: false
			};
		}
		// A rejected or lost response can mean the request settled elsewhere.
		status = await readStatus(sessionId, requestId).catch(() => null);
	}
	return { status, failed: !isClosed(status) };
};

/** The Timeline event is history. Its exact current request owns decisions. */
export const TimelineConsentActions = ({
	accountId,
	sessionId,
	requestId,
	pendingDecisions,
	onConfirmed
}: TimelineConsentActionsProps) => {
	const { t: translate } = useTranslation();
	const decisionKey = JSON.stringify([accountId, sessionId, requestId]);
	const [outcome, setOutcome] = useState<DecisionResult | null>(null);
	const [submitting, setSubmitting] = useState(false);
	const generation = useRef(0);
	useLayoutEffect(
		() => () => {
			generation.current += 1;
		},
		[]
	);

	useEffect(() => {
		let current = true;
		// Selection can return to this request while its first decision is
		// still running. Observe that operation instead of reopening actions.
		const operation =
			pendingDecisions.get(decisionKey) ??
			readStatus(sessionId, requestId).then(
				(status) => ({ status, failed: false }),
				() => ({ status: null, failed: false })
			);
		void operation.then((result) => {
			if (current) setOutcome(result);
		});
		return () => {
			current = false;
		};
	}, [decisionKey, pendingDecisions, requestId, sessionId]);

	const handleDecision = (approved: boolean) => {
		if (
			!outcome ||
			!canDecide(outcome.status) ||
			pendingDecisions.has(decisionKey)
		) {
			return;
		}
		const startedIn = generation.current;
		setSubmitting(true);
		setOutcome({ status: outcome.status, failed: false });
		const operation = decide(sessionId, requestId, approved);
		pendingDecisions.set(decisionKey, operation);
		void operation.then((result) => {
			pendingDecisions.delete(decisionKey);
			if (generation.current !== startedIn) return;
			setOutcome(result);
			setSubmitting(false);
			if (!result.failed) onConfirmed();
		});
	};

	const actionable = canDecide(outcome?.status);
	const closed = isClosed(outcome?.status);
	if (!actionable && !closed && !outcome?.failed) return null;

	return (
		<div className="notificationsCenter__consentActions">
			{actionable && (
				<>
					<button
						type="button"
						className="notificationsCenter__consentButton notificationsCenter__consentButton--approve"
						onClick={() => handleDecision(true)}
						disabled={submitting}
					>
						{translate('caseHandover.consent.approve')}
					</button>
					<button
						type="button"
						className="notificationsCenter__consentButton"
						onClick={() => handleDecision(false)}
						disabled={submitting}
					>
						{translate('caseHandover.consent.decline')}
					</button>
				</>
			)}
			{closed && (
				<p className="notificationsCenter__detailText" role="status">
					{translate('caseHandover.consent.info.closed')}
				</p>
			)}
			{outcome?.failed && (
				<p className="notificationsCenter__detailText" role="alert">
					{translate('caseHandover.error.failed')}
				</p>
			)}
		</div>
	);
};
