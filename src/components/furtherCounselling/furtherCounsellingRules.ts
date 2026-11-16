import {
	ListItemInterface,
	SessionItemInterface,
	STATUS_ACTIVE
} from '../../globalState/interfaces';
import type { AgencyConversationPolicy } from '../../globalState/interfaces/ConversationFeatureSettings';

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

/**
 * FE#2251: in an anonymous live chat the item also needs the counselling
 * centre's own switch. 1:1 conversations are unchanged.
 */
export const canRecommendInModality = ({
	isLiveChat,
	liveChatEnabled
}: {
	isLiveChat: boolean;
	liveChatEnabled: boolean;
}): boolean => !isLiveChat || liveChatEnabled;

/**
 * The centre switch "Weitere Beratung im Live-Chat empfehlen" of the open
 * conversation: only a ready answer for this very centre (and tenant, when
 * the answer names one) that says `true` counts. Null, absent, loading,
 * unavailable or stale means off, the same rule as the conversation features.
 */
export const isLiveChatFurtherCounsellingEnabled = (
	policy: AgencyConversationPolicy | undefined,
	currentAgencyId: number | undefined,
	tenantId: unknown
): boolean =>
	!!policy &&
	policy.state === 'ready' &&
	policy.agencyId === currentAgencyId &&
	(policy.tenantId === undefined || policy.tenantId === tenantId) &&
	policy.settings?.featureLiveChatFurtherCounsellingEnabled === true;

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
		| 'registrationType'
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
 * model, so leading zeros are restored. An anonymous live chat carries a
 * placeholder postcode (`0`/`00000`), never a real one: it is never offered
 * (FE#2251).
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
				`${session.postcode}` !== '' &&
				Number(session.postcode) > 0 &&
				`${session.registrationType ?? ''}` !== 'ANONYMOUS'
		)
		.sort(compareNewestFirst)[0];
	return newest ? String(newest.postcode).padStart(5, '0') : undefined;
};

/**
 * Any room member can post a `[SYSTEM_NOTIFICATION]` body, so a recommendation
 * card is drawn only for an event of the session's assigned counsellor (the
 * backend posts it strictly as that account). Anyone else, or an unknown
 * counsellor id, draws nothing.
 */
export const isTrustedRecommendationSender = ({
	senderId,
	consultantMatrixUserId
}: {
	senderId?: string | null;
	consultantMatrixUserId?: string | null;
}): boolean =>
	!!senderId &&
	!!consultantMatrixUserId &&
	senderId === consultantMatrixUserId;
