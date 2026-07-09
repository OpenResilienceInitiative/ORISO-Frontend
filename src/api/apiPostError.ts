import { ErrorInfo } from 'react';

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
	request: {
		correlationId: string;
		timestamp: string;
	};
	serviceName: string;
	error: TError;
	info?: ErrorInfo;
};

// For the Matrix integration errors are no longer posted to logstash; this
// stub keeps the call sites working and simply resolves.
export const apiPostError = async (
	error: TError,
	info?: ErrorInfo,
	correlationId?: string
): Promise<ErrorResponse> => {
	return Promise.resolve({});
};
