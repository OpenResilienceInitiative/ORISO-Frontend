// @vitest-environment oriso-jsdom
import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	vi
} from 'vite-plus/test';
import {
	apiChangeGroupChatParticipantRole,
	apiRemoveGroupChatParticipant,
	apiTransferGroupChatOwnership
} from './apiGroupChatRoles';
import { apiGetGroupChatInfo } from './apiGetGroupChatInfo';
import { apiPostBanUser } from './apiPostBanUser';
import { redirectToErrorPage } from '../components/error/errorHandling';
import { logout } from '../components/logout/logout';

vi.mock('../components/error/errorHandling', async (importOriginal) => ({
	...(await importOriginal<
		typeof import('../components/error/errorHandling')
	>()),
	redirectToErrorPage: vi.fn()
}));
vi.mock('../components/logout/logout', () => ({ logout: vi.fn() }));
vi.mock('../utils/appConfig', () => ({
	appConfig: { urls: { toLogin: '/login' } }
}));

/**
 * The Chat-Info page ("Informationen & Einstellungen") must handle a failed
 * member call itself. A fetchData call without `responseHandling` sends the
 * whole app to error.500.html instead (OBP 2.1 #121).
 */
describe('group chat member calls never redirect to the error page', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		window.history.replaceState({}, '', '/sessions/consultant/x');
		vi.stubGlobal(
			'Request',
			class {
				constructor(
					public url: string,
					public init?: RequestInit
				) {}
			}
		);
	});
	afterEach(() => vi.unstubAllGlobals());

	const calls: Array<[string, () => Promise<unknown>]> = [
		['remove participant', () => apiRemoveGroupChatParticipant(1, 'c1')],
		[
			'change role',
			() => apiChangeGroupChatParticipantRole(1, 'c1', 'PARTICIPANT')
		],
		['transfer ownership', () => apiTransferGroupChatOwnership(1, 'c1')],
		['read chat info', () => apiGetGroupChatInfo(1)],
		['ban user', () => apiPostBanUser({ matrixUserId: '@a:b', chatId: 1 })]
	];

	describe.each([400, 409, 500, 502])('HTTP %s', (status) => {
		it.each(calls)('%s rejects without redirect', async (_n, call) => {
			vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ status }));
			await expect(call()).rejects.toBeDefined();
			expect(redirectToErrorPage).not.toHaveBeenCalled();
		});
	});

	// A revoked session must still end in the normal logout, not be swallowed
	// by the Chat-Info's own error handling.
	it.each(calls.slice(0, 4))(
		'%s keeps the logout on HTTP 401',
		async (_n, call) => {
			vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ status: 401 }));
			await expect(call()).rejects.toBeDefined();
			expect(logout).toHaveBeenCalledWith(true, '/login');
		}
	);

	it('remove participant still resolves on 204', async () => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ status: 204 }));
		await expect(
			apiRemoveGroupChatParticipant(1, 'c1')
		).resolves.toBeDefined();
	});
});
