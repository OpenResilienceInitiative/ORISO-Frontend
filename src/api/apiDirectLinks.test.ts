// @vitest-environment oriso-jsdom
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import { fetchData, FETCH_ERRORS, FETCH_METHODS } from './fetchData';
import {
	apiCancelOwnCallKnock,
	apiCreateDirectLink,
	apiGetOwnCallKnock,
	apiGetOwnDirectLinks,
	apiStartDirectLinkConversation,
	apiUpdateDirectLink,
	DIRECT_LINKS_CHANGED_EVENT,
	isInactiveDirectLinkError,
	notifyDirectLinksChanged,
	toDirectLink
} from './apiDirectLinks';

vi.mock('./fetchData', async () => {
	const actual =
		await vi.importActual<typeof import('./fetchData')>('./fetchData');
	return { ...actual, fetchData: vi.fn() };
});

const dto = {
	id: 7,
	token: 'abc',
	url: 'https://app.example/invite/abc',
	name: 'Flyer Schule',
	topicId: 3,
	topicName: 'Schulden',
	agencyId: 11,
	medium: 'VIDEO',
	temporary: true,
	active: false,
	admission: 'KNOCK'
};

beforeEach(() => vi.clearAllMocks());

describe('toDirectLink', () => {
	it('maps the UserService DTO onto the tile model', () => {
		expect(toDirectLink(dto)).toEqual({
			id: '7',
			name: 'Flyer Schule',
			topic: 'Schulden',
			topicId: 3,
			agencyId: 11,
			medium: 'VIDEO',
			temporary: true,
			active: false,
			url: 'https://app.example/invite/abc'
		});
	});

	it('makes a relative entry URL absolute on the current host', () => {
		const link = toDirectLink({ ...dto, url: '/invite/abc' });
		expect(link.url).toBe(`${window.location.origin}/invite/abc`);
	});

	it('names an unnamed link after its topic', () => {
		expect(toDirectLink({ ...dto, name: undefined }).name).toBe('Schulden');
	});

	it('drops entries with an unknown medium', () => {
		expect(toDirectLink({ ...dto, medium: 'FAX' })).toBeNull();
	});
});

describe('apiGetOwnDirectLinks', () => {
	it('reads the caller’s links and keeps valid ones', async () => {
		vi.mocked(fetchData).mockResolvedValue([dto, { ...dto, medium: 'X' }]);

		const links = await apiGetOwnDirectLinks();

		expect(fetchData).toHaveBeenCalledWith(
			expect.objectContaining({
				url: expect.stringMatching(/\/service\/users\/directlinks$/),
				method: FETCH_METHODS.GET
			})
		);
		expect(links).toHaveLength(1);
		expect(links[0].id).toBe('7');
	});

	it('treats an empty answer as no links', async () => {
		vi.mocked(fetchData).mockRejectedValue(new Error(FETCH_ERRORS.EMPTY));
		await expect(apiGetOwnDirectLinks()).resolves.toEqual([]);
	});

	it('passes other failures on', async () => {
		vi.mocked(fetchData).mockRejectedValue(new Error('boom'));
		await expect(apiGetOwnDirectLinks()).rejects.toThrow('boom');
	});
});

describe('apiUpdateDirectLink', () => {
	it('sends only the changed fields as PATCH', async () => {
		vi.mocked(fetchData).mockResolvedValue({ ...dto, active: true });

		const link = await apiUpdateDirectLink('7', { active: true });

		expect(fetchData).toHaveBeenCalledWith(
			expect.objectContaining({
				url: expect.stringMatching(/\/service\/users\/directlinks\/7$/),
				method: FETCH_METHODS.PATCH,
				bodyData: JSON.stringify({ active: true })
			})
		);
		expect(link.active).toBe(true);
	});

	it('rejects an answer it cannot read', async () => {
		vi.mocked(fetchData).mockResolvedValue({});
		await expect(
			apiUpdateDirectLink('7', { name: 'Neu' })
		).rejects.toThrow();
	});
});

describe('apiCreateDirectLink', () => {
	it('posts the new link and answers the tile model', async () => {
		vi.mocked(fetchData).mockResolvedValue(dto);
		const link = await apiCreateDirectLink({
			medium: 'VIDEO',
			topicId: 3,
			temporary: true
		});
		expect(fetchData).toHaveBeenCalledWith(
			expect.objectContaining({
				url: expect.stringMatching(/\/service\/users\/directlinks$/),
				method: FETCH_METHODS.POST,
				bodyData: JSON.stringify({
					medium: 'VIDEO',
					topicId: 3,
					temporary: true
				})
			})
		);
		expect(link.id).toBe('7');
	});

	it('treats a non-list answer as no links', async () => {
		vi.mocked(fetchData).mockResolvedValue({});
		await expect(apiGetOwnDirectLinks()).resolves.toEqual([]);
	});
});

describe('the person’s side', () => {
	it('opens the conversation and reads or withdraws the knock', async () => {
		vi.mocked(fetchData).mockResolvedValue({});
		await apiStartDirectLinkConversation('a/b');
		expect(vi.mocked(fetchData).mock.calls[0][0]).toMatchObject({
			url: expect.stringMatching(/\/invitelinks\/a%2Fb\/conversations$/),
			method: FETCH_METHODS.POST
		});
		vi.clearAllMocks();
		vi.mocked(fetchData).mockResolvedValue({});
		await apiGetOwnCallKnock(5);
		expect(vi.mocked(fetchData).mock.calls[0][0].url).toMatch(
			/\/call-knocks\/mine\/5$/
		);
		vi.clearAllMocks();
		vi.mocked(fetchData).mockResolvedValue({});
		await apiCancelOwnCallKnock(5);
		expect(vi.mocked(fetchData).mock.calls[0][0]).toMatchObject({
			method: FETCH_METHODS.DELETE
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

describe('notifyDirectLinksChanged', () => {
	it('announces a change on the window', () => {
		const changed = vi.fn();
		window.addEventListener(DIRECT_LINKS_CHANGED_EVENT, changed);
		notifyDirectLinksChanged();
		window.removeEventListener(DIRECT_LINKS_CHANGED_EVENT, changed);
		expect(changed).toHaveBeenCalledOnce();
	});
});
