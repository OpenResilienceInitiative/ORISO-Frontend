// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import type { UserDataInterface } from '../../globalState/interfaces/UserDataInterface';
import { groupAppointmentRedirect } from './groupAppointmentRedirect';

const account = (authority: string): UserDataInterface =>
	({ grantedAuthorities: [authority] }) as UserDataInterface;

describe('group appointment login destination', () => {
	it('opens the asker session by numeric series id without an invite assignment', () => {
		expect(
			groupAppointmentRedirect(
				'42',
				account('AUTHORIZATION_USER_DEFAULT')
			)
		).toEqual({ sessionId: 42 });
	});

	it('opens the counselor session by numeric series id', () => {
		expect(
			groupAppointmentRedirect(
				'42',
				account('AUTHORIZATION_CONSULTANT_DEFAULT')
			)
		).toEqual({
			restorePath: '/sessions/consultant/sessionView/session/42'
		});
	});

	it('rejects arbitrary paths and invalid ids', () => {
		for (const id of [
			'0',
			'-1',
			'42/../../admin',
			'https://evil.example',
			'9007199254740993',
			'',
			null
		]) {
			expect(
				groupAppointmentRedirect(
					id,
					account('AUTHORIZATION_USER_DEFAULT')
				)
			).toBeNull();
		}
	});

	it('does not redirect a role that cannot open a session', () => {
		expect(
			groupAppointmentRedirect(
				'42',
				account('AUTHORIZATION_TENANT_ADMIN')
			)
		).toBeNull();
	});
});
