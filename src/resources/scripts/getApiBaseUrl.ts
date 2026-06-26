import { getRuntimeApiBaseUrl } from './runtimeConfig';

const normalizeApiUrl = (value?: string | null): string => {
	const trimmed = String(value || '').trim();
	if (!trimmed) {
		return '';
	}
	if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
		return trimmed;
	}
	return `https://${trimmed}`;
};

const isLocalApiHost = (value?: string | null): boolean =>
	/^(https?:\/\/)?(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/i.test(
		String(value || '').trim()
	);

export const getApiBaseUrl = (): string => {
	const cypressApiUrl = (window as any)?.Cypress?.env?.('REACT_APP_API_URL');
	if (cypressApiUrl) {
		return normalizeApiUrl(cypressApiUrl);
	}

	const processEnv: Record<string, string | undefined> =
		typeof process === 'undefined' ? {} : (process.env ?? {});
	const buildTimeApiUrl =
		processEnv.REACT_APP_API_URL || processEnv.VITE_API_URL;

	// Local dev: same-origin relative URLs are proxied to REACT_APP_DEV_REMOTE_API_URL
	// by proxy/routes/api.js. Calling a remote https API directly causes CORS failures.
	if (processEnv.NODE_ENV === 'development') {
		if (buildTimeApiUrl && isLocalApiHost(buildTimeApiUrl)) {
			return normalizeApiUrl(buildTimeApiUrl);
		}
		return '';
	}

	return getRuntimeApiBaseUrl();
};
