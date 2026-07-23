const { parseCookies } = require('./parseCookies');

const getUserServiceBaseUrl = () =>
	(process.env.USER_SERVICE_URL || '').replace(/\/+$/, '');

const collectRoomIdentifiers = (sessions = []) => {
	const identifiers = new Set();

	for (const entry of sessions) {
		const session = entry?.session;
		const chat = entry?.chat;

		if (session?.matrixRoomId) {
			identifiers.add(session.matrixRoomId);
		}
		if (session?.groupId) {
			identifiers.add(session.groupId);
		}
		if (chat?.matrixRoomId) {
			identifiers.add(chat.matrixRoomId);
		}
		if (chat?.groupId) {
			identifiers.add(chat.groupId);
		}
	}

	return identifiers;
};

const buildUserServiceHeaders = (req) => {
	const cookies = parseCookies(req.headers.cookie);
	const csrfHeader =
		req.headers['x-csrf-token'] || req.headers['X-CSRF-Token'];
	const csrfCookie = cookies['CSRF-TOKEN'];
	const headers = {
		Accept: 'application/json',
		Authorization: req.headers.authorization
	};

	if (csrfHeader) {
		headers['X-CSRF-Token'] = csrfHeader;
	}
	if (csrfCookie) {
		headers.Cookie = `CSRF-TOKEN=${encodeURIComponent(csrfCookie)}`;
	}

	return headers;
};

const fetchSessionsForUser = async (req) => {
	const userServiceBase = getUserServiceBaseUrl();
	if (!userServiceBase) {
		throw new Error('USER_SERVICE_URL is not configured');
	}

	const sessionsPath = req.isConsultant
		? '/service/users/sessions/consultants?status=2&'
		: '/service/users/sessions/askers';

	const response = await fetch(`${userServiceBase}${sessionsPath}`, {
		method: 'GET',
		headers: buildUserServiceHeaders(req)
	});

	if (response.status === 204) {
		return [];
	}

	if (!response.ok) {
		throw new Error(`UserService responded with ${response.status}`);
	}

	const payload = await response.json();
	return payload?.sessions || [];
};

const userHasRoomAccess = async (req, roomName) => {
	const sessions = await fetchSessionsForUser(req);
	const allowedRooms = collectRoomIdentifiers(sessions);
	return allowedRooms.has(roomName);
};

module.exports = {
	collectRoomIdentifiers,
	getUserServiceBaseUrl,
	userHasRoomAccess
};
