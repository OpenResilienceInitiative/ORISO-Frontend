/**
 * Which live (STOMP) events change *which sessions exist* in a list, and so
 * require a refetch rather than an in-place touch (#1206).
 *
 * The backend sends the same event under two spellings (camelCase and
 * ALL-CAPS), so the lookup is case-insensitive instead of listing both.
 */
export interface ListRefreshFlags {
	refreshEnquiryList: boolean;
	refreshSessionList: boolean;
}

const LIST_REFRESH_BY_EVENT: Readonly<Record<string, ListRefreshFlags>> = {
	// A new anonymous enquiry only enters the request list.
	newanonymousenquiry: {
		refreshEnquiryList: true,
		refreshSessionList: false
	},
	// Accepting an enquiry moves it out of every counsellor's request list and
	// into the assignee's conversation list — both lists change membership.
	// Before #1206 this event only raised a toast, which is why the request →
	// chat transition needed a hard reload.
	anonymousenquiryaccepted: {
		refreshEnquiryList: true,
		refreshSessionList: true
	},
	// A finished conversation leaves both lists.
	anonymousconversationfinished: {
		refreshEnquiryList: true,
		refreshSessionList: true
	}
};

export const resolveStompListRefresh = (
	eventType: string
): ListRefreshFlags | null =>
	LIST_REFRESH_BY_EVENT[String(eventType ?? '').toLowerCase()] ?? null;
