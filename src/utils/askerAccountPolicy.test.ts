import { describe, expect, it } from 'vite-plus/test';
import {
	isContextEmailCollectionAllowed,
	hasRestrictedEmailCollection
} from './askerAccountPolicy';
import { accountPolicyTenant } from '../test/fixtures/askerAccountPolicyFixtures';

describe('context email collection, independent of delivery', () => {
	it.each([
		[
			'AGENCY_COUNSELLING',
			'featureAskerEmailCollectionAgencyCounsellingEnabled'
		],
		['LIVE_CHAT', 'featureAskerEmailCollectionLiveChatEnabled'],
		['SELF_HELP', 'featureAskerEmailCollectionSelfHelpEnabled']
	] as const)(
		'%s obeys only its collection setting under the account cap',
		(type, key) => {
			const settings = accountPolicyTenant().settings;
			expect(isContextEmailCollectionAllowed(settings, type)).toBe(true);
			expect(
				isContextEmailCollectionAllowed(
					{ ...settings, [key]: false },
					type
				)
			).toBe(false);
			expect(
				isContextEmailCollectionAllowed(
					{
						...settings,
						[key]: true,
						featureAskerEmailEnabled: false
					},
					type
				)
			).toBe(false);
			expect(
				isContextEmailCollectionAllowed(
					{ ...settings, featureAskerEmailLiveChatEnabled: false },
					type
				)
			).toBe(true);
		}
	);
	it('refuses unknown and internal contexts', () => {
		for (const type of [undefined, null, 'UNKNOWN', 'INTERNAL_GROUP'])
			expect(isContextEmailCollectionAllowed(undefined, type)).toBe(
				false
			);
	});
	it('distinguishes restrictive policy from compatible defaults', () => {
		expect(hasRestrictedEmailCollection(undefined)).toBe(false);
		expect(
			hasRestrictedEmailCollection({
				featureAskerEmailCollectionSelfHelpEnabled: false
			})
		).toBe(true);
	});
});
