// @vitest-environment oriso-jsdom
/**
 * FE#2491: the team chat of an open enquiry is decided like supervision —
 * the effective platform -> Träger -> Beratungsstelle value, read through
 * the same resolver the open conversation uses.
 */
import { describe, expect, it } from 'vite-plus/test';
import { resolveFeaturesForAgencyPolicy } from '../hooks/useConversationFeatureSettings';
import { canonicalAgencySettings } from '../test/fixtures/conversationPolicyFixtures';
import {
	isTeamDiscussionAfterAcceptEnabled,
	isTeamDiscussionEnabled
} from './conversationFeatureSettings';
import { hasMediaUploadFeature } from './mediaUploadHelpers';

const ready = (settings = canonicalAgencySettings()) => ({
	agencyId: 101,
	tenantId: 7,
	state: 'ready' as const,
	settings
});

const effective = (
	tenant: Record<string, boolean>,
	policy?: ReturnType<typeof ready> | { agencyId: number; state: 'loading' }
) => resolveFeaturesForAgencyPolicy(tenant, policy as any, 101, 7);

describe('team chat feature gate (FE#2491)', () => {
	it('is on when Träger and Beratungsstelle both have it on', () => {
		expect(
			isTeamDiscussionEnabled(
				effective({ featureTeamDiscussionEnabled: true }, ready())
			)
		).toBe(true);
	});

	it('is off when the Träger has it off (no agency answer in play)', () => {
		expect(
			isTeamDiscussionEnabled(
				effective({ featureTeamDiscussionEnabled: false })
			)
		).toBe(false);
	});

	it('is off when the Beratungsstelle has it off, although the Träger has it on', () => {
		expect(
			isTeamDiscussionEnabled(
				effective(
					{ featureTeamDiscussionEnabled: true },
					ready(
						canonicalAgencySettings({
							featureTeamDiscussionEnabled: false
						})
					)
				)
			)
		).toBe(false);
	});

	it('takes the server-resolved agency value — a Träger requirement arrives as ENFORCED', () => {
		expect(
			isTeamDiscussionEnabled(
				effective(
					{ featureTeamDiscussionEnabled: false },
					ready(canonicalAgencySettings({}, 'ENFORCED'))
				)
			)
		).toBe(true);
	});

	it('grants nothing while the agency answer is still loading', () => {
		expect(
			isTeamDiscussionEnabled(
				effective(
					{ featureTeamDiscussionEnabled: true },
					{ agencyId: 101, state: 'loading' }
				)
			)
		).toBe(false);
	});

	it('keeps the old default for tenants that never set it', () => {
		expect(isTeamDiscussionEnabled(effective({}))).toBe(true);
	});

	it('asks the team chat its own media upload feature, not the 1:1 one', () => {
		const features = effective(
			{},
			ready(
				canonicalAgencySettings({
					featureMediaUploadTeamDiscussionsEnabled: false
				})
			)
		);
		expect(hasMediaUploadFeature(features, 'team')).toBe(false);
		expect(hasMediaUploadFeature(features, 'oneOnOne')).toBe(true);
	});

	describe('after accept', () => {
		it('stays off by default — accept archives it read-only (ADR-016)', () => {
			expect(
				isTeamDiscussionAfterAcceptEnabled(
					effective({ featureTeamDiscussionEnabled: true })
				)
			).toBe(false);
		});

		it('is on only where Träger AND Beratungsstelle keep it after accept', () => {
			const tenant = {
				featureTeamDiscussionEnabled: true,
				featureTeamDiscussionAfterAcceptEnabled: true
			};
			expect(isTeamDiscussionAfterAcceptEnabled(effective(tenant))).toBe(
				true
			);
			expect(
				isTeamDiscussionAfterAcceptEnabled(
					effective(
						tenant,
						ready(
							canonicalAgencySettings({
								featureTeamDiscussionAfterAcceptEnabled: false
							})
						)
					)
				)
			).toBe(false);
		});

		it('is never effective while the team chat itself is off', () => {
			expect(
				isTeamDiscussionAfterAcceptEnabled(
					effective({
						featureTeamDiscussionEnabled: false,
						featureTeamDiscussionAfterAcceptEnabled: true
					})
				)
			).toBe(false);
		});
	});
});
