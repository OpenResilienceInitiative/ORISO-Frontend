import { AUTHORITIES, hasUserAuthority } from '../../globalState';
import {
	AppConfigInterface,
	AppSettingsInterface
} from '../../globalState/interfaces';
import {
	COLUMN_LEFT,
	COLUMN_RIGHT,
	SingleComponentType,
	TabGroups
} from '../../utils/tabsHelper';
import { Help } from '../help/Help';
import { Documentation } from './Documentation';
import { HelpToursSection } from './HelpToursSection';
import VideocamOutlinedIcon from '@mui/icons-material/VideocamOutlined';
import MenuBookOutlinedIcon from '@mui/icons-material/MenuBookOutlined';
import ExploreOutlinedIcon from '@mui/icons-material/ExploreOutlined';

const showsTours = (settings: AppSettingsInterface, userData): boolean =>
	!!settings?.enableWalkthrough &&
	hasUserAuthority(AUTHORITIES.CONSULTANT_DEFAULT, userData);

export const profileRoutesHelp = (
	settings: AppSettingsInterface & Pick<AppConfigInterface, 'releaseToggles'>
): (TabGroups | SingleComponentType)[] => [
	{
		title: 'profile.routes.help.videoCall',
		url: '/videoCall',
		elements: [
			{
				component: Help,
				icon: VideocamOutlinedIcon,
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
				icon: MenuBookOutlinedIcon,
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
				component: HelpToursSection,
				icon: ExploreOutlinedIcon,
				column: COLUMN_RIGHT,
				condition: (userData) => showsTours(settings, userData)
			}
		]
	}
];
