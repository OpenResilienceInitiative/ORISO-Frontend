import { describe, expect, it } from 'vite-plus/test';
import {
	resolveConversationAgencyId,
	resolveConversationFeatureSettings
} from './conversationFeatureSettings';
import { canonicalAgencySettings } from '../test/fixtures/conversationPolicyFixtures';

describe('conversation feature authority', () => {
	it('uses resolved recommendations without applying a second parent veto', () => {
		const effective = resolveConversationFeatureSettings(
			{
				featureVideoCallsOneOnOneChatsEnabled: false,
				featureVoiceMessagesAnonymousChatsEnabled: false,
				featureMediaUploadGroupChatsEnabled: false,
				featureMediaInlineDisplayEnabled: false
			},
			canonicalAgencySettings()
		);
		expect(effective).toMatchObject({
			featureVideoCallsOneOnOneChatsEnabled: true,
			featureVoiceMessagesAnonymousChatsEnabled: true,
			featureMediaUploadGroupChatsEnabled: true,
			featureMediaInlineDisplayEnabled: true
		});
	});
	it('uses canonical off values instead of contradictory raw agency booleans', () => {
		const effective = resolveConversationFeatureSettings(
			{},
			{
				...canonicalAgencySettings(
					{
						featureVideoCallsEnabled: false,
						featureVoiceMessagesEnabled: false,
						featureMediaUploadEnabled: false,
						featureMediaInlineDisplayEnabled: false
					},
					'ENFORCED'
				),
				featureVideoCallsEnabled: true,
				featureVoiceMessagesEnabled: true,
				featureMediaUploadEnabled: true,
				featureMediaInlineDisplayEnabled: true
			}
		);
		expect(effective).toMatchObject({
			featureVideoCallsEnabled: false,
			featureVoiceMessagesEnabled: false,
			featureMediaUploadEnabled: false,
			featureMediaInlineDisplayEnabled: false
		});
	});
	it('keeps a legacy agency from lifting a tenant hard cap and preserves null inheritance', () => {
		expect(
			resolveConversationFeatureSettings(
				{
					featureVideoCallsEnabled: false,
					featureVoiceMessagesEnabled: true
				},
				{
					featureVideoCallsEnabled: true,
					featureVoiceMessagesEnabled: null
				}
			)
		).toMatchObject({
			featureVideoCallsEnabled: false,
			featureVoiceMessagesEnabled: true
		});
	});
	it('does not replace missing canonical authority with raw permissive values', () => {
		expect(
			resolveConversationFeatureSettings(
				{ featureMediaUploadEnabled: true },
				{ permissionPolicies: {}, featureMediaUploadEnabled: true }
			).featureMediaUploadEnabled
		).toBe(false);
	});
	it('never imports tenant-owned account or handover values from an agency', () => {
		const tenant = {
			featureCallsEnabled: true,
			featureAskerEmailEnabled: false,
			featureDisplayNameEditable: false,
			caseHandoverEnabled: false
		};
		const agency = {
			featureCallsEnabled: true,
			featureAskerEmailEnabled: true,
			featureDisplayNameEditable: true,
			caseHandoverEnabled: true,
			permissionPolicies: {
				...canonicalAgencySettings().permissionPolicies,
				featureAskerEmailEnabled: {
					value: true,
					mode: 'SUGGESTED',
					inherited: false
				}
			}
		};
		expect(
			resolveConversationFeatureSettings(tenant, agency)
		).toMatchObject({
			featureAskerEmailEnabled: false,
			featureDisplayNameEditable: false,
			caseHandoverEnabled: false
		});
	});
});

for (const mode of [undefined, 'UNKNOWN']) {
	it(`rejects malformed canonical mode ${String(mode)} at the policy boundary`, () => {
		// Malformed JSON represents a wire producer violating its TypeScript contract.
		const agency = JSON.parse(
			JSON.stringify({
				permissionPolicies: {
					featureVideoCallsEnabled: { value: true, mode }
				}
			})
		);
		expect(
			resolveConversationFeatureSettings({}, agency)
				.featureVideoCallsEnabled
		).toBe(false);
	});
}

it('resolves only an explicit direct agency or a single persisted group assignment', () => {
	expect(
		resolveConversationAgencyId({
			agencyId: 101,
			assignedAgencies: [{ id: 102 }]
		})
	).toBe(101);
	expect(
		resolveConversationAgencyId({ assignedAgencies: [{ id: 101 }] })
	).toBe(101);
	for (const assignedAgencies of [
		[],
		[{ id: 0 }],
		[{ id: -1 }],
		[{ id: 101 }, { id: 102 }],
		[{ id: 101 }, { id: 101 }]
	]) {
		expect(
			resolveConversationAgencyId({ assignedAgencies })
		).toBeUndefined();
	}
	expect(resolveConversationAgencyId(undefined)).toBeUndefined();
});

it('requires the reserved practice room together with a reserved practice agency id', () => {
	const practice = {
		agencyId: -1,
		matrixRoomId: '!practice-policy:practice.invalid'
	};
	expect(resolveConversationAgencyId(practice)).toBe(-1);
	const realRoom = { ...practice, matrixRoomId: '!real:matrix.example' };
	expect(resolveConversationAgencyId(realRoom)).toBeUndefined();
	const missingRoom = { ...practice, matrixRoomId: undefined };
	expect(resolveConversationAgencyId(missingRoom)).toBeUndefined();
	expect(
		resolveConversationAgencyId({
			...practice,
			agencyId: Number.NEGATIVE_INFINITY
		})
	).toBeUndefined();
});
