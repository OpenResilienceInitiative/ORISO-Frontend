import { readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { describe, expect, it } from 'vite-plus/test';
import { consultantProfileTour } from './profileTour';
import { itKeepsTheTourContract } from './tourDefinitionContract.testkit';

const settingsRoutes = readFileSync(
	resolve(
		dirname(fileURLToPath(import.meta.url)),
		'../../profile/profileSettings.routes.ts'
	),
	'utf8'
);

describe('consultant-profile', () => {
	itKeepsTheTourContract(consultantProfileTour, 'consultant');

	const steps = consultantProfileTour.steps;

	it('walks the profile tabs in order, one card each', () => {
		expect(steps.map((step) => [step.route, step.target])).toEqual([
			['/profile/allgemeines', 'profile-overview'],
			['/profile/allgemeines/oeffentlich', 'profile-public'],
			['/profile/aktivitaeten/abwesenheit', 'profile-absence'],
			['/profile/einstellungen/email', 'profile-notifications'],
			['/profile/einstellungen/sicherheit', 'profile-security'],
			['/profile/einstellungen/anzeige', 'profile-display'],
			['/profile/einstellungen/tastatur', 'profile-shortcuts'],
			['/profile/hilfe/rundgaenge', 'help-tour-switch']
		]);
	});

	it('keeps only always-present cards mandatory', () => {
		expect(
			steps.filter((step) => !step.optional).map((step) => step.id)
		).toEqual(['overview', 'security', 'help-tours']);
	});

	it('places card steps automatically (cards can sit below the fold)', () => {
		steps
			.filter((step) => step.id !== 'overview')
			.forEach((step) => expect(step.placement).toBe('auto'));
	});

	it('tags every alternative notification card with the same anchor', () => {
		expect(
			settingsRoutes.match(/tourTarget: 'profile-notifications'/g)
		).toHaveLength(4);
	});

	it('leaves account deletion out', () => {
		expect(
			steps.some((step) => /delet|loesch/i.test(step.target + step.id))
		).toBe(false);
	});
});
