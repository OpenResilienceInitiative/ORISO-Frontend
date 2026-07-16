import { ErrorInfo } from 'react';
import { endpoints } from '../resources/scripts/endpoints';

export interface ErrorResponse {}

export const ERROR_LEVEL_FATAL = 'FATAL';
export const ERROR_LEVEL_ERROR = 'ERROR';
export const ERROR_LEVEL_WARN = 'WARN';
export const ERROR_LEVEL_INFO = 'INFO';
export const ERROR_LEVEL_DEBUG = 'DEBUG';
export const ERROR_LEVEL_TRACE = 'TRACE';

type TErrorHeaders = {
	'User-Agent'?: string;
	'Referer'?: string;
};

export type TError = Error & {
	level?:
		| typeof ERROR_LEVEL_FATAL
		| typeof ERROR_LEVEL_ERROR
		| typeof ERROR_LEVEL_WARN
		| typeof ERROR_LEVEL_INFO
		| typeof ERROR_LEVEL_DEBUG
		| typeof ERROR_LEVEL_TRACE;
	url?: string;
	headers?: TErrorHeaders;
	parsedStack?: string;
};

export type ErrorRequestBody = {
	source: 'frontend';
	message: string;
	stack?: string;
	url: string;
	userAgent?: string;
	correlationId?: string;
	severity: 'error' | 'warn';
};

const WARN_LEVELS: ReadonlyArray<TError['level']> = [
	ERROR_LEVEL_WARN,
	ERROR_LEVEL_INFO,
	ERROR_LEVEL_DEBUG,
	ERROR_LEVEL_TRACE
];

const severityFor = (level?: TError['level']): 'error' | 'warn' =>
	level && WARN_LEVELS.includes(level) ? 'warn' : 'error';

const currentUrl = (fallback?: string): string =>
	fallback || (typeof window !== 'undefined' && window.location?.href) || '';

const currentUserAgent = (headers?: TErrorHeaders): string | undefined =>
	headers?.['User-Agent'] ||
	(typeof navigator !== 'undefined' ? navigator.userAgent : undefined);

/**
 * Best-effort, fire-and-forget client error report (OBS-P3, ORISO-Helm#62).
 *
 * Replaces the dead `/service/logstash` intake: errors are now sent to
 * UserService's unauthenticated `/error-reports` endpoint, which logs them
 * through its existing structured logger for SigNoz to pick up. This must
 * never throw or reject -- a failure to *report* an error must not itself
 * become a new error that blocks the UI or the caller's error-handling flow.
 */
export const apiPostError = async (
	error: TError,
	info?: ErrorInfo,
	correlationId?: string
): Promise<ErrorResponse> => {
	try {
		const body: ErrorRequestBody = {
			source: 'frontend',
			message: error?.message || error?.name || 'Unknown frontend error',
			stack: error?.stack || info?.componentStack || undefined,
			url: currentUrl(error?.url),
			userAgent: currentUserAgent(error?.headers),
			correlationId,
			severity: severityFor(error?.level)
		};

		await fetch(endpoints.error, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body)
		});
	} catch (e) {
		// Swallow network/reporting failures -- this is telemetry, not a
		// critical path, and must never surface as a new error.
	}

	return {};
};
