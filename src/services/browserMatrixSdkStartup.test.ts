// @vitest-environment oriso-jsdom
import type { IServerVersions } from 'matrix-js-sdk';
import { SyncApi } from 'matrix-js-sdk/lib/sync';
import { afterEach, expect, it, vi } from 'vite-plus/test';
import { createMatrixClient } from '../components/sessionCookie/getMatrixAccessToken';

vi.hoisted(() => {
	process.env.REACT_APP_KEYCLOAK_REALM = 'oriso';
});

afterEach(() => vi.restoreAllMocks());

const versions: IServerVersions = {
	versions: ['v1.11'],
	unstable_features: {}
};
const createTestClient = (
	deviceId: string,
	isStartupActive?: () => boolean
) => {
	const client = createMatrixClient(
		{
			userId: '@synthetic:matrix.example.test',
			accessToken: 'fixture-token',
			deviceId,
			homeserverUrl: 'https://matrix.example.test'
		},
		undefined,
		isStartupActive
	);
	vi.spyOn(client.http, 'authedRequest').mockResolvedValue({
		capabilities: {}
	});
	return client;
};

it.each(['response', 'failure'])(
	'starts only the replacement sync after stopping an SDK startup before the versions %s',
	async (result) => {
		const sync = vi
			.spyOn(SyncApi.prototype, 'sync')
			.mockResolvedValue(undefined);
		const outgoing = createTestClient('OUTGOING');
		const replacement = createTestClient('REPLACEMENT');
		const pendingVersions = Promise.withResolvers<IServerVersions>();
		vi.spyOn(outgoing, 'getVersions').mockReturnValue(
			pendingVersions.promise
		);
		vi.spyOn(replacement, 'getVersions').mockResolvedValue(versions);
		try {
			const outgoingStartup = outgoing.startClient();
			outgoing.stopClient();
			await replacement.startClient();

			if (result === 'response') pendingVersions.resolve(versions);
			else pendingVersions.reject(new Error('fixture unavailable'));
			await expect(outgoingStartup).resolves.toBeUndefined();

			expect(sync).toHaveBeenCalledOnce();
			expect(replacement.clientRunning).toBe(true);
		} finally {
			outgoing.stopClient();
			replacement.stopClient();
		}
	}
);

it('honours cancellation from the unpublished startup caller', async () => {
	const sync = vi
		.spyOn(SyncApi.prototype, 'sync')
		.mockResolvedValue(undefined);
	let active = true;
	const client = createTestClient('UNPUBLISHED', () => active);
	const pendingVersions = Promise.withResolvers<IServerVersions>();
	vi.spyOn(client, 'getVersions').mockReturnValue(pendingVersions.promise);
	try {
		const start = client.startClient();
		active = false;
		pendingVersions.resolve(versions);
		await expect(start).resolves.toBeUndefined();

		expect(sync).not.toHaveBeenCalled();
		expect(client.clientRunning).toBe(false);
	} finally {
		client.stopClient();
	}
});
