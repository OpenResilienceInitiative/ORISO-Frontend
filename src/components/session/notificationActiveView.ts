import { channelsEqual, SessionChannel } from '../../utils/channelRoute';

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

/**
 * The side channel the chat card really shows. `?channel=` is only the request:
 * a thread needs its root in the loaded history and a side room has to exist,
 * or the main chat stays. What counts as seen must not read the URL.
 */
let shownChannel: SessionChannel | null = null;
const shownChannelListeners = new Set<() => void>();

export const getShownChannel = () => shownChannel;

export const reportShownChannel = (channel: SessionChannel | null) => {
	if (channelsEqual(shownChannel, channel)) return;
	shownChannel = channel;
	shownChannelListeners.forEach((listener) => listener());
};

export const subscribeShownChannel = (listener: () => void) => {
	shownChannelListeners.add(listener);
	return () => {
		shownChannelListeners.delete(listener);
	};
};
