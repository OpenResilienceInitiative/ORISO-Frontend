import { DEFAULT_CHIP_PRESENTATION } from '../../displayFilter/displayFilterTypes';
import type { SessionsToolbarDisplayFilterProps } from '../SessionsListToolbar';

/**
 * The toolbar props `SessionsList` passes in the running app, for story shells
 * that compose a whole screen by hand (App.Oriso chat surface, chat stage,
 * group chat stage).
 *
 * Without them the toolbar falls back to its component defaults: the old
 * kebab instead of the display-filter button, no "Weitere" chip and no
 * unread-first sorting. That is not what the app renders, so a screen story
 * built from those defaults misleads anyone designing against it.
 */
export const productionToolbarDisplayFilter: SessionsToolbarDisplayFilterProps =
	{
		label: 'Ansicht einstellen',
		customisedLabel: 'Ansicht angepasst',
		customised: false,
		open: false,
		// Same id as `SESSIONS_DISPLAY_FILTER_DIALOG_ID` in SessionsList.
		controlsId: 'sessions-display-filter-dialog',
		onOpen: () => undefined
	};

export const productionToolbarProps = {
	displayFilter: productionToolbarDisplayFilter,
	chipView: DEFAULT_CHIP_PRESENTATION.view,
	chipAutoSort: DEFAULT_CHIP_PRESENTATION.autoSort,
	showOtherChip: true
} as const;
