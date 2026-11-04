// @vitest-environment oriso-jsdom
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import {
	directLinkCallsAllowed,
	directLinkMediumOf,
	directLinkSessionOf,
	isDirectLinkCallRoom,
	directLinkReturnPath,
	loginPathForDirectLink,
	openDirectLinkConversation,
	readPendingKnock
} from './directLinkEntryFlow';

vi.mock('../registration/autoLogin', () => ({ redirectToApp: vi.fn() }));
vi.mock('../../api/apiGetConsultingType', () => ({
	apiGetConsultingType: vi.fn()
}));
const { apiGetConsultingType } = await import('../../api/apiGetConsultingType');

beforeEach(() => {
	sessionStorage.clear();
	localStorage.clear();
});

const context = (chatType: string, admission: 'DIRECT' | 'KNOCK' | null) => ({
	tenantId: 1,
	agencyId: 2,
	consultingTypeId: 3,
	topicId: 4,
	chatType,
	admission
});

describe('directLinkMediumOf', () => {
	it('knows a direct link by its admission', () => {
		expect(directLinkMediumOf(context('VIDEO', 'KNOCK'))).toBe('VIDEO');
		expect(directLinkMediumOf(context('CHAT', 'DIRECT'))).toBe('CHAT');
	});

	it('leaves every other link kind alone', () => {
		expect(directLinkMediumOf(context('LIVE_CHAT', null))).toBeNull();
		expect(directLinkMediumOf(null)).toBeNull();
	});
});

describe('openDirectLinkConversation', () => {
	it('enters a chat conversation directly and keeps no knock', async () => {
		const redirect = vi.fn();
		await openDirectLinkConversation('tok', {
			start: vi.fn().mockResolvedValue({
				sessionId: 9,
				medium: 'CHAT',
				admission: 'DIRECT',
				created: true
			}),
			redirect
		});
		expect(redirect).toHaveBeenCalledWith(9);
		expect(readPendingKnock()).toBeNull();
		// A chat conversation never knocks, so it is not remembered.
		expect(directLinkSessionOf(9)).toBeNull();
	});

	it('hands the knock of a call to the app', async () => {
		const redirect = vi.fn();
		await openDirectLinkConversation('tok', {
			start: vi.fn().mockResolvedValue({
				sessionId: 9,
				matrixRoomId: '!room:oriso',
				medium: 'VIDEO',
				admission: 'KNOCK',
				created: false,
				knockId: 21,
				knockStatus: 'PENDING'
			}),
			redirect
		});
		expect(readPendingKnock()).toEqual({
			token: 'tok',
			knockId: 21,
			sessionId: 9,
			matrixRoomId: '!room:oriso',
			medium: 'VIDEO',
			status: 'PENDING'
		});
		expect(redirect).toHaveBeenCalledWith(9);
		// FE#1893: a later call in this conversation knocks through the link.
		expect(directLinkSessionOf(9)).toEqual({
			token: 'tok',
			medium: 'VIDEO',
			matrixRoomId: '!room:oriso'
		});
		expect(isDirectLinkCallRoom('!room:oriso')).toBe(true);
		expect(isDirectLinkCallRoom('!other:oriso')).toBe(false);
	});

	it('enters nothing when the link refuses', async () => {
		const redirect = vi.fn();
		await expect(
			openDirectLinkConversation('tok', {
				start: vi
					.fn()
					.mockRejectedValue(new Response('', { status: 410 })),
				redirect
			})
		).rejects.toBeInstanceOf(Response);
		expect(redirect).not.toHaveBeenCalled();
	});
});

describe('sign-in return path', () => {
	it('comes back to the link after the login', () => {
		expect(loginPathForDirectLink('Ab_9-x')).toBe(
			'/login?returnTo=%2Finvite%2FAb_9-x'
		);
		expect(directLinkReturnPath('/invite/Ab_9-x')).toBe('/invite/Ab_9-x');
	});

	it('lets nothing else through', () => {
		expect(directLinkReturnPath('//evil.example/invite/x')).toBeNull();
		expect(directLinkReturnPath('/invite/x/../../profile')).toBeNull();
		expect(directLinkReturnPath('https://evil.example')).toBeNull();
		expect(directLinkReturnPath(null)).toBeNull();
	});
});

describe('directLinkCallsAllowed (#2012)', () => {
	const link = context('VIDEO', 'KNOCK');

	it('allows calls only where the consulting type says so', async () => {
		vi.mocked(apiGetConsultingType).mockResolvedValue({
			isVideoCallAllowed: true
		} as never);
		expect(await directLinkCallsAllowed(link)).toBe(true);
		vi.mocked(apiGetConsultingType).mockResolvedValue({
			isVideoCallAllowed: false
		} as never);
		expect(await directLinkCallsAllowed(link)).toBe(false);
		vi.mocked(apiGetConsultingType).mockResolvedValue({} as never);
		expect(await directLinkCallsAllowed(link)).toBe(false);
	});

	it('leaves the decision to the server when it cannot read', async () => {
		vi.mocked(apiGetConsultingType).mockResolvedValue(null as never);
		expect(await directLinkCallsAllowed(link)).toBe(true);
		vi.mocked(apiGetConsultingType).mockRejectedValue(new Error('down'));
		expect(await directLinkCallsAllowed(link)).toBe(true);
		vi.mocked(apiGetConsultingType).mockClear();
		expect(
			await directLinkCallsAllowed({ ...link, consultingTypeId: null })
		).toBe(true);
		expect(apiGetConsultingType).not.toHaveBeenCalled();
	});

	it('gives up on a read that does not answer', async () => {
		vi.mocked(apiGetConsultingType).mockReturnValue(
			new Promise(() => undefined)
		);
		expect(await directLinkCallsAllowed(link, 20)).toBe(true);
	});
});
