import {
	ListItemInterface,
	SessionItemInterface,
	STATUS_ACTIVE
} from '../../globalState/interfaces';

/**
 * FE#1876 decisions that the menu, the profile entry and the chat card share.
 * Pure on purpose: each rule is pinned by `furtherCounsellingRules.test.ts`.
 */

export interface RecommendVisibilityInput {
	isRejectedCase: boolean;
	isSessionOwner: boolean;
	isConsultant: boolean;
	isEnquiryList: boolean;
	isSession: boolean;
	isGroup: boolean;
	isSupervisor: boolean;
}

/**
 * The assigned counsellor of an accepted 1:1 conversation — the same audience
 * as "Kollegiale Beratung anfragen" (`showRequestAdvice`).
 */
export const canRecommendFurtherCounselling = (
	input: RecommendVisibilityInput
): boolean =>
	!input.isRejectedCase &&
	input.isSessionOwner &&
	input.isConsultant &&
	!input.isEnquiryList &&
	input.isSession &&
	!input.isGroup &&
	!input.isSupervisor;

type SessionFacts = Partial<
	Pick<
		SessionItemInterface,
		| 'id'
		| 'status'
		| 'createDate'
		| 'topic'
		| 'mainTopicId'
		| 'isTopicDuplicate'
		| 'postcode'
	>
>;

const topicIdOf = (session?: SessionFacts | null): number | null => {
	const id = session?.topic?.id ?? session?.mainTopicId;
	return typeof id === 'number' ? id : null;
};

const isRunning = (session?: SessionFacts | null) =>
	Number(session?.status) === STATUS_ACTIVE;

/** Newer first: creation date, then the (monotonic) session id. */
const compareNewestFirst = (a: SessionFacts, b: SessionFacts): number => {
	const timeA = Date.parse(a.createDate ?? '');
	const timeB = Date.parse(b.createDate ?? '');
	const byTime =
		(Number.isFinite(timeB) ? timeB : 0) -
		(Number.isFinite(timeA) ? timeA : 0);
	return byTime !== 0 ? byTime : (b.id ?? 0) - (a.id ?? 0);
};

/**
 * "Doppelte Beratung beenden": only the asker, only in a running chat, and
 * only when an OLDER running chat on the same topic exists. The backend's
 * `isTopicDuplicate` decides when it is sent; the list data decides otherwise.
 */
export const canEndTopicDuplicate = ({
	isAsker,
	current,
	sessions
}: {
	isAsker: boolean;
	current?: SessionFacts | null;
	sessions: ListItemInterface[];
}): boolean => {
	if (!isAsker || !current || !isRunning(current)) return false;
	if (typeof current.isTopicDuplicate === 'boolean') {
		return current.isTopicDuplicate;
	}
	const topicId = topicIdOf(current);
	if (topicId === null) return false;
	return sessions.some((item) => {
		const other = item?.session;
		return (
			!!other &&
			!item.chat &&
			other.id !== current.id &&
			isRunning(other) &&
			topicIdOf(other) === topicId &&
			compareNewestFirst(current, other) < 0
		);
	});
};

export type FurtherCounsellingPostcodeMode = 'SMART' | 'ALWAYS_EMPTY';

/** A missing or unknown setting means SMART (the platform default). */
export const resolvePostcodeMode = (
	value: unknown
): FurtherCounsellingPostcodeMode =>
	value === 'ALWAYS_EMPTY' ? 'ALWAYS_EMPTY' : 'SMART';

/**
 * SMART: the postcode the asker typed most recently, i.e. that of their
 * newest session carrying one. `session.postcode` is numeric in the API
 * model, so leading zeros are restored.
 */
export const pickPrefilledPostcode = (
	sessions: ListItemInterface[],
	mode: FurtherCounsellingPostcodeMode
): string | undefined => {
	if (mode === 'ALWAYS_EMPTY') return undefined;
	const newest = sessions
		.map((item) => item?.session)
		.filter(
			(session): session is SessionItemInterface =>
				!!session &&
				session.postcode != null &&
				`${session.postcode}` !== ''
		)
		.sort(compareNewestFirst)[0];
	return newest ? String(newest.postcode).padStart(5, '0') : undefined;
};

/**
 * Any room member can post a `[SYSTEM_NOTIFICATION]` body, so a recommendation
 * card is drawn only for a counsellor's event (the backend posts it as the
 * assigned consultant). The advice seeker is never trusted; with neither
 * identity known the card stays away.
 */
export const isTrustedRecommendationSender = ({
	senderId,
	consultantMatrixUserId,
	askerMatrixUserId
}: {
	senderId?: string | null;
	consultantMatrixUserId?: string | null;
	askerMatrixUserId?: string | null;
}): boolean => {
	if (!senderId) return false;
	if (askerMatrixUserId && senderId === askerMatrixUserId) return false;
	if (consultantMatrixUserId && senderId === consultantMatrixUserId)
		return true;
	return !!askerMatrixUserId;
};
