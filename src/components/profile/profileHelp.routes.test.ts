// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { AUTHORITIES } from '../../globalState';
import { isTabGroup, solveGroupConditions } from '../../utils/tabsHelper';
import { profileRoutesHelp } from './profileHelp.routes';
import profileRoutes from './profile.routes';
import { EnableWalkthrough } from './EnableWalkthrough';
import { TourOverviewSection } from '../productTour/TourOverviewSection';
import { PracticeOverviewSection } from '../../practice/PracticeOverviewSection';

// The globalState barrel pulls lottie (crashes in jsdom): stub the player.
vi.mock('lottie-react', () => ({ default: () => null }));

const consultant = { grantedAuthorities: [AUTHORITIES.CONSULTANT_DEFAULT] };
const asker = { grantedAuthorities: [AUTHORITIES.ASKER_DEFAULT] };

const toursGroup = (enableWalkthrough: boolean) =>
	profileRoutesHelp({ enableWalkthrough } as never).find(
		(element) => isTabGroup(element) && element.url === '/rundgaenge'
	);

describe('Profile → Help → Tours (#1526)', () => {
	it('shows the tours area to counsellors when the platform switch is on', () => {
		const group = toursGroup(true);

		expect(solveGroupConditions(group, consultant, [])).toBe(true);
	});

	it('hides the tours area when the platform switch is off', () => {
		expect(solveGroupConditions(toursGroup(false), consultant, [])).toBe(
			false
		);
	});

	it('hides the tours area from advice seekers', () => {
		expect(solveGroupConditions(toursGroup(true), asker, [])).toBe(false);
	});

	it('mounts the tour switch and the tour list nowhere else in the profile', () => {
		const settings = { enableWalkthrough: true } as never;
		const mounts = profileRoutes(settings, null, ['de'], false)
			.flatMap((tab) =>
				tab.elements.flatMap((element) =>
					isTabGroup(element)
						? element.elements.map((child) => ({
								url: `${tab.url}${element.url}`,
								component: child.component
							}))
						: [{ url: tab.url, component: element.component }]
				)
			)
			.filter(
				({ component }) =>
					component === EnableWalkthrough ||
					component === TourOverviewSection
			)
			.map(({ url }) => url);

		expect(mounts).toEqual(['/hilfe/rundgaenge', '/hilfe/rundgaenge']);
	});

	describe('practice cards (#1622)', () => {
		const practiceElement = (settings: Record<string, unknown>) =>
			(
				profileRoutesHelp(settings as never).find(
					(element) =>
						isTabGroup(element) && element.url === '/rundgaenge'
				) as { elements: { component: unknown; condition: Function }[] }
			).elements.find(
				({ component }) => component === PracticeOverviewSection
			);

		const on = {
			enableWalkthrough: true,
			releaseToggles: { enablePracticeArea: true }
		};

		it('adds the practice cards to the tours group, after the tour list', () => {
			const group = profileRoutesHelp(on as never).find(
				(element) =>
					isTabGroup(element) && element.url === '/rundgaenge'
			) as { elements: { component: unknown }[] };

			expect(group.elements.map(({ component }) => component)).toEqual([
				EnableWalkthrough,
				TourOverviewSection,
				PracticeOverviewSection
			]);
		});

		it('shows them to counsellors with the master switch and the release flag on', () => {
			expect(practiceElement(on)!.condition(consultant, [])).toBe(true);
		});

		it('hides them while the release flag is off or unset', () => {
			expect(
				practiceElement({
					enableWalkthrough: true,
					releaseToggles: { enablePracticeArea: false }
				})!.condition(consultant, [])
			).toBe(false);
			expect(
				practiceElement({ enableWalkthrough: true })!.condition(
					consultant,
					[]
				)
			).toBe(false);
		});

		it('hides them while the master switch is off', () => {
			expect(
				practiceElement({
					...on,
					enableWalkthrough: false
				})!.condition(consultant, [])
			).toBe(false);
		});

		it('hides them from advice seekers', () => {
			expect(practiceElement(on)!.condition(asker, [])).toBe(false);
		});

		it('mounts them nowhere else in the profile', () => {
			const mounts = profileRoutes(on as never, null, ['de'], false)
				.flatMap((tab) =>
					tab.elements.flatMap((element) =>
						isTabGroup(element)
							? element.elements.map((child) => ({
									url: `${tab.url}${element.url}`,
									component: child.component
								}))
							: [{ url: tab.url, component: element.component }]
					)
				)
				.filter(
					({ component }) => component === PracticeOverviewSection
				)
				.map(({ url }) => url);

			expect(mounts).toEqual(['/hilfe/rundgaenge']);
		});
	});
});
