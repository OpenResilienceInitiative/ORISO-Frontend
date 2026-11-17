// @vitest-environment oriso-jsdom
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import { fetchData } from './fetchData';
import { logout } from '../components/logout/logout';
import { setAppConfig } from '../utils/appConfig';
import {
	InternalChatInvitationError,
	apiGetInternalChatInvitationRecipients,
	apiInviteInternalChatParticipant
} from './apiInternalChatInvitation';

vi.mock('./fetchData', async (importOriginal) => ({
	...(await importOriginal<typeof import('./fetchData')>()),
	fetchData: vi.fn()
}));
vi.mock('../components/logout/logout', () => ({ logout: vi.fn() }));

const response = (status: number, reason?: string) =>
	new Response(null, {
		status,
		headers: reason ? { 'X-Reason': reason } : {}
	});

describe('apiGetInternalChatInvitationRecipients', () => {
	beforeEach(() => {
		vi.resetAllMocks();
		setAppConfig({ urls: { toLogin: '/login' } } as never);
	});

	it('asks the room, not the caller, for the people who can be invited', async () => {
		vi.mocked(fetchData).mockResolvedValue([
			{
				consultantId: 'selma',
				displayName: 'Selma Bouvier',
				agencies: [{ id: 2, name: 'Beratungsstelle Berlin' }]
			}
		]);

		const recipients = await apiGetInternalChatInvitationRecipients(77);

		const request = vi.mocked(fetchData).mock.calls[0][0];
		expect(request.url).toMatch(
			/\/service\/users\/chat\/internal-subset\/77\/recipients$/
		);
		expect(request.method).toBe('GET');
		expect(recipients).toHaveLength(1);
		expect(recipients[0].consultantId).toBe('selma');
	});

	it('reads "nobody else can be invited" (204) as an empty list', async () => {
		vi.mocked(fetchData).mockResolvedValue({});

		await expect(
			apiGetInternalChatInvitationRecipients(77)
		).resolves.toEqual([]);
	});

	it('marks a room that cannot take newcomers as refused, with the server reason', async () => {
		vi.mocked(fetchData).mockRejectedValue(
			response(409, 'INTERNAL_CHAT_HISTORY_SHARED')
		);

		const error = await apiGetInternalChatInvitationRecipients(77).catch(
			(e) => e
		);

		expect(error).toBeInstanceOf(InternalChatInvitationError);
		expect(error.refused).toBe(true);
		expect(error.reason).toBe('INTERNAL_CHAT_HISTORY_SHARED');
		expect(error.status).toBe(409);
	});

	it('ends an expired session at the login', async () => {
		vi.mocked(fetchData).mockRejectedValue(response(401));

		await expect(
			apiGetInternalChatInvitationRecipients(77)
		).rejects.toBeInstanceOf(InternalChatInvitationError);
		expect(logout).toHaveBeenCalled();
	});
});

describe('apiInviteInternalChatParticipant', () => {
	beforeEach(() => vi.resetAllMocks());

	it('sends the colleague to the running chat', async () => {
		vi.mocked(fetchData).mockResolvedValue(response(201));

		await apiInviteInternalChatParticipant(77, 'selma');

		const request = vi.mocked(fetchData).mock.calls[0][0];
		expect(request.url).toMatch(
			/\/service\/users\/chat\/internal-subset\/77\/participants$/
		);
		expect(request.method).toBe('POST');
		expect(request.bodyData).toBe(
			JSON.stringify({ consultantId: 'selma' })
		);
	});

	it.each([
		[403, 'INTERNAL_CHAT_RECIPIENT_OUT_OF_SCOPE'],
		[409, 'INTERNAL_CHAT_NOT_INVITABLE']
	])(
		'treats %s %s as a refusal, not as "try again"',
		async (status, reason) => {
			vi.mocked(fetchData).mockRejectedValue(response(status, reason));

			const error = await apiInviteInternalChatParticipant(
				77,
				'selma'
			).catch((e) => e);

			expect(error.refused).toBe(true);
			expect(error.reason).toBe(reason);
		}
	);

	it('keeps a busy or failed join retryable', async () => {
		vi.mocked(fetchData).mockRejectedValue(
			response(503, 'INTERNAL_CHAT_BUSY')
		);

		const error = await apiInviteInternalChatParticipant(77, 'selma').catch(
			(e) => e
		);

		expect(error).toBeInstanceOf(InternalChatInvitationError);
		expect(error.refused).toBe(false);
		expect(error.reason).toBe('INTERNAL_CHAT_BUSY');
	});
});
