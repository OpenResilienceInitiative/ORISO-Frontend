export const toSameOriginRoute = (
	url: string,
	currentOrigin = window.location.origin
) => {
	try {
		const parsedUrl = new URL(url, currentOrigin);

		if (parsedUrl.origin !== currentOrigin) {
			return null;
		}

		return `${parsedUrl.pathname}${parsedUrl.search}${parsedUrl.hash}`;
	} catch {
		return url.startsWith('/') ? url : null;
	}
};
