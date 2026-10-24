import { getObservabilityConfig } from '../../resources/scripts/runtimeConfig';

// W3C Trace Context: one new trace per request, so a backend span can be
// found from the browser. Same-origin only: a foreign API would need a CORS
// preflight for this header.

const randomHex = (bytes: number): string | null => {
	const cryptoApi = globalThis.crypto;
	if (!cryptoApi?.getRandomValues) return null;
	const values = cryptoApi.getRandomValues(new Uint8Array(bytes));
	const hex = Array.from(values, (value) =>
		value.toString(16).padStart(2, '0')
	).join('');
	// An all-zero id is invalid per spec.
	return /^0+$/.test(hex) ? null : hex;
};

export const createTraceparent = (): string | null => {
	const traceId = randomHex(16);
	const spanId = randomHex(8);
	return traceId && spanId ? `00-${traceId}-${spanId}-01` : null;
};

const isSameOrigin = (url: string): boolean => {
	try {
		return (
			new URL(url, window.location.href).origin === window.location.origin
		);
	} catch {
		return false;
	}
};

export const traceHeaders = (url: string): { traceparent?: string } => {
	if (!getObservabilityConfig().enabled || !isSameOrigin(url)) return {};
	const traceparent = createTraceparent();
	return traceparent ? { traceparent } : {};
};
