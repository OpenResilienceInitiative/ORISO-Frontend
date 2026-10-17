/**
 * Putting one person's identity where the call can read it.
 *
 * The sending half of `callIdentity.ts`. Kept apart from the composition so
 * that the decision about who somebody is stays a pure function of what
 * ORISO knows, and only this file touches the client, the document and the
 * network.
 *
 * Written once per person per room and skipped when nothing changed, because
 * a state event resent on every call start would grow the room's state for no
 * reason. A failure here is not fatal: the fork falls back to initials, which
 * is the honest stand-in for "we were not told".
 */
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
	getRoom: (roomId: string) => {
		currentState?: {
			getStateEvents: (
				type: string,
				stateKey: string
			) => { getContent: () => unknown } | null;
		};
	} | null;
	sendStateEvent: (
		roomId: string,
		eventType: string,
		content: Record<string, unknown>,
		stateKey: string
	) => Promise<unknown>;
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

/** What is already published for this person in this room, if anything. */
function published(
	client: IdentityClient,
	roomId: string,
	userId: string
): CallIdentity | null {
	const event = client
		.getRoom(roomId)
		?.currentState?.getStateEvents(CALL_IDENTITY_EVENT_TYPE, userId);
	const content = event?.getContent();
	if (typeof content !== 'object' || content === null) return null;
	return content as CallIdentity;
}

/**
 * Publish this person's identity into the call room, unless it is already there.
 *
 * Returns what is now published, or null when there was nothing to do or the
 * send failed. Never throws: a call that cannot announce an animal is still a
 * call.
 */
export async function publishCallIdentity(
	client: IdentityClient,
	roomId: string,
	source: Omit<IdentitySource, 'userId' | 'brand'> & {
		userId?: string;
		brand?: BrandPair;
	}
): Promise<CallIdentity | null> {
	/*
	 * Two ids, and they are not interchangeable.
	 *
	 * The STATE KEY has to be the Matrix user id: the server refuses a state
	 * key that looks like a user and is not the sender, and the fork looks
	 * identities up by the Matrix id its own tiles carry. The SEED is
	 * whatever ORISO derives the palette from, which is the same id the chat
	 * uses so that the animal beside the call and the animal in it match.
	 * They are the same value in practice — `useOwnAvatarUserId` prefers the
	 * Matrix id — but its fallback is a userservice id, and passing that as
	 * the state key would have had the write rejected outright.
	 */
	const stateKey = client.getUserId();
	if (!stateKey) return null;
	const seedUserId = source.userId ?? stateKey;

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

	if (sameCallIdentity(published(client, roomId, stateKey), identity))
		return identity;

	try {
		await client.sendStateEvent(
			roomId,
			CALL_IDENTITY_EVENT_TYPE,
			identity as unknown as Record<string, unknown>,
			stateKey
		);
		return identity;
	} catch {
		// The fork shows initials when nobody told it anything, which is the
		// right outcome here: we tried to say and could not.
		return null;
	}
}
