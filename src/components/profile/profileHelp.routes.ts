import { AUTHORITIES, hasUserAuthority } from '../../globalState';
import { AppSettingsInterface } from '../../globalState/interfaces';
import {
	COLUMN_LEFT,
	COLUMN_RIGHT,
	SingleComponentType,
	TabGroups
} from '../../utils/tabsHelper';
import { Help } from '../help/Help';
import { TourOverviewSection } from '../productTour/TourOverviewSection';
import { Documentation } from './Documentation';
import { EnableWalkthrough } from './EnableWalkthrough';

const showsTours = (settings: AppSettingsInterface, userData): boolean =>
	!!settings?.enableWalkthrough &&
	hasUserAuthority(AUTHORITIES.CONSULTANT_DEFAULT, userData);

export const profileRoutesHelp = (
	settings: AppSettingsInterface
): (TabGroups | SingleComponentType)[] => [
	{
		title: 'profile.routes.help.videoCall',
		url: '/videoCall',
		elements: [
			{
				component: Help,
				column: COLUMN_LEFT,
				condition: () => !settings?.documentationEnabled
			}
		]
	},
	{
		title: 'profile.documentation.title',
		url: '/docs',
		externalLink: true,
		elements: [
			{
				component: Documentation,
				column: COLUMN_LEFT,
				condition: () => !!settings?.documentationEnabled
			}
		]
	},
	{
		title: 'profile.routes.help.tours',
		url: '/rundgaenge',
		elements: [
			{
				component: EnableWalkthrough,
				column: COLUMN_RIGHT,
				condition: (userData) => showsTours(settings, userData)
			},
			{
				component: TourOverviewSection,
				column: COLUMN_RIGHT,
				condition: (userData) => showsTours(settings, userData)
			}
		]
	}
];
