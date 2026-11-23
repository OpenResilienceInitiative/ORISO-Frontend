import { MatrixClient } from 'matrix-js-sdk/lib/client';
import {
	MatrixScheduler,
	MemoryCryptoStore,
	MemoryStore,
	type ICreateClientOpts,
	type IStartClientOpts
} from 'matrix-js-sdk';
import type { SyncApiOptions } from 'matrix-js-sdk/lib/sync';

const cancelledStartup = new Error('Matrix sync startup cancelled');

/** An ORISO client has one lifetime. A refresh creates a fresh SDK client. */
class BrowserMatrixSdkClient extends MatrixClient {
	private stopped = false;
	private starting = false;

	constructor(
		options: ICreateClientOpts,
		private isStartupActive?: () => boolean
	) {
		super(options);
	}

	public override async startClient(
		options?: IStartClientOpts
	): Promise<void> {
		if (this.stopped || this.starting || this.clientRunning) return;
		this.starting = true;
		try {
			await super.startClient(options);
		} catch (error) {
			if (error !== cancelledStartup) throw error;
			if (!this.stopped) this.stopClient();
		} finally {
			this.starting = false;
			this.isStartupActive = undefined;
		}
	}

	public override stopClient(): void {
		this.stopped = true;
		super.stopClient();
	}

	protected override buildSyncApiOptions(): SyncApiOptions {
		// SDK 38.4.0 awaits server versions before creating SyncApi, without
		// rechecking stopClient. This hook runs before that construction.
		if (
			this.starting &&
			(this.stopped || this.isStartupActive?.() === false)
		) {
			throw cancelledStartup;
		}
		return super.buildSyncApiOptions();
	}
}

export const createBrowserMatrixSdkClient = (
	options: ICreateClientOpts,
	isStartupActive?: () => boolean
): MatrixClient =>
	new BrowserMatrixSdkClient(
		{
			...options,
			// Keep matrix-js-sdk createClient's defaults for the browser.
			store:
				options.store ??
				new MemoryStore({ localStorage: globalThis.localStorage }),
			scheduler: options.scheduler ?? new MatrixScheduler(),
			cryptoStore: options.cryptoStore ?? new MemoryCryptoStore()
		},
		isStartupActive
	);
