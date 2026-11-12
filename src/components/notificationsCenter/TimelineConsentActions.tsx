import * as React from 'react';
import {
	useCallback,
	useEffect,
	useLayoutEffect,
	useRef,
	useState
} from 'react';
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
	failure?: 'read' | 'decision';
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
): CaseHandoverStatus | null =>
	status?.status &&
	status.sessionId === sessionId &&
	status.requestId === requestId
		? status
		: null;

const quietReadErrors: readonly string[] = [
	FETCH_ERRORS.FORBIDDEN,
	FETCH_ERRORS.NO_MATCH,
	FETCH_ERRORS.UNAUTHORIZED,
	FETCH_ERRORS.ABORT
];

const readOutcome = async (
	sessionId: number,
	requestId: number
): Promise<DecisionResult> => {
	try {
		return {
			status: exactStatus(
				await apiGetCaseHandoverRequestStatus(sessionId, requestId),
				sessionId,
				requestId
			)
		};
	} catch (error) {
		return error instanceof Error && quietReadErrors.includes(error.message)
			? { status: null }
			: { status: null, failure: 'read' };
	}
};

const decisionOutcome = (status: CaseHandoverStatus | null): DecisionResult =>
	isClosed(status) ? { status } : { status, failure: 'decision' };

const decide = async (
	sessionId: number,
	requestId: number,
	approved: boolean
): Promise<DecisionResult> => {
	try {
		const status = exactStatus(
			await apiDecideCaseHandoverClientConsent(
				sessionId,
				requestId,
				approved
			),
			sessionId,
			requestId
		);
		if (status) return decisionOutcome(status);
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
				}
			};
		}
	}

	// A rejected or lost response can mean the request settled elsewhere.
	const result = await readOutcome(sessionId, requestId);
	return result.failure === 'read' ? result : decisionOutcome(result.status);
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
	const confirmed = useRef(onConfirmed);

	useLayoutEffect(() => {
		confirmed.current = onConfirmed;
	}, [onConfirmed]);

	useLayoutEffect(
		() => () => {
			generation.current += 1;
		},
		[decisionKey]
	);

	const loadStatus = useCallback(() => {
		const startedIn = ++generation.current;
		setOutcome(null);
		void readOutcome(sessionId, requestId).then((result) => {
			if (generation.current === startedIn) setOutcome(result);
		});
	}, [requestId, sessionId]);

	const observeDecision = useCallback(
		(operation: Promise<DecisionResult>) => {
			const startedIn = generation.current;
			void operation.then((result) => {
				if (generation.current !== startedIn) return;
				setOutcome(result);
				setSubmitting(false);
				if (isClosed(result.status)) confirmed.current();
			});
		},
		[]
	);

	useEffect(() => {
		// A reselected event can still share the original decision.
		const pending = pendingDecisions.get(decisionKey);
		if (pending) observeDecision(pending);
		else loadStatus();
	}, [decisionKey, loadStatus, observeDecision, pendingDecisions]);

	const handleDecision = (approved: boolean) => {
		if (
			!outcome ||
			!canDecide(outcome.status) ||
			pendingDecisions.has(decisionKey)
		) {
			return;
		}
		setSubmitting(true);
		setOutcome({ status: outcome.status });
		const operation = decide(sessionId, requestId, approved);
		pendingDecisions.set(decisionKey, operation);
		void operation.then(() => pendingDecisions.delete(decisionKey));
		observeDecision(operation);
	};

	const actionable = canDecide(outcome?.status);
	const closed = isClosed(outcome?.status);
	if (outcome && !actionable && !closed && !outcome.failure) return null;

	return (
		<div className="notificationsCenter__consentActions">
			{!outcome && (
				<p className="notificationsCenter__detailText" role="status">
					{translate('app.wait')}
				</p>
			)}
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
			{outcome?.failure === 'read' && (
				<>
					<p className="notificationsCenter__detailText" role="alert">
						{translate('caseHandover.offer.generic')}
					</p>
					<button
						type="button"
						className="notificationsCenter__consentButton"
						onClick={loadStatus}
					>
						{translate('caseHandover.offer.retry')}
					</button>
				</>
			)}
			{outcome?.failure === 'decision' && (
				<p className="notificationsCenter__detailText" role="alert">
					{translate('caseHandover.error.failed')}
				</p>
			)}
		</div>
	);
};
