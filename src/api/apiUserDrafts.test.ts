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
	apiDeleteUserDraft,
	apiFetchUserDrafts,
	apiGetUserDraft,
	apiUpsertUserDraft
} from './apiUserDrafts';
import { fetchData } from './fetchData';
import { DRAFTS_UPDATED_EVENT } from '../services/draftStore';

const state = vi.hoisted(() => ({
	token: 'current-authenticated-session',
	crypto: null as null | {
		opaqueScope: ReturnType<typeof vi.fn>;
		seal: ReturnType<typeof vi.fn>;
		open: ReturnType<typeof vi.fn>;
	}
}));

vi.mock('../components/sessionCookie/accessSessionCookie', () => ({
	getValueFromCookie: () => state.token
}));
vi.mock('../resources/scripts/endpoints', () => ({
	endpoints: { userDrafts: '/service/users/drafts' }
}));
vi.mock('../services/draftCryptographyWindow', () => ({
	getDraftCryptographyForWindow: () => state.crypto
}));
vi.mock('../services/draftCryptography', () => ({
	isOpaqueDraftScope: (value: string) =>
		/^draft\.v1\.[A-Za-z0-9_-]{43}$/.test(value)
}));
vi.mock('./fetchData', () => ({
	fetchData: vi.fn(),
	FETCH_ERRORS: {
		CATCH_ALL: 'CATCH_ALL',
		CATCH_ALL_WITH_RESPONSE: 'CATCH_ALL_WITH_RESPONSE',
		EMPTY: 'EMPTY'
	},
	FETCH_METHODS: {
		GET: 'GET',
		PATCH: 'PATCH',
		DELETE: 'DELETE',
		POST: 'POST'
	},
	FETCH_SUCCESS: { CONTENT: 'CONTENT' }
}));

const logical = 'scope:!fictional-room:example.org|thread:main';
const opaque = 'draft.v1.' + 'B'.repeat(43);
const envelope = 'draft.v1.example-iv.example-ciphertext';
const revision = 'C'.repeat(43);
const encryptedRevision = 'D'.repeat(43);
const clear = {
	scopeKey: logical,
	text: 'A private fictional draft',
	title: 'Private title',
	actionPath: '/sessions/consultant/sessionView/fictional/8',
	sourceSessionId: 8,
	roomRef: '!fictional-room:example.org',
	threadRootId: null
};
const rawLegacy = { id: 1, revision, ...clear };
const rawProtected = {
	id: 2,
	revision: encryptedRevision,
	scopeKey: opaque,
	text: envelope
};
const network = vi.mocked(fetchData);

beforeEach(() => {
	state.token = 'current-authenticated-session';
	state.crypto = {
		opaqueScope: vi.fn().mockResolvedValue(opaque),
		seal: vi.fn().mockResolvedValue(envelope),
		open: vi.fn().mockResolvedValue(clear)
	};
	network.mockReset();
});
afterEach(() => vi.restoreAllMocks());

describe('authenticated protected drafts', () => {
	it('sends only an opaque scope and authenticated ciphertext, and emits a content-free change', async () => {
		network.mockImplementation(async ({ method }) =>
			method === 'GET' ? { items: [], page: 0, perPage: 200 } : undefined
		);
		const dispatch = vi.spyOn(window, 'dispatchEvent');
		await apiUpsertUserDraft(logical, clear);
		await apiDeleteUserDraft(logical);
		expect(network.mock.calls.map(([request]) => request.method)).toEqual([
			'PATCH',
			'GET',
			'DELETE'
		]);
		expect(network.mock.calls[0][0]).toMatchObject({
			url: '/service/users/drafts/protected?scopeKey=' + opaque,
			bodyData: JSON.stringify({ text: envelope }),
			headersData: {
				Authorization: 'Bearer current-authenticated-session'
			},
			recoverOnPublicAuthRoute: false,
			referrerPolicy: 'no-referrer'
		});
		expect(state.crypto?.seal).toHaveBeenCalledWith(opaque, clear);
		const events = dispatch.mock.calls.map(([event]) => event);
		expect(events.map((event) => event.type)).toEqual([
			DRAFTS_UPDATED_EVENT,
			DRAFTS_UPDATED_EVENT
		]);
		expect(events.some((event) => 'detail' in event)).toBe(false);
	});

	it('makes no request while recovery is locked', async () => {
		state.crypto = null;
		await apiUpsertUserDraft(logical, clear);
		await apiDeleteUserDraft(logical);
		await expect(apiGetUserDraft(logical)).resolves.toBeNull();
		await expect(apiFetchUserDrafts()).resolves.toMatchObject({
			items: []
		});
		expect(network).not.toHaveBeenCalled();
	});

	it('drops a result if the authentication cookie changes during encryption', async () => {
		state.crypto?.seal.mockImplementation(async () => {
			state.token = 'another-user-session';
			return envelope;
		});
		await apiUpsertUserDraft(logical, clear);
		expect(network).not.toHaveBeenCalled();
	});

	it('opens and displays only authentic rows for the exact logical scope', async () => {
		network.mockResolvedValue(rawProtected);
		await expect(apiGetUserDraft(logical)).resolves.toMatchObject({
			...clear,
			opaqueScopeKey: opaque
		});
		state.crypto?.open.mockRejectedValue(new Error('tampered'));
		await expect(apiGetUserDraft(logical)).resolves.toBeNull();
	});

	it('migrates with only the numeric id and revisions, then retires after decrypted readback', async () => {
		network
			.mockRejectedValueOnce(new Error('EMPTY'))
			.mockResolvedValueOnce({
				items: [rawLegacy],
				page: 0,
				perPage: 200
			})
			.mockRejectedValueOnce(new Error('EMPTY'))
			.mockResolvedValueOnce(undefined)
			.mockResolvedValueOnce(rawProtected)
			.mockResolvedValueOnce(undefined);
		await expect(apiGetUserDraft(logical)).resolves.toMatchObject({
			...clear,
			opaqueScopeKey: opaque
		});
		expect(network.mock.calls.map(([request]) => request.method)).toEqual([
			'GET',
			'GET',
			'GET',
			'POST',
			'GET',
			'DELETE'
		]);
		expect(network.mock.calls[3][0].bodyData).toBe(
			JSON.stringify({
				legacyId: 1,
				legacyRevision: revision,
				targetScopeKey: opaque,
				text: envelope
			})
		);
		const retire = network.mock.calls[5][0].url;
		expect(retire).toContain('/legacy/1?');
		expect(retire).toContain('targetRevision=' + encryptedRevision);
		expect(
			network.mock.calls.every(
				([request]) =>
					!decodeURIComponent(request.url).includes(logical)
			)
		).toBe(true);
	});

	it('retains the legacy row when a success response has no verifiable replacement', async () => {
		network
			.mockRejectedValueOnce(new Error('EMPTY'))
			.mockResolvedValueOnce({
				items: [rawLegacy],
				page: 0,
				perPage: 200
			})
			.mockRejectedValueOnce(new Error('EMPTY'))
			.mockResolvedValueOnce(undefined)
			.mockRejectedValueOnce(new Error('EMPTY'));
		await expect(apiGetUserDraft(logical)).resolves.toMatchObject(clear);
		expect(
			network.mock.calls.some(([request]) => request.method === 'DELETE')
		).toBe(false);
	});

	it('never retires legacy data when a different newer protected version won the race', async () => {
		network
			.mockRejectedValueOnce(new Error('EMPTY'))
			.mockResolvedValueOnce({
				items: [rawLegacy],
				page: 0,
				perPage: 200
			})
			.mockResolvedValueOnce(rawProtected);
		state.crypto?.open.mockResolvedValue({
			...clear,
			text: 'Newer encrypted draft'
		});
		await expect(apiGetUserDraft(logical)).resolves.toMatchObject({
			text: 'Newer encrypted draft'
		});
		expect(
			network.mock.calls.every(([request]) => request.method === 'GET')
		).toBe(true);
	});

	it('rejects a valid protected row from another exact scope before opening it', async () => {
		network.mockResolvedValue({
			...rawProtected,
			scopeKey: 'draft.v1.' + 'X'.repeat(43)
		});
		await expect(apiGetUserDraft(logical)).resolves.toBeNull();
		expect(state.crypto?.open).not.toHaveBeenCalled();
	});

	it('keeps the protected draft when the legacy row changes during retirement', async () => {
		const page = { items: [rawLegacy], page: 0, perPage: 200 };
		network
			.mockResolvedValueOnce(page)
			.mockResolvedValueOnce(rawProtected)
			.mockRejectedValueOnce(new Response(null, { status: 409 }))
			.mockResolvedValueOnce({
				...page,
				items: [{ ...rawLegacy, text: 'Concurrent edit' }]
			});
		await apiDeleteUserDraft(logical);
		expect(
			network.mock.calls
				.filter(([request]) => request.method === 'DELETE')
				.map(([request]) => request.url)
		).toEqual([expect.stringContaining('/legacy/1?')]);
	});

	it('never renders an unknown ciphertext version as legacy draft text', async () => {
		network.mockResolvedValue({
			items: [{ ...rawLegacy, text: 'draft.v2.opaque' }],
			page: 0,
			perPage: 200
		});
		await expect(apiFetchUserDrafts()).resolves.toMatchObject({
			items: []
		});
		expect(network).toHaveBeenCalledOnce();
	});

	it('rejects untrusted migration row IDs before any mutation', async () => {
		network
			.mockRejectedValueOnce(new Error('EMPTY'))
			.mockResolvedValueOnce({
				items: [{ ...rawLegacy, id: '../../users/8' }],
				page: 0,
				perPage: 200
			})
			.mockResolvedValueOnce(rawProtected);
		await expect(apiGetUserDraft(logical)).resolves.toMatchObject(clear);
		expect(
			network.mock.calls.every(([request]) => request.method === 'GET')
		).toBe(true);
	});
});
