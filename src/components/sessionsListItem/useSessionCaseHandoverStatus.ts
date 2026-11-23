import { useEffect, useMemo, useState } from 'react';
import { apiGetCaseHandoverStatus, FETCH_ERRORS } from '../../api';
import type { CaseHandoverRowStatus } from '../../api/apiCaseHandover';
import type { CandidateRowStatus } from '../sessionsList/caseHandoverRowStatuses';

/** The card can use a locked search snapshot. Preview access needs a current status. */
export const useSessionCaseHandoverStatus = ({
	accessControlled,
	actorId,
	listScope,
	sessionId,
	candidateStatus
}: {
	accessControlled: boolean;
	actorId: string;
	listScope?: string;
	sessionId?: number;
	candidateStatus?: CandidateRowStatus;
}) => {
	const summary = candidateStatus?.lockedStatus;
	const lockedStatus =
		accessControlled && summary?.canViewContent === false
			? summary
			: undefined;
	const mustRead =
		accessControlled && sessionId !== undefined && !lockedStatus;
	const invalidatedAt = candidateStatus?.invalidatedAt ?? 0;
	// Retained rows need a fresh access check for each newer candidate read.
	const candidateReadAt = candidateStatus?.candidateReadAt;
	const read = useMemo(
		() =>
			mustRead
				? {
						actorId,
						listScope,
						sessionId,
						invalidatedAt,
						candidateReadAt
					}
				: null,
		[
			mustRead,
			actorId,
			listScope,
			sessionId,
			invalidatedAt,
			candidateReadAt
		]
	);
	const [resolved, setResolved] = useState<{
		read: typeof read;
		status: CaseHandoverRowStatus | null;
	}>();

	useEffect(() => {
		if (read?.sessionId === undefined) return;
		let cancelled = false;
		apiGetCaseHandoverStatus(read.sessionId)
			.then((result) => {
				if (cancelled) return;
				setResolved({
					read,
					status: result
						? {
								status: result.status,
								canViewContent: result.canViewContent,
								hasRequest: Boolean(result.requestId)
							}
						: null
				});
			})
			.catch((error) => {
				if (cancelled) return;
				setResolved({
					read,
					status:
						error?.message === FETCH_ERRORS.FORBIDDEN
							? {
									status: 'DENIED',
									canViewContent: false,
									hasRequest: false
								}
							: null
				});
			});
		return () => {
			cancelled = true;
		};
	}, [read]);

	return {
		status:
			lockedStatus ??
			(read && resolved?.read === read ? resolved.status : null),
		loading: Boolean(read && resolved?.read !== read)
	};
};
