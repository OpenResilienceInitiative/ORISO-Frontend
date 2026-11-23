import { describe, expect, it } from 'vite-plus/test';
import type { UserDataInterface } from '../../../globalState/interfaces';
import { getAvailableTours } from '../tourCatalogue';
import { frontendTours } from '../tourDefinitions';
import {
	consultantGroupCircleTour,
	isGroupCircleTourAvailable
} from './groupCircleTour';
import { itKeepsTheTourContract } from './tourDefinitionContract.testkit';

const withAgencies = (
	agencies: Array<{ id: number; settings?: unknown }>
): UserDataInterface => ({ agencies }) as unknown as UserDataInterface;

describe('consultant-group-circle', () => {
	itKeepsTheTourContract(consultantGroupCircleTour, 'consultant');

	const steps = consultantGroupCircleTour.steps;

	it('goes from the create entry over the circle card to the settings', () => {
		expect(steps.map((step) => [step.id, step.target])).toEqual([
			['intro', ''],
			['create', 'groupchat-create-button'],
			['format', 'groupchat-format-circle'],
			['topic', 'groupchat-topic-picker'],
			['settings', ''],
			['done', '']
		]);
		expect(steps.find((step) => step.id === 'format')?.route).toBe(
			'/sessions/consultant/sessionView/createGroupChat/'
		);
	});

	it('makes the create button, card and topic picker optional', () => {
		expect(
			steps.filter((step) => step.optional).map((step) => step.id)
		).toEqual(['create', 'format', 'topic']);
	});

	describe('availability (circle format on)', () => {
		it('is off when neither flag is set (unset means OFF)', () => {
			expect(isGroupCircleTourAvailable({ flags: {} })).toBe(false);
			expect(isGroupCircleTourAvailable({})).toBe(false);
		});

		it('follows featureGroupChatV2Enabled when the circle flag is unset', () => {
			expect(
				isGroupCircleTourAvailable({
					flags: { featureGroupChatV2Enabled: true }
				})
			).toBe(true);
		});

		it('lets the explicit circle flag win over the v2 fallback', () => {
			expect(
				isGroupCircleTourAvailable({
					flags: {
						featureGroupChatV2Enabled: true,
						featureSelfHelpGroupsEnabled: false
					}
				})
			).toBe(false);
			expect(
				isGroupCircleTourAvailable({
					flags: { featureSelfHelpGroupsEnabled: true }
				})
			).toBe(true);
		});

		it('is off whatever the circle flag says when v2 is switched off', () => {
			expect(
				isGroupCircleTourAvailable({
					flags: {
						featureGroupChatV2Enabled: false,
						featureSelfHelpGroupsEnabled: true
					}
				})
			).toBe(false);
		});

		it('honours agency policies of the counsellor', () => {
			const flags = { featureSelfHelpGroupsEnabled: true };
			expect(
				isGroupCircleTourAvailable({
					flags,
					userData: withAgencies([
						{
							id: 1,
							settings: { featureSelfHelpGroupsEnabled: false }
						}
					])
				})
			).toBe(false);
			expect(
				isGroupCircleTourAvailable({
					flags,
					userData: withAgencies([
						{
							id: 1,
							settings: { featureSelfHelpGroupsEnabled: false }
						},
						{ id: 2 }
					])
				})
			).toBe(true);
		});

		it('is registered, so the Help list and launcher drop it when off', () => {
			const ids = (flags: Record<string, unknown>) =>
				getAvailableTours(frontendTours, 'consultant', { flags }).map(
					(tour) => tour.id
				);
			expect(ids({})).not.toContain('consultant-group-circle');
			expect(ids({ featureSelfHelpGroupsEnabled: true })).toContain(
				'consultant-group-circle'
			);
		});
	});
});
