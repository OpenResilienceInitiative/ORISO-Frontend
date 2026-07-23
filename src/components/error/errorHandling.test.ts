// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { redirectToErrorPage, ERROR_TYPES } from './errorHandling';
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
