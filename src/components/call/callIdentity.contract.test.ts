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
import { describe, expect, it } from 'vitest';

import {
	CALL_IDENTITY_EVENT_TYPE,
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
		name: 'ruhiger Fuchs 432'
	},
	motif: {
		kind: 'motif',
		file: 'owl.svg',
		bg: '#a5000a',
		ink: '#ffffff',
		name: 'Beratung Nord'
	},
	initials: {
		kind: 'initials',
		bg: '#a5000a',
		ink: '#ffffff',
		initials: 'SP',
		name: 'Susanne Pfeiffer'
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
		// Stated as the value, not only as the absence of a pattern: an
		// assertion that `undefined` is not a Matrix id passes for a host
		// that publishes no name at all, which is the state this replaces.
		expect(identity.name).toBe('anon');
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
	 * Absent, not empty. The fork reads a missing `name` as "we were not
	 * told" and keeps the display name it has; an empty string would be a
	 * name of nothing, and a key present with `undefined` is neither.
	 */
	it('leaves the field off entirely when there is no name', () => {
		const identity = ownCallIdentity({
			userId: '@anon:oriso.test',
			userData: {},
			isConsultant: false,
			brand: { primary: '#a5000a', onPrimary: '#ffffff' }
		});
		expect('name' in identity).toBe(false);
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
