export const LIVE_CHAT_AVAILABILITY_STORAGE_KEY = 'oriso_liveChatAvailability';
export const LIVE_CHAT_AVAILABILITY_CHANGE_EVENT =
	'oriso:liveChatAvailabilityChange';
/**
 * Why the last automatic switch-off happened, for the counsellor's other tabs
 * (#1485). Only read from `storage` events, never on load, so an old reason
 * cannot resurface; removed when she switches on or off herself.
 */
export const LIVE_CHAT_AVAILABILITY_LOSS_STORAGE_KEY =
	'oriso_liveChatAvailabilityLoss';
/**
 * When any of the counsellor's tabs last had a heartbeat acknowledged (epoch
 * ms). The server counts her as long as one tab renews the lease, so a tab
 * that lost its own connection checks this before switching everyone off.
 */
export const LIVE_CHAT_AVAILABILITY_ACK_STORAGE_KEY =
	'oriso_liveChatAvailabilityAck';

/**
 * An acknowledged renewal (enable or heartbeat), in epoch ms. The server
 * started the lease no earlier than `sentAt`, so the lease is counted from
 * there; `ackedAt` is when the answer arrived. `generation` goes up with
 * every recorded acknowledgement, so "recorded after this request was sent"
 * holds even within one millisecond.
 */
export interface LiveChatAcknowledgement {
	sentAt: number;
	ackedAt: number;
	generation: number;
}

/**
 * This tab's own copy, merged with the shared record on every read (newest
 * field wins): with Web Storage disabled or full, the tab still counts the
 * lease its own renewals started.
 */
let ownAcknowledgement: LiveChatAcknowledgement = {
	sentAt: 0,
	ackedAt: 0,
	generation: 0
};
/** Forget the lease times (switched off, session over); generations only rise. */
const forgetOwnAcknowledgement = (): void => {
	ownAcknowledgement = {
		sentAt: 0,
		ackedAt: 0,
		generation: ownAcknowledgement.generation
	};
};

/**
 * Changes whenever the session's live-chat keys are cleared (logout, any
 * teardown), in this tab and — through localStorage — in every other tab. A
 * request sent in an older session must not write the keys back.
 */
export const LIVE_CHAT_SESSION_EPOCH_STORAGE_KEY = 'oriso_liveChatSessionEpoch';
let liveChatSessionEpoch = 0;
export const readLiveChatSessionEpoch = (): string => {
	let shared: string | null = null;
	try {
		shared = localStorage.getItem(LIVE_CHAT_SESSION_EPOCH_STORAGE_KEY);
	} catch {
		/* Without storage the tab-local counter still guards this tab. */
	}
	return `${shared ?? ''}#${liveChatSessionEpoch}`;
};

export const recordLiveChatHeartbeatAcknowledged = (sentAt: number): void => {
	// Monotonic: an older renewal answering last never moves the lease back,
	// and the answer time and generation only ever advance.
	const last = readLastLiveChatHeartbeatAcknowledged();
	ownAcknowledgement = {
		sentAt: Math.max(last.sentAt, sentAt),
		ackedAt: Math.max(last.ackedAt, Date.now()),
		generation: last.generation + 1
	};
	try {
		localStorage.setItem(
			LIVE_CHAT_AVAILABILITY_ACK_STORAGE_KEY,
			JSON.stringify(ownAcknowledgement)
		);
	} catch {
		/* Without storage each tab falls back to its own acknowledgements. */
	}
};

const NO_ACKNOWLEDGEMENT: LiveChatAcknowledgement = {
	sentAt: 0,
	ackedAt: 0,
	generation: 0
};

const readSharedAcknowledgement = (): LiveChatAcknowledgement => {
	try {
		const raw = localStorage.getItem(
			LIVE_CHAT_AVAILABILITY_ACK_STORAGE_KEY
		);
		if (!raw) return NO_ACKNOWLEDGEMENT;
		const parsed: unknown = JSON.parse(raw);
		// A bare number (the first format) is both times at once.
		if (typeof parsed === 'number' && Number.isFinite(parsed))
			return { sentAt: parsed, ackedAt: parsed, generation: 0 };
		const { sentAt, ackedAt, generation } = (parsed ?? {}) as Record<
			string,
			unknown
		>;
		if (Number.isFinite(sentAt) && Number.isFinite(ackedAt))
			return {
				sentAt: sentAt as number,
				ackedAt: ackedAt as number,
				generation: Number.isFinite(generation)
					? (generation as number)
					: 0
			};
		return NO_ACKNOWLEDGEMENT;
	} catch {
		return NO_ACKNOWLEDGEMENT;
	}
};

/** The newest acknowledgement this tab knows of, its own or any tab's. */
export const readLastLiveChatHeartbeatAcknowledged =
	(): LiveChatAcknowledgement => {
		const shared = readSharedAcknowledgement();
		return {
			sentAt: Math.max(shared.sentAt, ownAcknowledgement.sentAt),
			ackedAt: Math.max(shared.ackedAt, ownAcknowledgement.ackedAt),
			generation: Math.max(
				shared.generation,
				ownAcknowledgement.generation
			)
		};
	};

/**
 * Keys written by builds before the Caritas fork was renamed (FE-H05, #178).
 * Read for backwards compatibility and dropped on the next write, so a
 * consultant who was available before the update stays available after it.
 */
export const LEGACY_LIVE_CHAT_AVAILABILITY_STORAGE_KEY =
	'caritas_liveChatAvailability';

/**
 * Why the client stopped claiming "live" without the consultant switching off
 * (#1485). Carried on the change event so every consumer can say why.
 */
export type LiveChatAvailabilityLossReason =
	/** The heartbeat was answered with 403. */
	| 'refused'
	/** The heartbeat was answered with 401: the sign-in has expired. */
	| 'sessionExpired'
	/** The server answered, but no longer holds a lease for this consultant. */
	| 'leaseLost'
	/** No heartbeat was acknowledged for longer than the lease lives. */
	| 'connectionLost';

const LOSS_REASONS: readonly LiveChatAvailabilityLossReason[] = [
	'refused',
	'sessionExpired',
	'leaseLost',
	'connectionLost'
];

/** Reads the reason another tab recorded; anything unexpected reads as none. */
export const parseLiveChatAvailabilityLoss = (
	value: string | null
): LiveChatAvailabilityLossReason | null => {
	if (!value) return null;
	try {
		const reason = (JSON.parse(value) as { reason?: unknown })?.reason;
		return LOSS_REASONS.find((known) => known === reason) ?? null;
	} catch {
		return null;
	}
};

/** This is a desired preference only; visible active state comes from the API. */
export const readLiveChatAvailabilityPreference = (): boolean => {
	try {
		return (
			localStorage.getItem(LIVE_CHAT_AVAILABILITY_STORAGE_KEY) === '1' ||
			localStorage.getItem(LEGACY_LIVE_CHAT_AVAILABILITY_STORAGE_KEY) ===
				'1'
		);
	} catch {
		return false;
	}
};

export const persistLiveChatAvailabilityPreference = (
	active: boolean,
	reason?: LiveChatAvailabilityLossReason
): void => {
	try {
		if (active) {
			localStorage.setItem(LIVE_CHAT_AVAILABILITY_STORAGE_KEY, '1');
		} else {
			localStorage.removeItem(LIVE_CHAT_AVAILABILITY_STORAGE_KEY);
			forgetOwnAcknowledgement();
			localStorage.removeItem(LIVE_CHAT_AVAILABILITY_ACK_STORAGE_KEY);
		}
		localStorage.removeItem(LEGACY_LIVE_CHAT_AVAILABILITY_STORAGE_KEY);
		if (reason) {
			// The timestamp makes every loss a new value, so other tabs get
			// a `storage` event even when the reason repeats.
			localStorage.setItem(
				LIVE_CHAT_AVAILABILITY_LOSS_STORAGE_KEY,
				JSON.stringify({ reason, at: Date.now() })
			);
		} else {
			localStorage.removeItem(LIVE_CHAT_AVAILABILITY_LOSS_STORAGE_KEY);
		}
	} catch {
		/* Storage errors do not change the backend-acknowledged state. */
	}
	window.dispatchEvent(
		new CustomEvent(LIVE_CHAT_AVAILABILITY_CHANGE_EVENT, {
			detail: { active, reason }
		})
	);
};

/** Ends the session's live-chat state: logout and every teardown. */
export const clearLiveChatAvailabilityPreference = (): void => {
	liveChatSessionEpoch += 1;
	forgetOwnAcknowledgement();
	try {
		localStorage.setItem(
			LIVE_CHAT_SESSION_EPOCH_STORAGE_KEY,
			`${Date.now()}-${Math.random().toString(36).slice(2)}`
		);
	} catch {
		/* The tab-local counter above still ends this tab's session. */
	}
	persistLiveChatAvailabilityPreference(false);
};
