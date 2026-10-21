import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';

import {
	CALL_IDENTITY_EVENT_TYPE,
	ownCallIdentity,
	sameCallIdentity
} from './callIdentity';
import {
	brandPairFrom,
	forgetPublishedIdentity,
	type IdentityClient,
	publishCallIdentity,
	republishCallIdentity
} from './publishCallIdentity';
import { generateAvatarForUser } from '../../utils/pseudonymGenerator';

const BRAND = { primary: '#a5000a', onPrimary: '#ffffff' };
const SEEKER = '@anon-abc:oriso.test';

describe('what the call is told', () => {
	it('gives an advice seeker their derived animal and palette', () => {
		// The colour is the part that makes somebody recognisable from one
		// screen to the next, so it must be the engine's, not the brand's.
		const derived = generateAvatarForUser(SEEKER);
		expect(
			ownCallIdentity({
				userId: SEEKER,
				userData: {},
				isConsultant: false,
				brand: BRAND
			})
		).toEqual({
			kind: 'animal',
			file: derived.file,
			bg: derived.bg,
			ink: derived.iconColor
		});
	});

	it('keeps a seeker on their derived colours when they picked an animal', () => {
		const derived = generateAvatarForUser(SEEKER);
		const identity = ownCallIdentity({
			userId: SEEKER,
			userData: { avatarId: 'magpie' },
			isConsultant: false,
			brand: BRAND
		});
		expect(identity.file).toBe('magpie.svg');
		expect(identity.bg).toBe(derived.bg);
	});

	it("puts a counsellor's motif on the tenant's brand pair", () => {
		expect(
			ownCallIdentity({
				userId: '@berater:oriso.test',
				userData: { avatarKind: 'ICON', avatarId: 'owl' },
				isConsultant: true,
				brand: BRAND
			})
		).toEqual({
			kind: 'motif',
			file: 'owl.svg',
			bg: '#a5000a',
			ink: '#ffffff'
		});
	});

	it('gives a counsellor who never picked their initials, on the same pair', () => {
		expect(
			ownCallIdentity({
				userId: '@berater:oriso.test',
				userData: { displayName: 'Susanne Pfeiffer' },
				isConsultant: true,
				brand: BRAND
			})
		).toEqual({
			kind: 'initials',
			bg: '#a5000a',
			ink: '#ffffff',
			initials: 'SP'
		});
	});

	it('never hands a counsellor the derived animal palette', () => {
		// The derived palette is reserved for advice seekers; a counsellor on
		// a colour hash instead of the operator's brand is the thing #1046
		// exists to prevent.
		const identity = ownCallIdentity({
			userId: '@berater:oriso.test',
			userData: { avatarId: 'magpie' },
			isConsultant: true,
			brand: BRAND
		});
		expect(identity.kind).toBe('motif');
		expect(identity.bg).toBe('#a5000a');
	});

	it('falls back to the derived palette when the brand has not resolved', () => {
		// Before the tenant theme is applied, getPropertyValue returns "".
		// Travelling with an empty colour would be rejected at the other end
		// and the person would arrive with no circle at all.
		const derived = generateAvatarForUser('@berater:oriso.test');
		const identity = ownCallIdentity({
			userId: '@berater:oriso.test',
			userData: { avatarKind: 'ICON', avatarId: 'owl' },
			isConsultant: true,
			brand: { primary: '', onPrimary: '  ' }
		});
		expect(identity.bg).toBe(derived.bg);
		expect(identity.ink).toBe(derived.iconColor);
	});

	it('is stable for the same person', () => {
		const once = ownCallIdentity({
			userId: SEEKER,
			userData: {},
			isConsultant: false,
			brand: BRAND
		});
		const twice = ownCallIdentity({
			userId: SEEKER,
			userData: {},
			isConsultant: false,
			brand: BRAND
		});
		expect(sameCallIdentity(once, twice)).toBe(true);
	});
});

describe('reading the brand off the document', () => {
	it('returns empty strings rather than throwing without an element', () => {
		expect(brandPairFrom(null)).toEqual({ primary: '', onPrimary: '' });
	});
});

describe('publishing it', () => {
	const ROOM = '!room:oriso.test';
	const makeClient = (): IdentityClient & {
		sendEvent: ReturnType<typeof vi.fn>;
	} => ({
		getUserId: () => SEEKER,
		sendEvent: vi.fn().mockResolvedValue({ event_id: '$one' })
	});
	/** The production check asks the room; these tests say so directly. */
	const inAnEncryptedRoom = { isEncrypted: (): boolean => true };

	beforeEach(() => forgetPublishedIdentity());

	it('sends the record to the timeline, never to room state', async () => {
		/*
		 * The whole point of the transport.
		 *
		 * Matrix room encryption covers message events. State events are sent
		 * in the clear in an encrypted room exactly as in any other, so an
		 * identity in state is a record the homeserver — and every server it
		 * federates to — can read and keep: on this platform, which advice
		 * seeker chose which animal. A timeline event in a Megolm room is
		 * ciphertext to the server.
		 */
		const client = makeClient();
		await publishCallIdentity(
			client,
			ROOM,
			{ userData: {}, isConsultant: false, brand: BRAND },
			inAnEncryptedRoom
		);
		expect(client.sendEvent).toHaveBeenCalledTimes(1);
		const call = client.sendEvent.mock.calls[0];
		const [roomId, type, content] = call;
		expect(roomId).toBe(ROOM);
		expect(type).toBe(CALL_IDENTITY_EVENT_TYPE);
		expect(content).toMatchObject({ kind: 'animal' });
		// No fourth argument: a state key is what this no longer has, and
		// `sendEvent` with one would be `sendStateEvent` by another name.
		expect(call).toHaveLength(3);
		expect('sendStateEvent' in client).toBe(false);
	});

	it('refuses to publish into a room that is not encrypted', async () => {
		/*
		 * The guarantee, not merely tidiness.
		 *
		 * The call room is created with Megolm on, but the group-call path
		 * falls back to the session room when that creation fails, and an
		 * identity sent in the clear is the exact leak this module exists to
		 * close. Silence costs the person their animal for one call — the
		 * fork shows initials — rather than a durable record on a server.
		 */
		const client = makeClient();
		await expect(
			publishCallIdentity(
				client,
				ROOM,
				{ userData: {}, isConsultant: false, brand: BRAND },
				{ isEncrypted: () => false }
			)
		).resolves.toBeNull();
		expect(client.sendEvent).not.toHaveBeenCalled();
	});

	it('derives the palette from the seed, not from the Matrix id', async () => {
		/*
		 * `useOwnAvatarUserId` prefers the Matrix id but falls back to the
		 * userservice id, and the two uses are not interchangeable. The SEED
		 * stays whatever the chat derives the palette from, so the animal
		 * matches on both sides. There is no longer a key to get wrong: the
		 * fork files the record under the event's SENDER, which the Matrix id
		 * is by construction.
		 */
		const client = makeClient();
		const userserviceId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
		await publishCallIdentity(
			client,
			ROOM,
			{
				userId: userserviceId,
				userData: {},
				isConsultant: false,
				brand: BRAND
			},
			inAnEncryptedRoom
		);
		const [, , content] = client.sendEvent.mock.calls[0];
		const seeded = generateAvatarForUser(userserviceId);
		expect(content).toMatchObject({
			bg: seeded.bg,
			ink: seeded.iconColor
		});
	});

	it('says nothing the second time when nothing changed', async () => {
		// A timeline event has no state key, so nothing dedupes it for us: a
		// re-render would otherwise put another copy in the room.
		const client = makeClient();
		const source = { userData: {}, isConsultant: false, brand: BRAND };
		await publishCallIdentity(client, ROOM, source, inAnEncryptedRoom);
		await publishCallIdentity(client, ROOM, source, inAnEncryptedRoom);
		expect(client.sendEvent).toHaveBeenCalledTimes(1);
	});

	it('does not send twice when two publishes overlap', async () => {
		/*
		 * `lastSent` is only written once the send resolves, which leaves a
		 * window: the effect that publishes depends on `userData` and
		 * `ownAvatarUserId`, and both can settle shortly after mount, so a
		 * second call for the same room can start while the first is still
		 * out. A duplicate is only noise — the reader keys by sender and the
		 * newest wins — but it is noise in an encrypted room somebody pays to
		 * store.
		 */
		const client = makeClient();
		let release: (value: { event_id: string }) => void = () => undefined;
		client.sendEvent.mockImplementationOnce(
			() =>
				new Promise<{ event_id: string }>((resolve) => {
					release = resolve;
				})
		);
		const source = { userData: {}, isConsultant: false, brand: BRAND };
		const first = publishCallIdentity(
			client,
			ROOM,
			source,
			inAnEncryptedRoom
		);
		const second = publishCallIdentity(
			client,
			ROOM,
			source,
			inAnEncryptedRoom
		);
		expect(client.sendEvent).toHaveBeenCalledTimes(1);
		release({ event_id: '$one' });
		// The second call is the first one's answer, not a second send.
		expect(await second).toEqual(await first);
		expect(client.sendEvent).toHaveBeenCalledTimes(1);
	});

	it('still re-announces for a newcomer while a publish is in flight', async () => {
		// The dedupe must not swallow the forced resend: a newcomer needs the
		// event itself, and the one in flight was sent before they arrived.
		const client = makeClient();
		let release: (value: { event_id: string }) => void = () => undefined;
		client.sendEvent.mockImplementationOnce(
			() =>
				new Promise<{ event_id: string }>((resolve) => {
					release = resolve;
				})
		);
		const source = { userData: {}, isConsultant: false, brand: BRAND };
		void publishCallIdentity(client, ROOM, source, inAnEncryptedRoom);
		void republishCallIdentity(client, ROOM, source, inAnEncryptedRoom);
		expect(client.sendEvent).toHaveBeenCalledTimes(2);
		release({ event_id: '$one' });
	});

	it('says it again when the person changed their motif', async () => {
		const client = makeClient();
		await publishCallIdentity(
			client,
			ROOM,
			{ userData: {}, isConsultant: false, brand: BRAND },
			inAnEncryptedRoom
		);
		await publishCallIdentity(
			client,
			ROOM,
			{
				userData: { avatarId: 'magpie' },
				isConsultant: false,
				brand: BRAND
			},
			inAnEncryptedRoom
		);
		expect(client.sendEvent).toHaveBeenCalledTimes(2);
		const [, , second] = client.sendEvent.mock.calls[1];
		expect(second).toMatchObject({ file: 'magpie.svg' });
	});

	it('says it again, unchanged, for somebody who just arrived', async () => {
		/*
		 * What replaces a state event's "always current".
		 *
		 * Room state is there for whoever reads it next; a timeline event
		 * reaches whoever was listening. The widget is fed live events and
		 * the call room's history is `joined`, so a newcomer is handed
		 * nothing — everybody already present re-announces instead, and that
		 * resend is identical content, which the dedupe above would otherwise
		 * swallow.
		 */
		const client = makeClient();
		const source = { userData: {}, isConsultant: false, brand: BRAND };
		await publishCallIdentity(client, ROOM, source, inAnEncryptedRoom);
		await republishCallIdentity(client, ROOM, source, inAnEncryptedRoom);
		expect(client.sendEvent).toHaveBeenCalledTimes(2);
		expect(client.sendEvent.mock.calls[0][2]).toEqual(
			client.sendEvent.mock.calls[1][2]
		);
	});

	it('does not break the call when the send fails', async () => {
		const client = makeClient();
		client.sendEvent.mockRejectedValue(new Error('M_FORBIDDEN'));
		await expect(
			publishCallIdentity(
				client,
				ROOM,
				{ userData: {}, isConsultant: false, brand: BRAND },
				inAnEncryptedRoom
			)
		).resolves.toBeNull();
	});

	it('tries again after a failure rather than believing it landed', async () => {
		const client = makeClient();
		client.sendEvent.mockRejectedValueOnce(new Error('M_FORBIDDEN'));
		const source = { userData: {}, isConsultant: false, brand: BRAND };
		await publishCallIdentity(client, ROOM, source, inAnEncryptedRoom);
		await publishCallIdentity(client, ROOM, source, inAnEncryptedRoom);
		expect(client.sendEvent).toHaveBeenCalledTimes(2);
	});

	it('does nothing without a user id', async () => {
		const client = makeClient();
		client.getUserId = () => null;
		await expect(
			publishCallIdentity(
				client,
				ROOM,
				{ userData: {}, isConsultant: false, brand: BRAND },
				inAnEncryptedRoom
			)
		).resolves.toBeNull();
		expect(client.sendEvent).not.toHaveBeenCalled();
	});
});
