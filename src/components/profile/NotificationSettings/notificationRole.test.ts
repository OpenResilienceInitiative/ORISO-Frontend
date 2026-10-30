import { describe, expect, it } from 'vite-plus/test';
import { notificationRoleFor } from './notificationRole';

describe('notificationRoleFor', () => {
	it('is undefined until the user data has loaded, so nobody sees the wrong rows', () => {
		expect(notificationRoleFor(null)).toBeUndefined();
		expect(notificationRoleFor(undefined)).toBeUndefined();
		expect(notificationRoleFor({} as never)).toBeUndefined();
	});

	it('tells counsellors from advice seekers by their authorities', () => {
		expect(
			notificationRoleFor({
				grantedAuthorities: ['AUTHORIZATION_CONSULTANT_DEFAULT']
			} as never)
		).toBe('consultant');
		expect(
			notificationRoleFor({
				grantedAuthorities: ['AUTHORIZATION_USER_DEFAULT']
			} as never)
		).toBe('asker');
	});
});
