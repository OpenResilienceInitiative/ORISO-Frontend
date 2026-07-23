const parseCookies = (cookieHeader = '') => {
	const cookies = {};
	if (!cookieHeader) {
		return cookies;
	}

	cookieHeader.split(';').forEach((part) => {
		const [rawName, ...rest] = part.split('=');
		const name = rawName?.trim();
		if (!name) {
			return;
		}
		cookies[name] = decodeURIComponent(rest.join('=').trim());
	});

	return cookies;
};

module.exports = { parseCookies };
