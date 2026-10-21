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
	animal: { kind: 'animal', file: 'fox.svg', bg: '#165E83', ink: '#ffffff' },
	motif: { kind: 'motif', file: 'owl.svg', bg: '#a5000a', ink: '#ffffff' },
	initials: {
		kind: 'initials',
		bg: '#a5000a',
		ink: '#ffffff',
		initials: 'SP'
	}
} as const;

describe('the record that crosses into the call', () => {
	it('travels under the event type the fork listens for', () => {
		expect(CALL_IDENTITY_EVENT_TYPE).toBe(EVENT_TYPE);
	});

	it('produces exactly the animal shape the fork accepts', () => {
		const identity = ownCallIdentity({
			userId: '@anon:oriso.test',
			userData: {},
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
			userData: { avatarKind: 'ICON', avatarId: 'owl' },
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
