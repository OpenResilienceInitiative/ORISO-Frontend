/**
 * Putting one person's identity where the call can read it.
 *
 * The sending half of `callIdentity.ts`. Kept apart from the composition so
 * that the decision about who somebody is stays a pure function of what
 * ORISO knows, and only this file touches the client, the document and the
 * network.
 *
 * It travels as an ENCRYPTED TIMELINE EVENT, not as room state, and that
 * distinction is the point of this module. Matrix room encryption covers
 * message events; state events are sent in the clear in an encrypted room
 * exactly as in any other. An `org.oriso.call.identity` state event was
 * therefore readable by the homeserver and by every server it federates to —
 * on a counselling platform, a durable record of which advice seeker chose
 * which animal. Sent to the timeline of a room with Megolm on, the server
 * stores ciphertext and learns nothing it did not already have.
 *
 * Three consequences worth knowing, because they shape the code below:
 *
 *  - **A timeline event has no state key**, so it has no natural idempotence.
 *    `lastSent` below is what stops a resend on every re-render.
 *  - **A timeline event has no natural retention either.** A client that
 *    joins later is not handed what it missed: `history_visibility` on the
 *    call room is `joined`, and the widget is fed live events rather than
 *    backfill. So whoever is already here re-announces when somebody new
 *    arrives — see `republishCallIdentity`.
 *  - **The sender is attested.** A state event needed the reader to check the
 *    sender against the state key by hand or one participant could overwrite
 *    another's animal. A decrypted timeline event carries the device that
 *    sent it, so the fork keys identities by sender and forgery has nowhere
 *    to stand.
 *
 * A failure here is not fatal: the fork falls back to initials, which is the
 * honest stand-in for "we were not told".
 */
import { type MatrixClient } from 'matrix-js-sdk';
import { isMatrixRoomEncrypted } from '../../utils/matrixRoomEncryption';
import {
	CALL_IDENTITY_EVENT_TYPE,
	type BrandPair,
	type CallIdentity,
	type IdentitySource,
	ownCallIdentity,
	sameCallIdentity
} from './callIdentity';

/** A client, as narrowly as this file needs one. */
export interface IdentityClient {
	getUserId: () => string | null;
	sendEvent: (
		roomId: string,
		eventType: string,
		content: Record<string, unknown>
	) => Promise<unknown>;
}

/**
 * What this client last put in each room, so a re-render does not resend it.
 *
 * Module scope rather than React state because the publish is fired from an
 * effect whose dependencies legitimately change during a call, and because a
 * second surface for the same room must not duplicate the write. Cleared by
 * `forgetPublishedIdentity` when the call ends.
 */
const lastSent = new Map<string, CallIdentity>();

/**
 * What is in flight for each room, so two publishes do not both send it.
 *
 * `lastSent` is only written once the send resolves, which leaves a window:
 * the effect that publishes depends on `userData` and `ownAvatarUserId`, and
 * both can settle shortly after mount, so a second call for the same room can
 * start while the first is still out. A duplicate is only noise — the reader
 * keys by sender and the newest wins — but it is noise in an encrypted room
 * that somebody pays to store.
 */
const inFlight = new Map<
	string,
	{ identity: CallIdentity; promise: Promise<CallIdentity | null> }
>();

/** Forget a room's record, so the next publish writes again. */
export function forgetPublishedIdentity(roomId?: string): void {
	if (roomId === undefined) {
		lastSent.clear();
		inFlight.clear();
	} else {
		lastSent.delete(roomId);
		inFlight.delete(roomId);
	}
}

export interface PublishOptions {
	/**
	 * Send even when the content has not changed.
	 *
	 * For the re-announce: a newcomer needs the event itself, not the news
	 * that it is unchanged.
	 */
	force?: boolean;
	/** Overridable for tests; production asks the room. */
	isEncrypted?: (roomId: string) => boolean;
}

/**
 * The tenant's brand pair, as the document currently has it.
 *
 * Read from the computed style rather than recomputed from seeds: the seeds
 * live in tenant settings and the engine has already run by the time a call
 * starts, so reading the result is both cheaper and guaranteed to match what
 * the chat beside the call is painting.
 */
export function brandPairFrom(element: Element | null): BrandPair {
	if (element === null || typeof getComputedStyle !== 'function')
		return { primary: '', onPrimary: '' };
	const style = getComputedStyle(element);
	return {
		primary: style.getPropertyValue('--m3-primary'),
		onPrimary: style.getPropertyValue('--m3-on-primary')
	};
}

/**
 * Publish this person's identity into the call room, unless it is already there.
 *
 * Returns what is now published, or null when there was nothing to do or the
 * send failed. Never throws: a call that cannot announce an animal is still a
 * call.
 *
 * Refuses outright if the room is not encrypted. That is not defensive
 * tidiness — it is the guarantee. The call room is created with Megolm on,
 * but the group-call path falls back to the session room if that creation
 * fails, and an identity sent in the clear is the leak this module exists to
 * close. Silence costs the person their animal for one call; it does not cost
 * them a permanent record on somebody's server.
 */
export async function publishCallIdentity(
	client: IdentityClient,
	roomId: string,
	source: Omit<IdentitySource, 'userId' | 'brand'> & {
		userId?: string;
		brand?: BrandPair;
	},
	options: PublishOptions = {}
): Promise<CallIdentity | null> {
	const encrypted =
		options.isEncrypted ??
		((id: string): boolean =>
			isMatrixRoomEncrypted(client as unknown as MatrixClient, id));
	if (!encrypted(roomId)) return null;

	/*
	 * Two ids, and they are not interchangeable.
	 *
	 * The SEED is whatever ORISO derives the palette from, which is the same
	 * id the chat uses so that the animal beside the call and the animal in
	 * it match. `useOwnAvatarUserId` prefers the Matrix id but may answer a
	 * userservice id, and the fork looks identities up by the Matrix id its
	 * own tiles carry — which is now the event's sender, so the two cannot
	 * drift apart the way a hand-written state key could.
	 */
	const ownUserId = client.getUserId();
	if (!ownUserId) return null;
	const seedUserId = source.userId ?? ownUserId;

	const identity = ownCallIdentity({
		...source,
		userId: seedUserId,
		brand:
			source.brand ??
			brandPairFrom(
				typeof document === 'undefined'
					? null
					: document.documentElement
			)
	});

	if (options.force !== true) {
		if (sameCallIdentity(lastSent.get(roomId) ?? null, identity))
			return identity;
		// Already on its way, and the same thing. Wait for that one rather
		// than putting a second copy in the room.
		const pending = inFlight.get(roomId);
		if (pending && sameCallIdentity(pending.identity, identity))
			return pending.promise;
	}

	const send = async (): Promise<CallIdentity | null> => {
		try {
			await client.sendEvent(
				roomId,
				CALL_IDENTITY_EVENT_TYPE,
				identity as unknown as Record<string, unknown>
			);
			lastSent.set(roomId, identity);
			return identity;
		} catch {
			// The fork shows initials when nobody told it anything, which is
			// the right outcome here: we tried to say and could not.
			return null;
		}
	};

	const promise = send();
	inFlight.set(roomId, { identity, promise });
	void promise.finally(() => {
		if (inFlight.get(roomId)?.promise === promise) inFlight.delete(roomId);
	});
	return promise;
}

/**
 * Say it again, for somebody who was not here the first time.
 *
 * A state event was always current for whoever read it next; a timeline event
 * is only seen by whoever was listening. So every client that is already in
 * the call re-sends its own identity when a new member appears, and the
 * newcomer learns the room from the people in it. The cost is one small
 * encrypted event per participant per join, which for a counselling call is
 * a handful.
 */
export async function republishCallIdentity(
	client: IdentityClient,
	roomId: string,
	source: Omit<IdentitySource, 'userId' | 'brand'> & {
		userId?: string;
		brand?: BrandPair;
	},
	options: Omit<PublishOptions, 'force'> = {}
): Promise<CallIdentity | null> {
	return publishCallIdentity(client, roomId, source, {
		...options,
		force: true
	});
}
