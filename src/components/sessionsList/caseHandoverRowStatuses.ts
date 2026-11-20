import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type {
	CaseHandoverCandidate,
	CaseHandoverRowStatus
} from '../../api/apiCaseHandover';

const KNOWN_ROW_STATUSES = new Set([
	'NOT_REQUESTED',
	'PENDING',
	'PENDING_CLIENT_CONSENT',
	'PENDING_RECIPIENT_ACCEPTANCE',
	'RECIPIENT_DECLINED',
	'GRANTED_PENDING_CLIENT_OPTOUT',
	'GRANTED',
	'DENIED',
	'CLIENT_CONSENT_DECLINED',
	'RECLAIMED',
	'EXPIRED',
	'WITHDRAWN'
]);

const readLockedStatus = (candidate: CaseHandoverCandidate) => {
	const summary = candidate.caseHandoverStatus;
	// A search result is a snapshot. A content grant still needs the guarded
	// current status before the card starts reading preview data.
	return summary?.canViewContent === false &&
		KNOWN_ROW_STATUSES.has(summary.status) &&
		typeof summary.hasRequest === 'boolean'
		? summary
		: undefined;
};

export interface CandidateRowStatus {
	lockedStatus?: CaseHandoverRowStatus;
	invalidatedAt: number;
}

type StatusEntry = CandidateRowStatus & { readAt: number };

type Ledger = {
	scope: object;
	entries: Map<number, StatusEntry>;
	invalidatedAt: number;
};

/** Holds only status from the authorized search endpoint, independently of list deduplication. */
export const useCaseHandoverRowStatuses = (
	actorId: string,
	archived: boolean,
	enabled: boolean
) => {
	const scope = useMemo(
		() => ({ actorId, archived, enabled }),
		[actorId, archived, enabled]
	);
	const currentScope = useRef<object | null>(null);
	useLayoutEffect(() => {
		currentScope.current = scope;
		return () => {
			currentScope.current = null;
		};
	}, [scope]);
	const clock = useRef(0);
	const [ledger, setLedger] = useState<Ledger>();

	const update = useCallback(
		(apply: (next: Ledger) => void) => {
			if (!enabled || currentScope.current !== scope) return;
			setLedger((previous) => {
				if (currentScope.current !== scope) return previous;
				const next =
					previous?.scope === scope
						? { ...previous, entries: new Map(previous.entries) }
						: {
								scope,
								entries: new Map<number, StatusEntry>(),
								invalidatedAt: 0
							};
				apply(next);
				return next;
			});
		},
		[enabled, scope]
	);

	const startRead = useCallback(() => {
		const readAt = ++clock.current;
		return (rows: CaseHandoverCandidate[]) => {
			update((next) => {
				if (readAt <= next.invalidatedAt) return;
				for (const row of rows) {
					const id = row.session?.id;
					if (id === undefined) continue;
					const existing = next.entries.get(id);
					if (existing && readAt <= existing.readAt) continue;
					next.entries.set(id, {
						lockedStatus: readLockedStatus(row),
						invalidatedAt:
							existing?.invalidatedAt ?? next.invalidatedAt,
						readAt
					});
				}
			});
		};
	}, [update]);

	const invalidate = useCallback(
		(ids?: number[]) => {
			const invalidatedAt = ++clock.current;
			update((next) => {
				if (!ids) {
					next.invalidatedAt = invalidatedAt;
					next.entries.clear();
					return;
				}
				for (const id of ids) {
					next.entries.set(id, {
						invalidatedAt,
						readAt: invalidatedAt
					});
				}
			});
		},
		[update]
	);

	const getRowStatus = useCallback(
		(id: number): CandidateRowStatus | undefined => {
			if (ledger?.scope !== scope) return undefined;
			return (
				ledger.entries.get(id) ??
				(ledger.invalidatedAt > 0
					? { invalidatedAt: ledger.invalidatedAt }
					: undefined)
			);
		},
		[ledger, scope]
	);

	return { startRead, invalidate, getRowStatus };
};
