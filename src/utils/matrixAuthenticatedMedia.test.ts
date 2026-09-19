// @vitest-environment jsdom
/**
 * Authenticated Matrix media (#1487).
 *
 * These are the two things that must not regress, and neither of them can be
 * caught by opening an existing chat: media uploaded before Synapse's
 * `enable_authenticated_media` flip is grandfathered onto the legacy path
 * forever, so the old code keeps *appearing* to work on old attachments and
 * only fails on new ones.
 *
 *   1. The request goes to `/_matrix/client/v1/media/download`, never to the
 *      retired `/_matrix/media/{r0,v1,v3}/download`.
 *   2. It carries the **Matrix** access token. The code this replaced went
 *      through `fetchData()`, which attaches the *Keycloak* token from the
 *      `keycloak` cookie — harmless only while the endpoint ignored
 *      authorization altogether.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
	createAuthenticatedMatrixMediaObjectUrl,
	fetchAuthenticatedMatrixMedia,
	getAuthenticatedMatrixMediaUrl
} from './matrixAuthenticatedMedia';
import { setMatrixClientServiceRef } from '../services/matrixClientRegistry';

const HOMESERVER = 'https://matrix.test';
const MATRIX_TOKEN = 'matrix-access-token';
const KEYCLOAK_TOKEN = 'keycloak-access-token';

/**
 * Minimal stand-in for the live client. `mxcUrlToHttp` mirrors matrix-js-sdk's
 * contract: the seventh argument, `useAuthentication`, is what selects the
 * `/_matrix/client/v1/media` generation.
 */
const createFakeClient = (accessToken: string | null = MATRIX_TOKEN) => ({
	getAccessToken: () => accessToken,
	mxcUrlToHttp: (
		mxcUrl: string,
		_width?: number,
		_height?: number,
		_resizeMethod?: string,
		_allowDirectLinks?: boolean,
		_allowRedirects?: boolean,
		useAuthentication?: boolean
	) => {
		const [serverName, mediaId] = mxcUrl.replace('mxc://', '').split('/');
		return useAuthentication
			? `${HOMESERVER}/_matrix/client/v1/media/download/${serverName}/${mediaId}`
			: `${HOMESERVER}/_matrix/media/v3/download/${serverName}/${mediaId}`;
	}
});

const useClient = (client: unknown) =>
	setMatrixClientServiceRef({ getClient: () => client } as never);

beforeEach(() => {
	// A Keycloak session exists, exactly as it does in the app. Nothing here
	// may pick it up.
	document.cookie = `keycloak=${KEYCLOAK_TOKEN}`;
	useClient(createFakeClient());
});

afterEach(() => {
	setMatrixClientServiceRef(null);
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

describe('getAuthenticatedMatrixMediaUrl', () => {
	it('asks the sdk for the authenticated endpoint', () => {
		expect(getAuthenticatedMatrixMediaUrl('mxc://hs/media-1')).toBe(
			`${HOMESERVER}/_matrix/client/v1/media/download/hs/media-1`
		);
	});

	it('never produces a legacy media path', () => {
		expect(getAuthenticatedMatrixMediaUrl('mxc://hs/media-1')).not.toContain(
			'/_matrix/media/'
		);
	});

	it('returns null for anything that is not homeserver media', () => {
		expect(
			getAuthenticatedMatrixMediaUrl('https://elsewhere.test/photo.png')
		).toBeNull();
		expect(getAuthenticatedMatrixMediaUrl(undefined)).toBeNull();
	});

	it('returns null when no Matrix client is available yet', () => {
		setMatrixClientServiceRef(null);
		expect(getAuthenticatedMatrixMediaUrl('mxc://hs/media-1')).toBeNull();
	});
});

describe('fetchAuthenticatedMatrixMedia', () => {
	it('sends the Matrix access token, not the Keycloak one', async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValue({ ok: true, status: 200 } as never);
		vi.stubGlobal('fetch', fetchMock);

		await fetchAuthenticatedMatrixMedia('mxc://hs/media-1');

		const [url, init] = fetchMock.mock.calls[0];
		expect(url).toBe(
			`${HOMESERVER}/_matrix/client/v1/media/download/hs/media-1`
		);
		expect(init.headers.Authorization).toBe(`Bearer ${MATRIX_TOKEN}`);
		// The bug this replaced, stated as a test rather than as a comment.
		expect(init.headers.Authorization).not.toContain(KEYCLOAK_TOKEN);
	});

	it('throws instead of returning an unusable response', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue({ ok: false, status: 404 } as never)
		);

		await expect(
			fetchAuthenticatedMatrixMedia('mxc://hs/media-1')
		).rejects.toThrow('404');
	});

	it('refuses to download without a Matrix token rather than falling back', async () => {
		useClient(createFakeClient(null));
		const fetchMock = vi.fn();
		vi.stubGlobal('fetch', fetchMock);

		await expect(
			fetchAuthenticatedMatrixMedia('mxc://hs/media-1')
		).rejects.toThrow('access token');
		expect(fetchMock).not.toHaveBeenCalled();
	});
});

describe('createAuthenticatedMatrixMediaObjectUrl', () => {
	it('hands back an object URL an <img> or <a download> can use', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue({
				ok: true,
				status: 200,
				blob: async () => new Blob(['bytes'])
			} as never)
		);
		window.URL.createObjectURL = vi.fn().mockReturnValue('blob:photo');

		await expect(
			createAuthenticatedMatrixMediaObjectUrl(
				'mxc://hs/media-1',
				'image/png'
			)
		).resolves.toBe('blob:photo');
	});
});
