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

export const getApiBaseUrl = (): string => {
	const cypressApiUrl = (window as any)?.Cypress?.env?.('REACT_APP_API_URL');
	if (cypressApiUrl) {
		return normalizeApiUrl(cypressApiUrl);
	}

	const runtimeConfig = (window as any)?.__ORISO_RUNTIME_CONFIG__;
	const runtimeApiUrl =
		runtimeConfig?.REACT_APP_API_URL || runtimeConfig?.VITE_API_URL;
	if (runtimeApiUrl) {
		return normalizeApiUrl(runtimeApiUrl);
	}

	return normalizeApiUrl(
		process.env.REACT_APP_API_URL || process.env.VITE_API_URL
	);
};
