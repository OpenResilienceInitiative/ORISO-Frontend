/*
 * Which user-data objects were read from the server, whatever their value.
 * Local updates (`{ ...previous, liveChatViaSidebar }`) are new objects and
 * never count: e-mail settings settle only on server data (FE#1752).
 */
const fromServer = new WeakSet<object>();

/** Marks `userData` as read from the server; returns it unchanged. */
export const markServerUserData = <T>(userData: T): T => {
	if (typeof userData === 'object' && userData !== null) {
		fromServer.add(userData);
	}
	return userData;
};

export const isServerUserData = (userData: unknown): userData is object =>
	typeof userData === 'object' &&
	userData !== null &&
	fromServer.has(userData);
