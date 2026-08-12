import { useEffect, useState } from 'react';
// Imported from its own module rather than the `api` barrel: the barrel pulls
// the whole API surface (and, transitively, the Lottie player) into anything
// that touches this gate.
import { apiGetCaseHandoverStatus } from '../../api/apiCaseHandover';
import { STATUS_ENQUIRY } from '../../globalState/interfaces';
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
 * Whether a session is subject to case-handover access control at all.
 *
 * Mirrors the ownership condition of `isCaseHandoverAccessControlled` without
 * its `type` argument, which is a session-list notion the timeline does not
 * have: a one-to-one session, past the enquiry stage, owned by a **different**
 * consultant. Everything else — group chats, enquiries, one's own cases — is
 * never curtained, so it must not cost a request.
 */
export const isTimelineCaseHandoverControlled = (
	session: ExtendedSessionInterface | null | undefined,
	userId: string | undefined
): boolean => {
	if (!session?.item || !userId) {
		return false;
	}
	if (session.isGroup || !session.isSession) {
		return false;
	}
	if (session.isEmptyEnquiry || session.item.status === STATUS_ENQUIRY) {
		return false;
	}
	const ownerId = session.consultant?.id;
	return Boolean(ownerId) && String(ownerId) !== String(userId);
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
	controlledSessionIds: readonly string[]
): ((sessionId: string | null | undefined) => boolean) => {
	const [, setResolvedCount] = useState(0);
	const key = controlledSessionIds.join(',');

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

	return (sessionId) =>
		Boolean(sessionId) && statusCache.get(String(sessionId)) === 'allowed';
};
