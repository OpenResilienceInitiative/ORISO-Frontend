// @vitest-environment oriso-jsdom
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import {
	getErrorCaseForStatus,
	redirectToErrorPage,
	ERROR_TYPES
} from './errorHandling';
import { apiPostError } from '../../api/apiPostError';

vi.mock('../../api/apiPostError', () => ({
	apiPostError: vi.fn(),
	ERROR_LEVEL_ERROR: 'ERROR'
}));

vi.mock('../../utils/appConfig', () => ({
	appConfig: {
		urls: {
			error401: '/error.401.html',
			error404: '/error.404.html',
			error500: '/error.500.html'
		},
		requestCollector: { showCorrelationId: {} }
	}
}));

vi.mock('../../utils/requestCollector', () => ({
	requestCollector: { get: vi.fn(() => []) }
}));

vi.mock('../sessionCookie/accessSessionCookie', () => ({
	getValueFromCookie: vi.fn()
}));

vi.mock('../logout/logout', () => ({ logout: vi.fn() }));

describe('redirectToErrorPage', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it.each([
		ERROR_TYPES.UNAUTHORIZED,
		ERROR_TYPES.FORBIDDEN,
		ERROR_TYPES.NOT_FOUND,
		ERROR_TYPES.SERVER
	])(
		'does not redirect or report bootstrap error %s on an invite route',
		(error) => {
			window.history.replaceState({}, '', '/invite/token/U25');

			redirectToErrorPage(error);

			expect(apiPostError).not.toHaveBeenCalled();
			expect(window.location.pathname).toBe('/invite/token/U25');
		}
	);
});

describe('getErrorCaseForStatus', () => {
	it.each([500, 502, 503, 504])(
		'shows the server error page for a %i, not "page not found"',
		(status) => {
			expect(getErrorCaseForStatus(status)).toBe(ERROR_TYPES.SERVER);
		}
	);

	it.each([
		[401, ERROR_TYPES.UNAUTHORIZED],
		[403, ERROR_TYPES.FORBIDDEN],
		[404, ERROR_TYPES.NOT_FOUND],
		[400, ERROR_TYPES.SERVER],
		[409, ERROR_TYPES.SERVER]
	])('keeps the page for a %i', (status, page) => {
		expect(getErrorCaseForStatus(status)).toBe(page);
	});
});
