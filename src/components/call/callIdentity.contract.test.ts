/**
 * The contract with ORISO-ElementCall.
 *
 * One record crosses between two repositories that are tested separately,
 * which is the shape of problem where both suites stay green and the thing
 * still does not work. The fixtures below are byte-for-byte the ones in the
 * fork's `src/oriso/identity.test.ts`, and each file names the other. If
 * somebody renames a field, one of the two goes red and says where to look.
 *
 * Deliberately literal. Importing a shared type would test that the two
 * agree about TypeScript; what has to hold is that they agree about JSON on
 * the wire, including the spelling of `ink` rather than `iconColor` and of
 * `file` rather than `avatarId`.
 */
import { describe, expect, it } from 'vite-plus/test';

import {
	CALL_IDENTITY_EVENT_TYPE,
	animalNameOf,
	type CallIdentity,
	ownCallIdentity
} from './callIdentity';

/** Must equal ORISO_IDENTITY_EVENT_TYPE in the fork. */
const EVENT_TYPE = 'org.oriso.call.identity';

/**
 * Accepted verbatim by `readIdentity` in the fork. Changing a key here
 * without changing it there publishes a record the call will reject, and
 * everybody turns into initials.
 */
const ON_THE_WIRE = {
	animal: {
		kind: 'animal',
		file: 'fox.svg',
		bg: '#165E83',
		ink: '#ffffff',
		name: 'ruhiger Fuchs 432',
		role: 'asker'
	},
	motif: {
		kind: 'motif',
		file: 'owl.svg',
		bg: '#a5000a',
		ink: '#ffffff',
		name: 'Beratung Nord',
		role: 'counsellor'
	},
	initials: {
		kind: 'initials',
		bg: '#a5000a',
		ink: '#ffffff',
		initials: 'SP',
		name: 'Susanne Pfeiffer',
		role: 'counsellor'
	}
} as const;

describe('the record that crosses into the call', () => {
	it('travels under the event type the fork listens for', () => {
		expect(CALL_IDENTITY_EVENT_TYPE).toBe(EVENT_TYPE);
	});

	it('produces exactly the animal shape the fork accepts', () => {
		const identity = ownCallIdentity({
			userId: '@anon:oriso.test',
			userData: { displayName: 'ruhiger Fuchs 432' },
			isConsultant: false,
			brand: { primary: '#a5000a', onPrimary: '#ffffff' }
		});
		expect(Object.keys(identity).sort()).toEqual(
			Object.keys(ON_THE_WIRE.animal).sort()
		);
		expect(identity.kind).toBe('animal');
		// The value, not only the key. Comparing `Object.keys` pins the shape
		// and lets any pseudonym through, which is the half of the contract
		// the fork actually puts on a tile.
		expect(identity.name).toBe(ON_THE_WIRE.animal.name);
		expect(identity.file).toMatch(/^[a-z0-9][a-z0-9_-]*\.svg$/i);
		expect(identity.bg).toMatch(/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i);
		expect(identity.ink).toMatch(/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i);
	});

	it('produces exactly the motif shape the fork accepts', () => {
		const identity = ownCallIdentity({
			userId: '@berater:oriso.test',
			userData: {
				avatarKind: 'ICON',
				avatarId: 'owl',
				displayName: 'Beratung Nord'
			},
			isConsultant: true,
			brand: { primary: '#a5000a', onPrimary: '#ffffff' }
		});
		expect(identity).toEqual(ON_THE_WIRE.motif);
	});

	it('produces exactly the initials shape the fork accepts', () => {
		const identity = ownCallIdentity({
			userId: '@berater:oriso.test',
			userData: { displayName: 'Susanne Pfeiffer' },
			isConsultant: true,
			brand: { primary: '#a5000a', onPrimary: '#ffffff' }
		});
		expect(identity).toEqual(ON_THE_WIRE.initials);
	});

	/*
	 * The name is the field the fork is strictest about, and for a reason
	 * that only shows up across the two repositories: it REFUSES a name that
	 * is a bare Matrix id, because that is the value it exists to replace.
	 * A host that let one through would publish a record the call silently
	 * downgrades — everybody back to `@someone:oriso.org` — with both suites
	 * green. So the shape is pinned from this side too.
	 */
	it('never publishes a name the fork would refuse', () => {
		const identity = ownCallIdentity({
			userId: '@anon:oriso.test',
			userData: { userName: '@anon:oriso.test' },
			isConsultant: false,
			brand: { primary: '#a5000a', onPrimary: '#ffffff' }
		});
		// Call design S1: not the login name either. Without a public name an
		// advice seeker is called by their animal.
		expect(identity.name).toBe(animalNameOf(identity.file));
		expect(identity.name).toMatch(/^\p{Lu}/u);
		expect(identity.name).not.toMatch(/^@[^:\s]+:[^\s]+$/);
	});

	/*
	 * ADR-002 §2: the published identity is the public display name. A
	 * counsellor's legal name is staff data, and the advice seeker is in
	 * this call — so the record that reaches them must not carry it, even
	 * when the user data this is built from does.
	 */
	it('never puts a counsellor´s legal name on the wire', () => {
		const identity = ownCallIdentity({
			userId: '@berater:oriso.test',
			userData: {
				displayName: 'Beratung Nord',
				firstName: 'Susanne',
				lastName: 'Pfeiffer'
			},
			isConsultant: true,
			brand: { primary: '#a5000a', onPrimary: '#ffffff' }
		});
		expect(identity.name).toBe('Beratung Nord');
	});

	/*
	 * The case that can actually fail: a counsellor record with legal name
	 * parts and no public name. The call names them by role, never by the
	 * legal name and never by the login name (call design S1).
	 */
	it('names a counsellor by role rather than by a legal or login name', () => {
		const identity = ownCallIdentity({
			userId: '@krusty.clown_at_openresilience.cc:oriso.test',
			userData: {
				firstName: 'Susanne',
				lastName: 'Pfeiffer',
				userName: 'krusty.clown_at_openresilience.cc'
			},
			isConsultant: true,
			brand: { primary: '#a5000a', onPrimary: '#ffffff' }
		});
		expect(identity.name).toBe('Beratung');
		expect(identity.role).toBe('counsellor');
		// The letters are a different exposure and stay: two initials on a
		// coloured circle are what the chat shows this counsellor too.
		expect(identity.initials).toBe('SP');
	});

	/*
	 * Always a name, so the fork never falls back to the local part of the
	 * Matrix id (`shownNameFor`), which is the raw login name.
	 */
	it('always names an advice seeker, by their animal when nothing else', () => {
		const identity = ownCallIdentity({
			userId: '@anon:oriso.test',
			userData: {},
			isConsultant: false,
			brand: { primary: '#a5000a', onPrimary: '#ffffff' }
		});
		expect(identity.name).toBeTruthy();
		expect(identity.name).toBe(animalNameOf(identity.file));
		expect(identity.role).toBe('asker');
	});

	it('refuses a display name that is only a login name', () => {
		const identity = ownCallIdentity({
			userId: '@hugo:oriso.test',
			userData: { displayName: 'hugo.simpson_at_trail.ist' },
			isConsultant: false,
			brand: { primary: '#a5000a', onPrimary: '#ffffff' }
		});
		expect(identity.name).toBe(animalNameOf(identity.file));
	});

	it('never spells a colour the way the rest of the app does', () => {
		// `iconColor` is what the anonymous-name engine calls it and what a
		// refactor would reach for. On the wire it is `ink`, because the fork
		// reads `ink` — and a record with `iconColor` on it is silently
		// rejected rather than loudly wrong.
		const identity = ownCallIdentity({
			userId: '@anon:oriso.test',
			userData: {},
			isConsultant: false,
			brand: { primary: '#a5000a', onPrimary: '#ffffff' }
		}) as CallIdentity & { iconColor?: string };
		expect(identity.iconColor).toBeUndefined();
		expect(identity.ink).toBeDefined();
	});
});
