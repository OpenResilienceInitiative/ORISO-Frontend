// @vitest-environment oriso-jsdom
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import { fetchData, FETCH_METHODS } from './fetchData';
import {
	apiCreateDirectLink,
	apiCreateSessionDirectInvitation,
	apiRenewDirectInvitation,
	apiRequestDirectInvitationRenewal,
	directInvitationAccessError,
	isExpiredDirectLinkError,
	isInactiveDirectLinkError,
	toAccessMode,
	toDirectLink
} from './apiDirectLinks';

vi.mock('./fetchData', async () => {
	const actual =
		await vi.importActual<typeof import('./fetchData')>('./fetchData');
	return { ...actual, fetchData: vi.fn() };
});

/* #2252: a Direkteinladung with an appointment, as UserService CP2 sends it. */
const invitation = {
	id: 9,
	token: 'tok',
	url: 'https://app.example/invite/tok',
	name: 'Termin Frau M.',
	topicId: 3,
	topicName: 'Schulden',
	medium: 'VIDEO',
	temporary: true,
	active: true,
	admission: 'KNOCK',
	scheduledAt: '2026-11-20T13:00:00Z',
	appointment: {
		id: 'a-1',
		startTime: '2026-11-20T13:00:00Z',
		endTime: '2026-11-20T14:00:00Z',
		status: 'SCHEDULED'
	},
	validityAfterEndMinutes: 1440,
	expiresAt: '2026-11-21T14:00:00Z',
	expired: false,
	callOpensAt: '2026-11-20T12:45:00Z',
	accessMode: 'GUESTS_ONLY',
	knock: false,
	sessionId: 77,
	joinsExistingSession: true
};

const reply = (status: number, body?: unknown) =>
	new Response(body === undefined ? null : JSON.stringify(body), {
		status
	});

beforeEach(() => vi.clearAllMocks());

describe('Direkteinladung on the tile model (#2252)', () => {
	it('carries appointment, validity, access, knock and the conversation', () => {
		expect(toDirectLink(invitation)).toMatchObject({
			id: '9',
			appointment: {
				id: 'a-1',
				start: '2026-11-20T13:00:00Z',
				end: '2026-11-20T14:00:00Z'
			},
			validityMinutes: 1440,
			expiresAt: '2026-11-21T14:00:00Z',
			expired: false,
			callOpensAt: '2026-11-20T12:45:00Z',
			access: 'guests',
			knock: false,
			sessionId: 77,
			joinsExistingSession: true
		});
	});

	it('drops a cancelled appointment: the link then has none', () => {
		const link = toDirectLink({
			...invitation,
			appointment: { ...invitation.appointment, status: 'CANCELLED' }
		});
		expect(link).not.toHaveProperty('appointment');
	});

	it('maps the access choice both ways', () => {
		expect(toAccessMode('guests')).toBe('GUESTS_ONLY');
		expect(toAccessMode('accounts')).toBe('ACCOUNTS_ONLY');
		expect(toAccessMode('both')).toBe('BOTH');
		expect(
			toDirectLink({ ...invitation, accessMode: 'ACCOUNTS_ONLY' })?.access
		).toBe('accounts');
	});
});

describe('creating and renewing a Direkteinladung (#2252)', () => {
	it('sends appointment, validity, access and knock on create', async () => {
		vi.mocked(fetchData).mockResolvedValue(invitation);

		await apiCreateDirectLink({
			medium: 'VIDEO',
			topicId: 3,
			appointment: {
				startTime: '2026-11-20T13:00:00.000Z',
				endTime: '2026-11-20T14:00:00.000Z'
			},
			validityAfterEndMinutes: 60,
			accessMode: 'BOTH',
			knock: true
		});

		expect(
			JSON.parse(vi.mocked(fetchData).mock.calls[0][0].bodyData!)
		).toEqual({
			medium: 'VIDEO',
			topicId: 3,
			appointment: {
				startTime: '2026-11-20T13:00:00.000Z',
				endTime: '2026-11-20T14:00:00.000Z'
			},
			validityAfterEndMinutes: 60,
			accessMode: 'BOTH',
			knock: true
		});
	});

	it('"Neuen Link senden" posts to the renewal and returns the new link', async () => {
		vi.mocked(fetchData).mockResolvedValue({
			...invitation,
			token: 'new',
			url: 'https://app.example/invite/new'
		});

		const link = await apiRenewDirectInvitation('9');

		expect(fetchData).toHaveBeenCalledWith(
			expect.objectContaining({
				url: expect.stringMatching(
					/\/service\/users\/directlinks\/9\/renewal$/
				),
				method: FETCH_METHODS.POST
			})
		);
		expect(link.url).toBe('https://app.example/invite/new');
	});

	it('invites more people into a 1:1 for an appointment', async () => {
		vi.mocked(fetchData).mockResolvedValue(invitation);

		const link = await apiCreateSessionDirectInvitation(77, {
			appointment: {
				startTime: '2026-11-20T13:00:00.000Z',
				endTime: '2026-11-20T14:00:00.000Z'
			},
			validityAfterEndMinutes: 1440,
			accessMode: 'GUESTS_ONLY',
			knock: false
		});

		expect(fetchData).toHaveBeenCalledWith(
			expect.objectContaining({
				url: expect.stringMatching(
					/\/service\/users\/sessions\/77\/direct-invitations$/
				),
				method: FETCH_METHODS.POST
			})
		);
		expect(link.joinsExistingSession).toBe(true);
	});
});

describe('"Neuen Link anfragen" (#2252)', () => {
	it('asks for a new link with the old token', async () => {
		vi.mocked(fetchData).mockResolvedValue({});

		await apiRequestDirectInvitationRenewal('old tok');

		expect(fetchData).toHaveBeenCalledWith(
			expect.objectContaining({
				url: expect.stringMatching(
					/\/service\/users\/invitelinks\/old%20tok\/renewal-requests$/
				),
				method: FETCH_METHODS.POST
			})
		);
	});

	/* The backend answers 204; a 202 or a 503 means nothing was stored. */
	it('passes a 503 on instead of reporting success', async () => {
		vi.mocked(fetchData).mockRejectedValue(reply(503));
		await expect(apiRequestDirectInvitationRenewal('tok')).rejects.toEqual(
			expect.objectContaining({ status: 503 })
		);
	});

	it('does not count a 202 as success', async () => {
		vi.mocked(fetchData).mockRejectedValue(reply(202));
		await expect(apiRequestDirectInvitationRenewal('tok')).rejects.toEqual(
			expect.objectContaining({ status: 202 })
		);
	});

	it('passes a refusal on', async () => {
		vi.mocked(fetchData).mockRejectedValue(reply(404));
		await expect(apiRequestDirectInvitationRenewal('tok')).rejects.toEqual(
			expect.objectContaining({ status: 404 })
		);
	});
});

describe('the answers of an expired or restricted link (#2252)', () => {
	it('tells an expired link from a switched-off one', async () => {
		const expired = reply(410, { reason: 'DIRECT_LINK_EXPIRED' });
		const inactive = reply(410, { reason: 'DIRECT_LINK_INACTIVE' });
		expect(await isExpiredDirectLinkError(expired)).toBe(true);
		expect(await isExpiredDirectLinkError(inactive)).toBe(false);
		expect(await isExpiredDirectLinkError(new Error('x'))).toBe(false);
		// Both stay "not usable" for the older checks.
		expect(isInactiveDirectLinkError(expired)).toBe(true);
	});

	it('names the way in a 403 refuses', async () => {
		expect(
			await directInvitationAccessError(
				reply(403, { reason: 'DIRECT_INVITATION_GUESTS_ONLY' })
			)
		).toBe('guests');
		expect(
			await directInvitationAccessError(
				reply(403, { reason: 'DIRECT_INVITATION_ACCOUNTS_ONLY' })
			)
		).toBe('accounts');
		expect(await directInvitationAccessError(reply(403, {}))).toBeNull();
		expect(await directInvitationAccessError(reply(500, {}))).toBeNull();
	});
});
