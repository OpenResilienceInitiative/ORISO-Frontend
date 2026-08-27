import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { allPasswordCriteriaPass } from '../registration/accountData/passwordRules';
import {
	mintInviteGuestCredentials,
	rerollInviteGuestUsername
} from './inviteLinkIdentity';

describe('invite guest identity', () => {
	it('mints an animal User-ID and an engine password, never Anonymous-<timestamp>', () => {
		const minted = mintInviteGuestCredentials('de');

		expect(minted.username).not.toMatch(/^Anonymous-/);
		expect(minted.username).toMatch(/^[a-z0-9_]+_\d{4}$/);
		expect(minted.username.length).toBeLessThanOrEqual(30);
		expect(allPasswordCriteriaPass(minted.password)).toBe(true);
		expect(minted.identity.animalLabel).toBeTruthy();
		expect(minted.identity.name).toBeTruthy();
	});

	it('re-rolls a new User-ID from the same engine', () => {
		const minted = mintInviteGuestCredentials('de');
		const next = rerollInviteGuestUsername(minted.identity, 'de');

		expect(next.username).not.toMatch(/^Anonymous-/);
		expect(next.username).toMatch(/^[a-z0-9_]+_\d{4}$/);
		expect(next.identity).not.toBe(minted.identity);
	});

	it('forbids the legacy Anonymous-timestamp mint in InviteLink', () => {
		const inviteSource = readFileSync(
			join(process.cwd(), 'src/components/invite/InviteLink.tsx'),
			'utf8'
		);
		const identitySource = readFileSync(
			join(process.cwd(), 'src/components/invite/inviteLinkIdentity.ts'),
			'utf8'
		);

		expect(inviteSource).not.toMatch(/Anonymous-\$\{Date\.now\(\)\}/);
		expect(inviteSource).not.toMatch(/Anonymous-/);
		expect(inviteSource).toMatch(/mintInviteGuestCredentials/);
		expect(inviteSource).toMatch(/rerollInviteGuestUsername/);
		expect(identitySource).toMatch(/toRegistrationUsername/);
		expect(identitySource).toMatch(/generatePassword/);
	});
});
