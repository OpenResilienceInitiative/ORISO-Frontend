import * as React from 'react';
import {
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState
} from 'react';
import {
	ActiveSessionContext,
	UserDataContext,
	hasUserAuthority,
	AUTHORITIES
} from '../../globalState';
import {
	apiCreateCaseHandoverOffer,
	apiGetCaseHandoverReasons,
	apiGetCaseHandoverRecipients,
	apiGetCaseHandoverRequestStatus,
	apiGetCaseHandoverStatus,
	CaseHandoverReason,
	CaseHandoverStatus
} from '../../api/apiCaseHandover';
import { FETCH_ERRORS } from '../../api/fetchData';
import { RequestSessionAssign } from '../sessionAssign/RequestSessionAssign';
import { Text } from '../text/Text';
import { useTranslation } from 'react-i18next';
import { BUTTON_TYPES, Button } from '../button/Button';
import {
	SupervisorDialog,
	SupervisorDialogCopy,
	SupervisorDialogPerson
} from '../supervisorDialog/SupervisorDialog';
import { useCaseHandoverResolutionEvents } from '../caseHandover/useCaseHandoverResolutionEvents';
import {
	activateCaseHandoverActor,
	clearCaseHandoverOperation,
	getCaseHandoverOperation,
	getOrCreateCaseHandoverOperation,
	recordCaseHandoverOperationStatus
} from '../caseHandover/caseHandoverOperationStore';

interface AskerInfoAssignProps {
	title?: string | null;
	showLegacyAssignment?: boolean;
	handoverEnabled?: boolean;
}

const terminalOfferStatus = (status: string) =>
	status === 'GRANTED' ||
	status === 'RECIPIENT_DECLINED' ||
	status === 'DENIED' ||
	status === 'CLIENT_CONSENT_DECLINED';

export const AskerInfoAssign = ({
	title = 'userProfile.reassign.title',
	showLegacyAssignment = true,
	handoverEnabled = false
}: AskerInfoAssignProps) => {
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
				if (nextStatus.status === 'GRANTED') reloadActiveSession?.();
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
				setOfferStatus(retained.status);
				return;
			}
			if (retained) {
				setSelectedId(retained.targetConsultantId || '');
				setReasonCode(retained.reasonCode);
			}
		}
		void loadForm();
	};

	const handleClose = () => {
		generationRef.current += 1;
		sequenceRef.current = 0;
		submittingRef.current = false;
		setBusy(false);
		setOpen(false);
	};

	const refreshOfferStatus = useCallback(
		async (requestId: number) => {
			if (!sessionId) return;
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

	useEffect(
		() => () => {
			generationRef.current += 1;
		},
		[actorId, sessionId]
	);

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
					submittingRef.current = false;
					setBusy(false);
					await loadForm();
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

	const copy = buildDialogCopy(translate);
	const showLegacy =
		showLegacyAssignment &&
		hasUserAuthority(AUTHORITIES.CONSULTANT_DEFAULT, userData);
	if (!showLegacy && !handoverEnabled) return null;

	return (
		<>
			<Text text={title && translate(title)} type="divider" />
			{showLegacy && (
				<>
					<Text
						className="asker-info-assign__description"
						text={translate('userProfile.reassign.description')}
						type="infoSmall"
					/>
					<RequestSessionAssign
						value={activeSession.consultant?.id || null}
					/>
				</>
			)}
			{handoverEnabled && (
				<Button
					item={{
						label: 'caseHandover.offer.open',
						type: BUTTON_TYPES.SECONDARY
					}}
					buttonHandle={handleOpen}
					disabled={loading}
				/>
			)}
			{error && <p role="alert">{error}</p>}
			{open && error && !loading && !status && (
				<Button
					item={{
						label: 'caseHandover.offer.retry',
						type: BUTTON_TYPES.PRIMARY
					}}
					buttonHandle={() => void loadForm()}
				/>
			)}
			{open && !loading && status && !offerStatus && (
				<SupervisorDialog
					mode="handover"
					copy={copy}
					candidates={candidates}
					reasons={reasons.map((reason) => ({
						code: reason.code,
						label: reason.label
					}))}
					selectedId={selectedId}
					reason={reasonCode}
					busy={busy}
					onSelect={setSelectedId}
					onReasonChange={setReasonCode}
					onConfirm={() => void submitOffer()}
					onClose={handleClose}
				/>
			)}
			{open && offerStatus && (
				<p role="status">
					{translate(
						`caseHandover.offer.status.${offerStatus.status}`
					)}
				</p>
			)}
		</>
	);
};

const buildDialogCopy = (
	translate: (key: string) => string
): SupervisorDialogCopy => ({
	title: {
		add: translate('supervisorDialog.title.add'),
		change: translate('supervisorDialog.title.change'),
		handover: translate('supervisorDialog.title.handover')
	},
	description: {
		add: translate('supervisorDialog.description.add'),
		change: translate('supervisorDialog.description.change'),
		handover: translate('supervisorDialog.description.handover')
	},
	currentHeading: translate('supervisorDialog.currentHeading'),
	noneYet: translate('supervisorDialog.noneYet'),
	personLabel: {
		add: translate('supervisorDialog.personLabel.add'),
		change: translate('supervisorDialog.personLabel.change'),
		handover: translate('supervisorDialog.personLabel.handover')
	},
	reasonLabel: {
		add: translate('supervisorDialog.reasonLabel.add'),
		change: translate('supervisorDialog.reasonLabel.change'),
		handover: translate('supervisorDialog.reasonLabel.handover')
	},
	reasonPlaceholder: translate('supervisorDialog.reasonPlaceholder'),
	reasonError: translate('supervisorDialog.reasonError'),
	reasonEmptyOption: translate('supervisorDialog.reasonEmptyOption'),
	explanation: {
		add: translate('supervisorDialog.explanation.add'),
		change: translate('supervisorDialog.explanation.change'),
		handover: translate('supervisorDialog.explanation.handover')
	},
	handoverPending: translate('supervisorDialog.handoverPending'),
	confirm: {
		add: translate('supervisorDialog.confirm.add'),
		change: translate('supervisorDialog.confirm.change'),
		handover: translate('supervisorDialog.confirm.handover')
	},
	cancel: translate('supervisorDialog.cancel'),
	close: translate('supervisorDialog.close'),
	emptyOption: translate('supervisorDialog.emptyOption')
});
