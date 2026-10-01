/**
 * Authenticated Matrix media (#1487).
 *
 * Synapse's `enable_authenticated_media` retires the unauthenticated
 * `/_matrix/media/{r0,v1,v3}/download` and `/thumbnail` endpoints. Media
 * uploaded after that flip answers `404 M_NOT_FOUND` there, while media
 * uploaded before it is grandfathered and keeps working on the old path
 * forever. The breakage therefore only ever shows up on *new* files, days
 * after the flip, and a 404 in the UI is indistinguishable from "this file was
 * deleted". Verifying this path with an existing attachment proves nothing.
 *
 * The replacement is `GET /_matrix/client/v1/media/download/...`, which
 * requires `Authorization: Bearer <matrix access token>` and also serves
 * grandfathered media — so it is correct both before and after the flip.
 *
 * Two things follow, and they are the whole reason this module exists rather
 * than a string replacement at the call sites:
 *
 *  1. **A browser cannot put a header on `<img src>`, `<a href>` or an audio
 *     source.** The bytes have to be fetched in JavaScript and handed on as an
 *     object URL. `ORISO-ElementCall/src/Avatar.tsx` does exactly this for
 *     avatars and is the in-house reference for the shape below.
 *  2. **The token must be the Matrix one.** `fetchData()` attaches the
 *     *Keycloak* access token from the `keycloak` cookie
 *     (`src/api/fetchData.ts`). That went unnoticed only because the legacy
 *     endpoint ignored authorization altogether; on the authenticated endpoint
 *     Synapse rejects it. Everything here goes through the live
 *     `MatrixClient`, whose token is by definition the one the homeserver
 *     accepts, and whose `baseUrl` is where that token is valid.
 */
import { useEffect, useState } from 'react';
import { getMatrixClientService } from '../services/matrixClientRegistry';

/** Path of the authenticated download endpoint, for tests and assertions. */
export const MATRIX_AUTHENTICATED_MEDIA_DOWNLOAD_PATH =
	'/_matrix/client/v1/media/download';

const MXC_PREFIX = 'mxc://';

export const isMxcUri = (value?: string | null): boolean =>
	typeof value === 'string' && value.startsWith(MXC_PREFIX);

/**
 * Resolve an `mxc://` URI to its authenticated HTTP URL.
 *
 * The URL is built by matrix-js-sdk rather than by hand: the seventh argument
 * is `useAuthentication`, which is what selects the `/_matrix/client/v1/media`
 * generation. `allowDirectLinks` stays `false` so a non-mxc URL is never
 * silently fetched — that would leak the user to a third-party host.
 *
 * Returns `null` when there is no Matrix client yet, or the URI is not media.
 */
export const getAuthenticatedMatrixMediaUrl = (
	mxcUrl?: string | null
): string | null => {
	if (!isMxcUri(mxcUrl)) {
		return null;
	}
	const client = getMatrixClientService()?.getClient();
	if (!client) {
		return null;
	}
	return (
		client.mxcUrlToHttp(
			mxcUrl as string,
			undefined,
			undefined,
			undefined,
			false,
			true,
			true
		) || null
	);
};

/**
 * Fetch Matrix media with the Matrix access token.
 *
 * Returns the raw `Response` so callers can choose `blob()` (plaintext) or
 * `arrayBuffer()` (E2EE ciphertext, which still has to be decrypted).
 * Throws rather than resolving to something unusable, so a failure surfaces as
 * a failure instead of as an empty image.
 */
export const fetchAuthenticatedMatrixMedia = async (
	mxcUrl: string
): Promise<Response> => {
	const client = getMatrixClientService()?.getClient();
	if (!client) {
		throw new Error(
			'Cannot download Matrix media: no Matrix client is available'
		);
	}
	const accessToken = client.getAccessToken();
	if (!accessToken) {
		throw new Error(
			'Cannot download Matrix media: the Matrix client has no access token'
		);
	}
	const url = getAuthenticatedMatrixMediaUrl(mxcUrl);
	if (!url) {
		throw new Error(`Not a Matrix media URI: ${mxcUrl}`);
	}

	const response = await fetch(url, {
		headers: { Authorization: `Bearer ${accessToken}` }
	});
	if (!response.ok) {
		throw new Error(
			`Matrix media download failed with ${response.status} for ${mxcUrl}`
		);
	}
	return response;
};

/**
 * Fetch Matrix media and hand back an object URL an `<img>`, `<a download>` or
 * audio element can use. The caller owns the revoke; the hook below does it.
 */
export const createAuthenticatedMatrixMediaObjectUrl = async (
	mxcUrl: string,
	mimeType?: string
): Promise<string> => {
	const response = await fetchAuthenticatedMatrixMedia(mxcUrl);
	const blob = await response.blob();
	return window.URL.createObjectURL(
		mimeType ? new Blob([blob], { type: mimeType }) : blob
	);
};

/**
 * Object URL for a piece of unencrypted Matrix media, or `null` while it is
 * loading, when `mxcUrl` is `null` (the caller does not want it fetched yet —
 * an unrevealed guest image must not be requested at all), or when the fetch
 * failed.
 *
 * The object URL is revoked on unmount and whenever the URI changes, so a long
 * chat does not accumulate blobs.
 */
export const useAuthenticatedMatrixMediaUrl = (
	mxcUrl?: string | null,
	mimeType?: string
): string | null => {
	const [objectUrl, setObjectUrl] = useState<string | null>(null);

	useEffect(() => {
		if (!isMxcUri(mxcUrl)) {
			setObjectUrl(null);
			return;
		}

		let cancelled = false;
		let createdUrl: string | null = null;

		createAuthenticatedMatrixMediaObjectUrl(mxcUrl as string, mimeType)
			.then((url) => {
				if (cancelled) {
					window.URL.revokeObjectURL(url);
					return;
				}
				createdUrl = url;
				setObjectUrl(url);
			})
			.catch(() => {
				if (!cancelled) {
					setObjectUrl(null);
				}
			});

		return () => {
			cancelled = true;
			if (createdUrl) {
				window.URL.revokeObjectURL(createdUrl);
			}
		};
	}, [mxcUrl, mimeType]);

	return objectUrl;
};
