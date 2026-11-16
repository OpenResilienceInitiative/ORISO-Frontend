import {
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState
} from 'react';
import { useTranslation } from 'react-i18next';
import { ActiveSessionContext, UserDataContext } from '../../globalState';
import {
	apiCreateCaseHandoverOffer,
	apiGetCaseHandoverReasons,
	apiGetCaseHandoverRecipients,
	apiGetCaseHandoverRequestStatus,
	apiGetCaseHandoverStatus,
	apiWithdrawCaseHandoverOffer,
	CaseHandoverReason,
	CaseHandoverStatus
} from '../../api/apiCaseHandover';
import { FETCH_ERRORS } from '../../api/fetchData';
import { SupervisorDialogPerson } from '../supervisorDialog/SupervisorDialog';
import { useCaseHandoverResolutionEvents } from './useCaseHandoverResolutionEvents';
import {
	activateCaseHandoverActor,
	clearCaseHandoverOperation,
	getCaseHandoverOperation,
	getOrCreateCaseHandoverOperation,
	recordCaseHandoverOperationStatus
} from './caseHandoverOperationStore';

// For the counsellors an opt-out grant is already in effect; only the advice
// seeker can still object.
export const isGrantedCaseHandoverStatus = (status?: string) =>
	status === 'GRANTED' || status === 'GRANTED_PENDING_CLIENT_OPTOUT';

// The server rejects co-access ("advice") reasons and reasons without access for offers (403).
const ADVICE_REASON_CODES = ['ADVICE_REQUESTED', 'COUNSELLOR_ASKED_FOR_ADVICE'];
export const isOfferableReason = (reason: CaseHandoverReason) =>
	!ADVICE_REASON_CODES.includes(reason.code) &&
	reason.accessAllowed !== false;

const terminalOfferStatus = (status: string) =>
	isGrantedCaseHandoverStatus(status) ||
	status === 'RECIPIENT_DECLINED' ||
	status === 'DENIED' ||
	status === 'CLIENT_CONSENT_DECLINED' ||
	status === 'WITHDRAWN';

// The two states in which the offering counsellor can still take the offer back.
export const isWithdrawableOfferStatus = (status: string) =>
	status === 'PENDING_RECIPIENT_ACCEPTANCE' ||
	status === 'PENDING_CLIENT_CONSENT';

/**
 * The owner's "Beratung übergeben" offer for the active session: load the
 * form, submit a guarded offer, follow its status and withdraw it.
 *
 * Shared by the profile button (`AskerInfoAssign`) and the chat-room menu
 * (`SessionMenu`, FE#2250) so both open the same dialog and both show an
 * offer that is already pending instead of a second offer form.
 */
export const useCaseHandoverOffer = () => {
	const { t: translate } = useTranslation();
	const { activeSession, reloadActiveSession } =
		useContext(ActiveSessionContext);
	const { userData } = useContext(UserDataContext);
	const [open, setOpen] = useState(false);
	const [loading, setLoading] = useState(false);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState('');
	const [status, setStatus] = useState<CaseHandoverStatus>();
	const [offerStatus, setOfferStatus] = useState<CaseHandoverStatus>();
	const [candidates, setCandidates] = useState<SupervisorDialogPerson[]>([]);
	const [reasons, setReasons] = useState<CaseHandoverReason[]>([]);
	const [selectedId, setSelectedId] = useState('');
	const [reasonCode, setReasonCode] = useState('');
	const generationRef = useRef(0);
	const sequenceRef = useRef(0);
	const submittingRef = useRef(false);
	const withdrawSequenceRef = useRef(0);
	const sessionId = activeSession?.item.id;
	const actorId = userData?.userId;
	const identity = useMemo(
		() =>
			sessionId && actorId
				? { actorId, sessionId, kind: 'PUSH' as const }
				: null,
		[actorId, sessionId]
	);

	useEffect(() => {
		if (actorId) activateCaseHandoverActor(actorId);
	}, [actorId]);

	const applyOfferStatus = useCallback(
		(nextStatus: CaseHandoverStatus, expectedRequestId?: number) => {
			if (nextStatus.sessionId !== sessionId) return;
			if (
				expectedRequestId !== undefined &&
				nextStatus.requestId !== expectedRequestId
			) {
				return;
			}
			setOfferStatus(nextStatus);
			if (terminalOfferStatus(nextStatus.status) && identity) {
				clearCaseHandoverOperation(identity);
				if (isGrantedCaseHandoverStatus(nextStatus.status))
					reloadActiveSession?.();
			}
		},
		[identity, reloadActiveSession, sessionId]
	);

	const loadForm = useCallback(async () => {
		if (!sessionId || !actorId) return;
		const generation = generationRef.current;
		const sequence = ++sequenceRef.current;
		setLoading(true);
		setError('');
		try {
			const [nextStatus, people, nextReasons] = await Promise.all([
				apiGetCaseHandoverStatus(sessionId),
				apiGetCaseHandoverRecipients(sessionId),
				apiGetCaseHandoverReasons()
			]);
			if (
				generation !== generationRef.current ||
				sequence !== sequenceRef.current
			)
				return;
			if (
				nextStatus.sessionId !== sessionId ||
				typeof nextStatus.ownershipRevision !== 'number'
			)
				throw new Error('INVALID_CASE_HANDOVER_STATUS');
			setStatus(nextStatus);
			// An offer made before a reload (or on another device) is still open:
			// show it, with its withdraw button, instead of a second offer form
			// the server would refuse with 409.
			if (nextStatus.openOffer?.requestId) {
				setOfferStatus(nextStatus.openOffer);
			}
			// The server already dropped everyone the offer would reject —
			// other departments, other tenants, absentees, previous owners and
			// the owner themselves (FE #1262). Do not re-filter here: a second
			// rule in the client would drift from the one that decides.
			setCandidates(
				(people || []).map((person) => ({
					id: person.consultantId,
					name: person.displayName || person.consultantId
				}))
			);
			setReasons(nextReasons || []);
			setReasonCode((selectedReason) =>
				nextReasons?.some(
					(reason) =>
						reason.code === selectedReason &&
						isOfferableReason(reason)
				)
					? selectedReason
					: ''
			);
		} catch (loadError) {
			if (
				generation === generationRef.current &&
				sequence === sequenceRef.current
			) {
				setError(
					loadError instanceof Error &&
						loadError.message === FETCH_ERRORS.FORBIDDEN
						? translate('caseHandover.offer.loadForbidden')
						: translate('caseHandover.offer.loadError')
				);
			}
		} finally {
			if (
				generation === generationRef.current &&
				sequence === sequenceRef.current
			)
				setLoading(false);
		}
	}, [actorId, sessionId, translate]);

	const handleOpen = () => {
		generationRef.current += 1;
		sequenceRef.current = 0;
		submittingRef.current = false;
		setBusy(false);
		setOpen(true);
		setError('');
		setStatus(undefined);
		setOfferStatus(undefined);
		if (identity) {
			const retained = getCaseHandoverOperation(identity);
			if (retained?.status) {
				// Provisional only: nothing tracked the offer while the dialog
				// was closed, so the colleague may have answered meanwhile.
				setOfferStatus(retained.status);
				setSelectedId(retained.targetConsultantId || '');
				setReasonCode(retained.reasonCode);
				const retainedRequestId = retained.status.requestId;
				if (
					retainedRequestId &&
					!terminalOfferStatus(retained.status.status)
				)
					void refreshOfferStatus(retainedRequestId);
				return;
			}
			if (retained) {
				setSelectedId(retained.targetConsultantId || '');
				setReasonCode(retained.reasonCode);
			} else {
				setSelectedId('');
				setReasonCode('');
			}
		} else {
			setSelectedId('');
			setReasonCode('');
		}
		void loadForm();
	};

	const handleClose = () => {
		generationRef.current += 1;
		sequenceRef.current = 0;
		submittingRef.current = false;
		setBusy(false);
		setError('');
		setOpen(false);
	};

	const refreshOfferStatus = useCallback(
		async (requestId: number) => {
			// A withdrawal in flight owns the offer state until it answers.
			if (!sessionId || submittingRef.current) return;
			const generation = generationRef.current;
			const sequence = ++sequenceRef.current;
			try {
				const nextStatus = await apiGetCaseHandoverRequestStatus(
					sessionId,
					requestId
				);
				if (
					generation === generationRef.current &&
					sequence === sequenceRef.current
				) {
					applyOfferStatus(nextStatus, requestId);
				}
			} catch {
				// The retained request remains retryable on the next event or focus.
			}
		},
		[applyOfferStatus, sessionId]
	);

	useEffect(() => {
		const requestId = offerStatus?.requestId;
		if (
			!open ||
			!sessionId ||
			!requestId ||
			terminalOfferStatus(offerStatus.status)
		)
			return;
		const refresh = () => void refreshOfferStatus(requestId);
		window.addEventListener('focus', refresh);
		return () => window.removeEventListener('focus', refresh);
	}, [offerStatus, open, refreshOfferStatus, sessionId]);

	const pendingOfferRequestId =
		open && offerStatus && !terminalOfferStatus(offerStatus.status)
			? offerStatus.requestId
			: undefined;
	const handleResolutionEvent = useCallback(() => {
		if (pendingOfferRequestId)
			void refreshOfferStatus(pendingOfferRequestId);
	}, [pendingOfferRequestId, refreshOfferStatus]);
	useCaseHandoverResolutionEvents({
		actorId,
		sessionId,
		requestId: pendingOfferRequestId,
		enabled: Boolean(pendingOfferRequestId),
		onResolution: handleResolutionEvent
	});

	// The hosts (SessionMenu, AskerInfoAssign) keep this hook across session
	// and actor changes, so drop everything the old session owned: an open
	// dialog must never submit session B with session A's revision or
	// recipient, and a submit cut off by the change must not leave the
	// dialog stuck as busy.
	useEffect(() => {
		setOpen(false);
		setLoading(false);
		setBusy(false);
		setError('');
		setStatus(undefined);
		setOfferStatus(undefined);
		setCandidates([]);
		setSelectedId('');
		setReasonCode('');
		submittingRef.current = false;
		return () => {
			generationRef.current += 1;
		};
	}, [actorId, sessionId]);

	const submitOffer = async () => {
		if (
			submittingRef.current ||
			!identity ||
			!selectedId ||
			!reasonCode ||
			typeof status?.ownershipRevision !== 'number'
		)
			return;
		const generation = generationRef.current;
		const sequence = ++sequenceRef.current;
		const operation = getOrCreateCaseHandoverOperation({
			...identity,
			expectedOwnershipRevision: status.ownershipRevision,
			reasonCode,
			explanation: '',
			targetConsultantId: selectedId
		});
		submittingRef.current = true;
		setBusy(true);
		setError('');
		try {
			const response = await apiCreateCaseHandoverOffer(sessionId, {
				targetConsultantId: selectedId,
				reasonCode,
				expectedOwnershipRevision: operation.expectedOwnershipRevision,
				operationId: operation.operationId
			});
			if (
				generation === generationRef.current &&
				sequence === sequenceRef.current
			) {
				recordCaseHandoverOperationStatus(
					identity,
					operation.operationId,
					response
				);
				applyOfferStatus(response);
			}
		} catch (submissionError) {
			if (
				generation === generationRef.current &&
				sequence === sequenceRef.current
			) {
				if (
					submissionError instanceof Error &&
					submissionError.message === FETCH_ERRORS.CONFLICT
				) {
					clearCaseHandoverOperation(identity);
					setStatus(undefined);
					submittingRef.current = false;
					setBusy(false);
					await loadForm();
					// The dialog may have been closed or reopened during the reload.
					if (generation === generationRef.current)
						setError(translate('caseHandover.offer.conflict'));
					return;
				}
				setError(translate('caseHandover.offer.submitError'));
			}
		} finally {
			if (
				generation === generationRef.current &&
				sequence === sequenceRef.current
			) {
				submittingRef.current = false;
				setBusy(false);
			}
		}
	};

	const withdrawOffer = async () => {
		const requestId = offerStatus?.requestId;
		if (!sessionId || !requestId || submittingRef.current) return;
		const generation = generationRef.current;
		const withdrawSequence = ++withdrawSequenceRef.current;
		submittingRef.current = true;
		setBusy(true);
		setError('');
		try {
			const response = await apiWithdrawCaseHandoverOffer(
				sessionId,
				requestId
			);
			if (
				generation === generationRef.current &&
				withdrawSequence === withdrawSequenceRef.current
			) {
				// Drop refreshes started before the answer; the response is newer.
				sequenceRef.current += 1;
				applyOfferStatus(
					{ ...response, requestId: response.requestId ?? requestId },
					requestId
				);
			}
		} catch (withdrawError) {
			if (
				generation === generationRef.current &&
				withdrawSequence === withdrawSequenceRef.current
			) {
				if (
					withdrawError instanceof Error &&
					withdrawError.message === FETCH_ERRORS.CONFLICT
				) {
					// The colleague answered first: say so and show how it ended.
					setError(translate('caseHandover.offer.withdrawConflict'));
					submittingRef.current = false;
					setBusy(false);
					await refreshOfferStatus(requestId);
					return;
				}
				setError(translate('caseHandover.offer.withdrawError'));
			}
		} finally {
			if (
				generation === generationRef.current &&
				withdrawSequence === withdrawSequenceRef.current
			) {
				submittingRef.current = false;
				setBusy(false);
			}
		}
	};

	return {
		open,
		loading,
		busy,
		error,
		status,
		offerStatus,
		candidates,
		reasons,
		selectedId,
		reasonCode,
		setSelectedId,
		setReasonCode,
		handleOpen,
		handleClose,
		loadForm,
		submitOffer,
		withdrawOffer
	};
};

export type CaseHandoverOfferState = ReturnType<typeof useCaseHandoverOffer>;
