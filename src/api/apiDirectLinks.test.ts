// @vitest-environment oriso-jsdom
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import { fetchData, FETCH_METHODS } from './fetchData';
import {
	apiCancelOwnCallKnock,
	apiCreateDirectLink,
	apiGetDirectLinks,
	apiGetOwnCallKnock,
	apiStartDirectLinkConversation,
	apiUpdateDirectLink,
	isInactiveDirectLinkError,
	toDirectLink
} from './apiDirectLinks';

vi.mock('./fetchData', async () => {
	const actual =
		await vi.importActual<typeof import('./fetchData')>('./fetchData');
	return { ...actual, fetchData: vi.fn(() => Promise.resolve({})) };
});

beforeEach(() => vi.clearAllMocks());

const call = () =>
	vi.mocked(fetchData).mock.calls[0][0] as {
		url: string;
		method: string;
		bodyData?: string;
		responseHandling?: string[];
	};

describe('direct link API (ORISO-UserService#1479)', () => {
	it('lists, creates and switches the counsellor’s links', async () => {
		vi.mocked(fetchData).mockResolvedValueOnce([{ id: 1 }]);
		await expect(apiGetDirectLinks()).resolves.toEqual([{ id: 1 }]);
		expect(call()).toMatchObject({
			url: expect.stringMatching(/\/service\/users\/directlinks$/),
			method: FETCH_METHODS.GET
		});

		vi.clearAllMocks();
		await apiCreateDirectLink({
			medium: 'VIDEO',
			topicId: 4,
			temporary: true
		});
		expect(call()).toMatchObject({
			method: FETCH_METHODS.POST,
			bodyData: JSON.stringify({
				medium: 'VIDEO',
				topicId: 4,
				temporary: true
			})
		});

		vi.clearAllMocks();
		await apiUpdateDirectLink('17', { active: false });
		expect(call()).toMatchObject({
			url: expect.stringMatching(/\/directlinks\/17$/),
			method: FETCH_METHODS.PATCH,
			bodyData: '{"active":false}'
		});
	});

	it('treats a non-list answer as no links', async () => {
		vi.mocked(fetchData).mockResolvedValueOnce({});
		await expect(apiGetDirectLinks()).resolves.toEqual([]);
	});

	it('opens the person’s conversation and reads or withdraws the knock', async () => {
		await apiStartDirectLinkConversation('a/b');
		expect(call()).toMatchObject({
			url: expect.stringMatching(/\/invitelinks\/a%2Fb\/conversations$/),
			method: FETCH_METHODS.POST
		});
		vi.clearAllMocks();
		await apiGetOwnCallKnock(5);
		expect(call().url).toMatch(/\/call-knocks\/mine\/5$/);
		vi.clearAllMocks();
		await apiCancelOwnCallKnock(5);
		expect(call()).toMatchObject({ method: FETCH_METHODS.DELETE });
	});

	it('maps the DTO onto the Storybook model, naming the topic', () => {
		expect(
			toDirectLink({
				id: 3,
				token: 't',
				url: 'https://app/invite/t',
				name: '  ',
				topicId: 4,
				topicName: 'Schulden',
				medium: 'AUDIO',
				temporary: true,
				active: false,
				admission: 'KNOCK'
			})
		).toEqual({
			id: '3',
			name: 'Schulden',
			topic: 'Schulden',
			medium: 'AUDIO',
			temporary: true,
			active: false,
			url: 'https://app/invite/t'
		});
	});

	it('recognises a switched-off link by its 410', () => {
		expect(
			isInactiveDirectLinkError(new Response('', { status: 410 }))
		).toBe(true);
		expect(
			isInactiveDirectLinkError(new Response('', { status: 404 }))
		).toBe(false);
		expect(isInactiveDirectLinkError(new Error('CATCH_ALL'))).toBe(false);
	});
});
