import { describe, expect, it } from 'vite-plus/test';
import { emailCollectionSetupPolicy } from './notificationChannelPolicy';

describe('notification setup for a temporary account (UserService#1662)', () => {
	it('offers neither e-mail nor browser notifications to a temporary account', () => {
		expect(
			emailCollectionSetupPolicy({}, 'AGENCY_COUNSELLING', {
				temporaryAccount: true
			})
		).toMatchObject({ emailAllowed: false, browserAllowed: false });
	});

	it('keeps the tenant policy for a permanent account', () => {
		expect(
			emailCollectionSetupPolicy({}, 'AGENCY_COUNSELLING', {
				temporaryAccount: false
			})
		).toMatchObject({ emailAllowed: true, browserAllowed: true });
		expect(
			emailCollectionSetupPolicy({}, 'AGENCY_COUNSELLING')
		).toMatchObject({ emailAllowed: true, browserAllowed: true });
	});
});
