/** Unopened counts above this show the star instead of a digit. */
export const INBOX_NAV_ICON_MAX_DIGIT = 9;

export type InboxNavIconKind =
	| 'empty'
	| 'allOpened'
	| 'oneNew'
	| 'manyNew'
	| 'overdue';

/** `null`: no circle. `{ digit }`: 1 to 9. `'star'`: more than nine. */
export type InboxNavIconCircle = null | { digit: number } | 'star';

export interface InboxNavIconInput {
	/** All enquiries the counsellor has, opened or not. */
	totalCount: number;
	/** Enquiries not opened yet. */
	unopenedCount: number;
	/** Something is older than the response deadline. */
	overdue?: boolean;
}

export interface InboxNavIconState {
	icon: InboxNavIconKind;
	circle: InboxNavIconCircle;
	/** Exact (sanitised) count, also above nine. */
	unopenedCount: number;
	overdue: boolean;
}

const toCount = (value: number) =>
	Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;

const circleFor = (unopened: number, minDigit: number): InboxNavIconCircle => {
	if (unopened > INBOX_NAV_ICON_MAX_DIGIT) return 'star';
	return unopened >= minDigit ? { digit: unopened } : null;
};

/**
 * Pure picker. Priority: overdue > more than nine > two to nine > one >
 * all opened > empty.
 */
export const pickInboxNavIconState = ({
	totalCount,
	unopenedCount,
	overdue = false
}: InboxNavIconInput): InboxNavIconState => {
	const total = toCount(totalCount);
	const unopened = Math.min(toCount(unopenedCount), total);

	if (overdue) {
		return {
			icon: 'overdue',
			circle: circleFor(unopened, 1),
			unopenedCount: unopened,
			overdue: true
		};
	}
	const base = { unopenedCount: unopened, overdue: false };
	if (unopened > INBOX_NAV_ICON_MAX_DIGIT) {
		return { ...base, icon: 'manyNew', circle: 'star' };
	}
	if (unopened >= 2) {
		return { ...base, icon: 'manyNew', circle: { digit: unopened } };
	}
	if (unopened === 1) return { ...base, icon: 'oneNew', circle: null };
	return { ...base, icon: total > 0 ? 'allOpened' : 'empty', circle: null };
};

const LABEL_ROOT = 'navigation.consultant.inboxState';

/** i18n key plus options for the state; the caller translates. */
export const getInboxNavIconLabel = (
	state: InboxNavIconState
): { key: string; options?: { count: number } } => {
	const count = state.unopenedCount;
	if (state.overdue) {
		return count > 0
			? { key: `${LABEL_ROOT}.overdueUnopened`, options: { count } }
			: { key: `${LABEL_ROOT}.overdue`, options: undefined };
	}
	if (count > 0) {
		return { key: `${LABEL_ROOT}.unopened`, options: { count } };
	}
	return {
		key: `${LABEL_ROOT}.${state.icon === 'empty' ? 'empty' : 'allOpened'}`,
		options: undefined
	};
};
