import { describe, expect, it } from 'vite-plus/test';
import { getAvailableTours } from '../tourCatalogue';
import { frontendTopicTours } from '../tourDefinitions';
import { askerSettingsTour } from './askerSettingsTour';
import { itKeepsTheTourContract } from './tourDefinitionContract.testkit';

describe('asker-settings', () => {
	itKeepsTheTourContract(askerSettingsTour, 'asker');

	it('walks security first, then notifications and display', () => {
		expect(
			askerSettingsTour.steps.map((step) => [step.id, step.target])
		).toEqual([
			['intro', ''],
			['password', 'settings-password'],
			['two-factor', 'settings-2fa'],
			['recovery', 'settings-recovery'],
			['delete-account', 'settings-delete-account'],
			['notifications', 'settings-notifications'],
			['display', 'settings-display'],
			['done', '']
		]);
	});

	it('keeps only the steps whose cards may be absent optional', () => {
		expect(
			askerSettingsTour.steps
				.filter((step) => step.optional)
				.map((step) => step.id)
		).toEqual(['password', 'two-factor', 'notifications']);
	});

	it('starts on the settings tab and places card steps automatically', () => {
		expect(askerSettingsTour.steps[0].route).toBe('/profile/einstellungen');
		askerSettingsTour.steps
			.filter((step) => step.target !== '')
			.forEach((step) => {
				expect(step.placement).toBe('auto');
				expect(step.route).toMatch(
					/^\/profile\/einstellungen\/(sicherheit|email|anzeige)$/
				);
			});
	});

	it('is registered last and offered to askers only', () => {
		expect(frontendTopicTours.at(-1)?.id).toBe('asker-settings');
		expect(
			getAvailableTours(frontendTopicTours, 'asker').map(
				(tour) => tour.id
			)
		).toEqual(['asker-first-steps', 'asker-settings']);
		expect(
			getAvailableTours(frontendTopicTours, 'consultant').map(
				(tour) => tour.id
			)
		).not.toContain('asker-settings');
	});
});
