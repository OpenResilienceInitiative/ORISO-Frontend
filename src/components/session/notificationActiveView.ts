const SESSION_DETAIL_ROUTE =
	/^\/sessions\/[^/]+\/(?:sessionView|sessionPreview|view)\/.+/;
const NON_CONVERSATION_SUFFIX =
	/(?:userProfile|editGroupChat|groupChatInfo)\/?$/;

/** True only while the route visibly owns a conversation detail surface. */
export const isNotificationActiveViewRoute = (
	pathname: string,
	search = ''
): boolean =>
	SESSION_DETAIL_ROUTE.test(pathname) &&
	!NON_CONVERSATION_SUFFIX.test(pathname) &&
	new URLSearchParams(search).get('embeddedNotifications') !== '1';
