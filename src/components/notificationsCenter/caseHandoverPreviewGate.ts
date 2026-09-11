import { useCallback, useEffect, useState } from 'react';
// Imported from its own module rather than the `api` barrel: the barrel pulls
// the whole API surface (and, transitively, the Lottie player) into anything
// that touches this gate.
import { apiGetCaseHandoverStatus } from '../../api/apiCaseHandover';
import { STATUS_ENQUIRY } from '../../globalState/interfaces/SessionsDataInterface';
import { ExtendedSessionInterface } from '../../globalState/helpers/stateHelpers';

/**
 * Case-handover gate for the Activity Timeline's message previews (#924).
 *
 * The conversation itself is already protected: `SessionStream` replaces it
 * with the handover curtain while `canViewContent` is false, and the session
 * list shows `caseHandover.list.hiddenPreview` instead of the last message.
 * The timeline is a third surface showing the same content, so it needs the
 * same gate — otherwise a consultant curtained out of a case reads the message
 * on the timeline instead.
 *
 * The gate is fail-closed: a session whose status is not yet known is treated
 * as blocked, and the card keeps the generic text it had before hydration.
 */

/**
 * Whether a card must pass the handover check before it may hydrate.
 *
 * Phrased as "requires a check", not "is controlled", because the honest
 * default is the expensive one. The exemptions below are the only cases where
 * the *loaded* session proves handover cannot apply — a group chat, an enquiry
 * nobody owns yet, or a case owned by the reader. Mirrors the ownership
 * condition of `isCaseHandoverAccessControlled` without its `type` argument,
 * which is a session-list notion the timeline does not have.
 *
 * Anything else answers `true`, **including a session the timeline could not
 * resolve at all**: `SessionsDataContext` is paginated and populated
 * asynchronously, so a card can easily name a session that is not loaded yet.
 * Reading "not found" as "not controlled" would have opened the gate for
 * exactly the rows it exists to close.
 */
export const requiresCaseHandoverCheck = (
	session: ExtendedSessionInterface | null | undefined,
	userId: string | undefined
): boolean => {
	if (!session?.item) {
		return true;
	}
	if (session.isGroup || !session.isSession) {
		return false;
	}
	if (session.isEmptyEnquiry || session.item.status === STATUS_ENQUIRY) {
		return false;
	}
	const ownerId = session.consultant?.id;
	// An ownerless session is nobody's case to hand over.
	if (!ownerId) {
		return false;
	}
	// Tested last, and only where ownership actually decides the answer: user
	// data loads asynchronously, and checking it first made every group chat
	// and enquiry request a handover status during that window.
	if (!userId) {
		return true;
	}
	return String(ownerId) !== String(userId);
};

type GateState = 'allowed' | 'blocked';

/**
 * Statuses live for the browser session: a handover decision does not change
 * from under the user while the timeline is open, and re-asking per render
 * would put one request per card on every poll.
 */
const statusCache = new Map<string, GateState>();

/** Test seam — the cache is module state, so it outlives a single render tree. */
export const resetCaseHandoverPreviewGateCache = () => statusCache.clear();

/**
 * Resolve the gate for every controlled session id in the feed.
 *
 * Returns a predicate rather than a set so callers cannot mistake "not in the
 * blocked set" for "allowed" — an unknown id answers `false`.
 */
export const useCaseHandoverPreviewGate = (
	checkedSessionIds: readonly string[]
): ((sessionId: string | null | undefined) => boolean) => {
	const [resolvedCount, setResolvedCount] = useState(0);
	const key = checkedSessionIds.join(',');

	useEffect(() => {
		let cancelled = false;
		const pending = key
			.split(',')
			.filter(Boolean)
			.filter((sessionId) => !statusCache.has(sessionId));
		if (pending.length === 0) {
			return undefined;
		}

		Promise.all(
			pending.map((sessionId) =>
				apiGetCaseHandoverStatus(Number(sessionId))
					.then((status) =>
						statusCache.set(
							sessionId,
							status?.canViewContent ? 'allowed' : 'blocked'
						)
					)
					// A refused or failed status is a reason to show less, not
					// more: 403 is exactly the curtained case.
					.catch(() => statusCache.set(sessionId, 'blocked'))
			)
		).then(() => {
			if (!cancelled) {
				setResolvedCount((count) => count + 1);
			}
		});

		return () => {
			cancelled = true;
		};
	}, [key]);

	// Memoized so the caller's derived lists keep a stable identity between
	// renders; `resolvedCount` is what makes a newly cached status visible,
	// since the cache itself is module state React cannot observe.
	return useCallback(
		(sessionId: string | null | undefined) =>
			Boolean(sessionId) &&
			statusCache.get(String(sessionId)) === 'allowed',
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[resolvedCount, key]
	);
};
