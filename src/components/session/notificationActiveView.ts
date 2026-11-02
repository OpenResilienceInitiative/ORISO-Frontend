const SESSION_DETAIL_ROUTE =
	/^\/sessions\/[^/]+\/(?:sessionView|sessionPreview|view)\/.+/;
const NON_CONVERSATION_SUFFIX =
	/(?:userProfile|editGroupChat|groupChatInfo)\/?$/;

/** True only while the route visibly owns a conversation detail surface. */
const decodeSegment = (segment: string) => {
	try {
		return decodeURIComponent(segment);
	} catch {
		// A stray '%' is a legal character in a route, not an encoding.
		return segment;
	}
};

export const pathSegments = (path: string) =>
	path.split(/[?#]/)[0].split('/').filter(Boolean).map(decodeSegment);

export const isNotificationActiveViewRoute = (
	pathname: string,
	search = ''
): boolean =>
	SESSION_DETAIL_ROUTE.test(pathname) &&
	!NON_CONVERSATION_SUFFIX.test(pathname) &&
	new URLSearchParams(search).get('embeddedNotifications') !== '1';
