import { createClient, Method } from 'matrix-js-sdk';
import { SECRET_STORAGE_ALGORITHM_V1_AES } from 'matrix-js-sdk/lib/secret-storage';
import { getDraftAuthSessionIdentity } from '../src/services/draftAuthSession';
import {
	bindDraftCryptographyClient,
	getDraftCryptography,
	subscribeDraftCryptography,
	unlockDraftCryptography
} from '../src/services/draftCryptography';
import { serverBackedSecretStorage } from '../src/services/matrixRecoveryAccountData';

export const initDraftKeys = async (owner: object, signal: AbortSignal) => {
	const userId = '@draft:storybook.invalid';
	const rootId = 'draft-story-root';
	const rootKey = crypto.getRandomValues(new Uint8Array(32));
	const accountData = new Map<string, unknown>([
		['m.secret_storage.default_key', { key: rootId }]
	]);
	const client = createClient({
		baseUrl: 'https://storybook.invalid',
		userId,
		fetchFn: async () => {
			throw new Error('No network in the 4S fixture');
		}
	});
	client.setAccountData = client.setAccountDataRaw.bind(client);
	client.http.authedRequest = async <T>(
		method: Method,
		path: string,
		_query,
		body
	) => {
		const prefix = `/user/${encodeURIComponent(userId)}/account_data/`;
		if (!path.startsWith(prefix))
			throw new Error('Unexpected Matrix fixture path');
		const name = decodeURIComponent(path.slice(prefix.length));
		if (method === Method.Put) {
			accountData.set(name, body);
			return {} as T;
		}
		if (method === Method.Get && accountData.has(name))
			return accountData.get(name) as T;
		throw Object.assign(new Error('No fixture account data'), {
			errcode: 'M_NOT_FOUND'
		});
	};
	const storage = serverBackedSecretStorage(client, {
		getSecretStorageKey: async () => [rootId, rootKey]
	});
	try {
		await storage.addKey(
			SECRET_STORAGE_ALGORITHM_V1_AES,
			{ key: rootKey },
			rootId
		);
		signal.throwIfAborted();
		bindDraftCryptographyClient(owner, client, userId);
		await unlockDraftCryptography(client, storage, rootKey, signal, rootId);
		const cryptography = getDraftCryptography();
		if (!cryptography)
			throw new Error('The 4S draft fixture did not unlock');
		return cryptography;
	} finally {
		rootKey.fill(0);
	}
};

export const installStoryFrameAccess = (scope: string) => {
	if (window.parent === window) return () => {};
	const child = window;
	const childDocument = document;
	const identity = getDraftAuthSessionIdentity();
	const bridge = Symbol.for('oriso.draftCryptographyFrame');
	type FrameAccess = {
		get: typeof getDraftCryptography;
		subscribe: typeof subscribeDraftCryptography;
	};
	const parent = child.parent as Window & {
		[bridge]?: (source: Window, identity: string) => FrameAccess | null;
	};
	if (
		parent.location.origin !== child.location.origin ||
		!identity ||
		parent[bridge]
	) {
		throw new Error('Draft story requires an isolated same-origin preview');
	}
	const previousUrl = child.location.href;
	const preview = new URL(previousUrl);
	preview.searchParams.set('embeddedNotifications', '1');
	preview.searchParams.set('draftScopeKey', scope);
	child.history.replaceState(child.history.state, '', preview);
	// Storybook owns the preview iframe. Give only this synthetic document
	// access to the real fixture keys; the production frame bridge is tested separately.
	const resolve = (source: Window, caller: string) =>
		source === child &&
		caller === identity &&
		source.document === childDocument
			? {
					get: getDraftCryptography,
					subscribe: subscribeDraftCryptography
				}
			: null;
	parent[bridge] = resolve;
	return () => {
		if (parent[bridge] === resolve) delete parent[bridge];
		if (child.location.href === preview.href)
			child.history.replaceState(child.history.state, '', previousUrl);
	};
};
