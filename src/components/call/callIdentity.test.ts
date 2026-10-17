import { describe, expect, it, vi } from 'vitest';

import {
	CALL_IDENTITY_EVENT_TYPE,
	ownCallIdentity,
	sameCallIdentity
} from './callIdentity';
import {
	brandPairFrom,
	type IdentityClient,
	publishCallIdentity
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
	const makeClient = (
		existing: unknown = null
	): IdentityClient & { sendStateEvent: ReturnType<typeof vi.fn> } => ({
		getUserId: () => SEEKER,
		getRoom: () => ({
			currentState: {
				getStateEvents: () =>
					existing === null ? null : { getContent: () => existing }
			}
		}),
		sendStateEvent: vi.fn().mockResolvedValue({})
	});

	it('writes the record under the person’s own user id', async () => {
		const client = makeClient();
		await publishCallIdentity(client, '!room:oriso.test', {
			userData: {},
			isConsultant: false,
			brand: BRAND
		});
		expect(client.sendStateEvent).toHaveBeenCalledTimes(1);
		const [roomId, type, content, stateKey] =
			client.sendStateEvent.mock.calls[0];
		expect(roomId).toBe('!room:oriso.test');
		expect(type).toBe(CALL_IDENTITY_EVENT_TYPE);
		expect(stateKey).toBe(SEEKER);
		expect(content).toMatchObject({ kind: 'animal' });
	});

	it('keys the record by the Matrix id even when the seed is another', async () => {
		/*
		 * `useOwnAvatarUserId` prefers the Matrix id but falls back to the
		 * userservice id, and the two uses are not interchangeable: the state
		 * key must be the Matrix id or the server refuses the write and the
		 * fork, which looks identities up by the Matrix id on its tiles,
		 * would never find it anyway. The SEED stays whatever the chat
		 * derives the palette from, so the animal matches on both sides.
		 */
		const client = makeClient();
		const userserviceId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
		await publishCallIdentity(client, '!room:oriso.test', {
			userId: userserviceId,
			userData: {},
			isConsultant: false,
			brand: BRAND
		});
		const [, , content, stateKey] = client.sendStateEvent.mock.calls[0];
		expect(stateKey).toBe(SEEKER);
		// The palette still comes from the seed, not from the state key.
		const seeded = generateAvatarForUser(userserviceId);
		expect(content).toMatchObject({
			bg: seeded.bg,
			ink: seeded.iconColor
		});
	});

	it('says nothing when the same record is already there', async () => {
		const derived = generateAvatarForUser(SEEKER);
		const client = makeClient({
			kind: 'animal',
			file: derived.file,
			bg: derived.bg,
			ink: derived.iconColor
		});
		await publishCallIdentity(client, '!room:oriso.test', {
			userData: {},
			isConsultant: false,
			brand: BRAND
		});
		expect(client.sendStateEvent).not.toHaveBeenCalled();
	});

	it('rewrites it when the person changed their motif', async () => {
		const client = makeClient({
			kind: 'animal',
			file: 'fox.svg',
			bg: '#165e83',
			ink: '#ffffff'
		});
		await publishCallIdentity(client, '!room:oriso.test', {
			userData: { avatarId: 'magpie' },
			isConsultant: false,
			brand: BRAND
		});
		expect(client.sendStateEvent).toHaveBeenCalledTimes(1);
	});

	it('does not break the call when the send fails', async () => {
		const client = makeClient();
		client.sendStateEvent.mockRejectedValue(new Error('M_FORBIDDEN'));
		await expect(
			publishCallIdentity(client, '!room:oriso.test', {
				userData: {},
				isConsultant: false,
				brand: BRAND
			})
		).resolves.toBeNull();
	});

	it('does nothing without a user id', async () => {
		const client = makeClient();
		client.getUserId = () => null;
		await expect(
			publishCallIdentity(client, '!room:oriso.test', {
				userData: {},
				isConsultant: false,
				brand: BRAND
			})
		).resolves.toBeNull();
		expect(client.sendStateEvent).not.toHaveBeenCalled();
	});
});
