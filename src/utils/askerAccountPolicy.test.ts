import { describe, expect, it } from 'vite-plus/test';
import {
	isContextEmailCollectionAllowed,
	isAskerDisplayNameTypingAllowed,
	hasRestrictedEmailCollection
} from './askerAccountPolicy';
import { accountPolicyTenant } from '../test/fixtures/askerAccountPolicyFixtures';

describe('context email collection, independent of delivery', () => {
	it.each([
		[
			'AGENCY_COUNSELLING',
			'featureAskerEmailCollectionAgencyCounsellingEnabled'
		],
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
	it('never collects an email in live chat, even with the legacy delivery switch on', () => {
		const settings = accountPolicyTenant({
			featureAskerEmailEnabled: true,
			featureAskerEmailLiveChatEnabled: true
		}).settings;
		expect(isContextEmailCollectionAllowed(settings, 'LIVE_CHAT')).toBe(
			false
		);
	});
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

describe('per-conversation name typing', () => {
	it.each([
		[
			'AGENCY_COUNSELLING',
			'featureDisplayNameEditableAgencyCounsellingEnabled'
		],
		['LIVE_CHAT', 'featureDisplayNameEditableLiveChatEnabled'],
		['SELF_HELP', 'featureDisplayNameEditableSelfHelpEnabled']
	] as const)('applies the %s rule under the account cap', (type, key) => {
		expect(isAskerDisplayNameTypingAllowed(undefined, type)).toBe(false);
		expect(isAskerDisplayNameTypingAllowed({}, type)).toBe(true);
		expect(isAskerDisplayNameTypingAllowed({ [key]: false }, type)).toBe(
			false
		);
		expect(
			isAskerDisplayNameTypingAllowed(
				{ featureDisplayNameEditable: false, [key]: true },
				type
			)
		).toBe(false);
	});
});
