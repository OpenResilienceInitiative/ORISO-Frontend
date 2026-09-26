// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { AUTHORITIES } from '../../globalState';
import { isTabGroup, solveGroupConditions } from '../../utils/tabsHelper';
import { profileRoutesHelp } from './profileHelp.routes';
import profileRoutes from './profile.routes';
import { EnableWalkthrough } from './EnableWalkthrough';
import { TourOverviewSection } from '../productTour/TourOverviewSection';

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
});
