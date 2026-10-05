import { AppSettingsInterface } from '../../globalState/interfaces';
import {
	COLUMN_LEFT,
	SingleComponentType,
	TabGroups
} from '../../utils/tabsHelper';
import { Help } from '../help/Help';
import { Documentation } from './Documentation';
import VideocamOutlinedIcon from '@mui/icons-material/VideocamOutlined';
import MenuBookOutlinedIcon from '@mui/icons-material/MenuBookOutlined';

export const profileRoutesHelp = (
	settings: AppSettingsInterface
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
	}
];
