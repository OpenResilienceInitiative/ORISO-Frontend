import { describe, it, expect } from 'vitest';
import {
	LEGACY_MATRIX_HOMESERVER_SUFFIX,
	isSystemMatrixUser
} from './systemMatrixUsers';

describe('LEGACY_MATRIX_HOMESERVER_SUFFIX', () => {
	it('names the pre-ADR-005 Caritas homeserver suffix', () => {
		// A rename would silently un-filter every legacy account in older-provisioned
		// rooms, so this asserts the exact value rather than a shape. The suffix is
		// the homeserver half of an MXID (`@localpart:homeserver`).
		expect(LEGACY_MATRIX_HOMESERVER_SUFFIX).toBe(':caritas.local');
	});
});

describe('isSystemMatrixUser', () => {
	it('filters the app system-notice sender', () => {
		expect(isSystemMatrixUser('@system:matrix.oriso.org')).toBe(true);
		expect(isSystemMatrixUser('@system-broadcast:matrix.oriso.org')).toBe(
			true
		);
	});

	it('filters accounts on the legacy Caritas homeserver', () => {
		expect(isSystemMatrixUser('@notification:caritas.local')).toBe(true);
		expect(isSystemMatrixUser('@service-bot:caritas.local')).toBe(true);
	});

	it('lets a human counsellor or advice seeker through', () => {
		expect(isSystemMatrixUser('@counsellor-42:matrix.oriso.org')).toBe(
			false
		);
		expect(isSystemMatrixUser('@asker-abc123:matrix.oriso.org')).toBe(
			false
		);
	});

	it('is false for null, undefined and empty user IDs', () => {
		expect(isSystemMatrixUser(null)).toBe(false);
		expect(isSystemMatrixUser(undefined)).toBe(false);
		expect(isSystemMatrixUser('')).toBe(false);
	});

	it('does not filter agency-service bots — that pattern belongs to callers', () => {
		// The agency-service filter is domain-specific to a couple of composers;
		// keeping it out of this helper keeps callers free to combine checks
		// rather than baking every domain rule in here.
		expect(isSystemMatrixUser('@agency-7-service:matrix.oriso.org')).toBe(
			false
		);
	});
});
