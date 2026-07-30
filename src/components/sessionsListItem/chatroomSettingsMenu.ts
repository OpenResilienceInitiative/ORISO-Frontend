/**
 * FE#781 — visibility rules for the session-list "Chatroom Settings" menu.
 *
 * Kept free of React/API imports so the whole matrix stays unit-testable, in
 * the same spirit as `sessionNavigationPath` and `teamDiscussionHelpers`.
 *
 * The menu only renders actions that resolve to a real handler. Mute, Invite
 * More People and Summarize Chat deliberately have no flag here: no shipped
 * feature backs them yet (per-conversation mute is still open in FE#420, no
 * add-participant flow exists, no summarization workflow exists), so they are
 * absent rather than permanently disabled stubs.
 */
import { SESSION_LIST_TYPES } from '../session/sessionHelpers';
import { isTeamDiscussionAvailable } from '../teamDiscussion/teamDiscussionHelpers';

export interface ChatroomSettingsMenuInput {
	isAsker: boolean;
	isConsultant: boolean;
	/** Consultant viewing a colleague's session (read-only observer). */
	isSupervisorView: boolean;
	isSession: boolean;
	isEnquiry: boolean;
	isGroup: boolean;
	listType: SESSION_LIST_TYPES;
	isArchiveTab: boolean;
	isAgencyCounselling: boolean;
	teamDiscussionFeatureEnabled: boolean;
	hasExistingTeamDiscussion: boolean;
}

export interface ChatroomSettingsMenuVisibility {
	showArchive: boolean;
	showDearchive: boolean;
	showDelete: boolean;
	showRequestHelp: boolean;
}

export const getChatroomSettingsMenuVisibility = ({
	isAsker,
	isConsultant,
	isSupervisorView,
	isSession,
	isEnquiry,
	isGroup,
	listType,
	isArchiveTab,
	isAgencyCounselling,
	teamDiscussionFeatureEnabled,
	hasExistingTeamDiscussion
}: ChatroomSettingsMenuInput): ChatroomSettingsMenuVisibility => {
	// Mirrors the header menu's gates in SessionMenu.tsx so both entry points
	// stay in lockstep. A supervisor only observes a colleague's session, so it
	// is neither theirs to archive (SessionMenu gates archive on
	// `!props.isSupervisor` too) nor to delete.
	const isOwnEditableSession =
		!isAsker &&
		listType !== SESSION_LIST_TYPES.ENQUIRY &&
		isSession &&
		!isSupervisorView;

	const showDelete = isOwnEditableSession && isConsultant;

	// ADR-016: the Team-Besprechung is an agency-counselling, consultant-only
	// side room. Creating one is only possible while the enquiry is open; after
	// acceptance the entry point survives solely as read-only archive access.
	const showRequestHelp =
		isAgencyCounselling &&
		isTeamDiscussionAvailable({
			isConsultant: isConsultant && !isAsker,
			isEnquiry,
			isGroup,
			// Anonymous modalities are already excluded by the guard above —
			// agency counselling is never anonymous.
			isAnonymous: false,
			featureEnabled: teamDiscussionFeatureEnabled,
			hasExistingDiscussion: hasExistingTeamDiscussion
		});

	return {
		showArchive: isOwnEditableSession && !isArchiveTab,
		showDearchive: isOwnEditableSession && isArchiveTab,
		showDelete,
		showRequestHelp
	};
};

/**
 * SessionStream opens the Team-Besprechung panel expanded when the route
 * carries `teamDiscussion=1`; the list menu reuses that contract instead of
 * introducing a second way to open the panel.
 */
export const withTeamDiscussionParam = (path: string): string => {
	// Split the fragment off first: it always trails the query, so parsing the
	// other way round would either encode `#x` into a param value or emit a
	// query *after* the fragment, where it stops being a query at all.
	const fragmentAt = path.indexOf('#');
	const fragment = fragmentAt === -1 ? '' : path.substring(fragmentAt);
	const withoutFragment =
		fragmentAt === -1 ? path : path.substring(0, fragmentAt);

	const queryAt = withoutFragment.indexOf('?');
	const pathname =
		queryAt === -1
			? withoutFragment
			: withoutFragment.substring(0, queryAt);
	const query = queryAt === -1 ? '' : withoutFragment.substring(queryAt + 1);

	const params = new URLSearchParams(query);
	params.set('teamDiscussion', '1');
	return `${pathname}?${params.toString()}${fragment}`;
};
