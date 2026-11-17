/**
 * "Ansicht · Kalender" (Frank *14, 2026-11-16): the calendar's display
 * settings in the same dialog as "Ansicht · Gespräche". Per kind: shown in
 * the calendar, a button in the kind row, and the profile's e-mail switch
 * for appointments. Replaces the old "Was anzeigen" menu; the quick kind
 * buttons stay where they are.
 */
import * as React from 'react';
import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import EventOutlinedIcon from '@mui/icons-material/EventOutlined';
import { DisplayFilterDialog } from '../displayFilter/DisplayFilterDialog';
import { useDisplayFilterLabels } from '../displayFilter/useDisplayFilterLabels';
import { useDisplayFilterEmailColumn } from '../displayFilter/useDisplayFilterEmailColumn';
import type {
	ChipView,
	DisplayFilterKindOption,
	DisplayFilterValue
} from '../displayFilter/displayFilterTypes';
import { resolveKindSetting } from '../displayFilter/displayFilterTypes';
import {
	CONSULTANT_SWITCHES,
	ADVICE_SEEKER_SWITCHES
} from '../profile/EmailNotifications/notificationMatrix';
import type { EmailSettingRole } from '../displayFilter/emailSettingForKind';
import {
	CALENDAR_FACETS,
	FACET_ICON_COMPONENT,
	type CalendarEntryFacet
} from './CalendarEntryGlyph';

/** Kinds that can have a button in the kind row. */
export const CALENDAR_CHIP_FACETS: CalendarEntryFacet[] = [
	'video',
	'phone',
	'onsite',
	'chat',
	'blocker'
];

/**
 * One profile switch covers every appointment e-mail (booked, moved,
 * cancelled, reminder, move proposal); blocked time sends none.
 */
const appointmentSwitch = (
	_section: unknown,
	kindId: string,
	role: EmailSettingRole
) =>
	kindId === 'blocker'
		? null
		: ((role === 'consultant'
				? CONSULTANT_SWITCHES
				: ADVICE_SEEKER_SWITCHES
			).find((entry) => entry.id === 'appointment') ?? null);

export interface CalendarSettingsDialogProps {
	open: boolean;
	onClose: () => void;
	hiddenFacets: CalendarEntryFacet[];
	onHiddenChange: (next: CalendarEntryFacet[]) => void;
	chipFacets: CalendarEntryFacet[];
	onChipsChange: (next: CalendarEntryFacet[]) => void;
	/** How the kind buttons look, as in Gespräche. */
	chipView: ChipView;
	onChipViewChange: (next: ChipView) => void;
	fullScreen?: boolean;
	id?: string;
}

export const CalendarSettingsDialog = ({
	open,
	onClose,
	hiddenFacets,
	onHiddenChange,
	chipFacets,
	onChipsChange,
	chipView,
	onChipViewChange,
	fullScreen,
	id = 'calendar-settings'
}: CalendarSettingsDialogProps) => {
	const { t } = useTranslation();
	const { dialogLabels } = useDisplayFilterLabels('sessions');
	const email = useDisplayFilterEmailColumn('sessions', appointmentSwitch);

	const labels = useMemo(
		() => ({
			...dialogLabels,
			title: t('calendar.viewSettings.title'),
			description: t('calendar.viewSettings.description'),
			kindsHeading: t('calendar.viewSettings.kindsHeading'),
			showColumn: t('calendar.viewSettings.showColumn'),
			legendShow: t('calendar.viewSettings.legendShow'),
			pillColumn: t('calendar.viewSettings.pillColumn'),
			legendPill: t('calendar.viewSettings.legendPill'),
			legendEmail: t('calendar.viewSettings.legendEmail'),
			showKind: (kind: string) =>
				t('calendar.viewSettings.showKind', { kind }),
			pillKind: (kind: string) =>
				t('calendar.viewSettings.pillKind', { kind }),
			pillMenu: (kind: string) =>
				t('calendar.viewSettings.pillMenu', { kind })
		}),
		[dialogLabels, t]
	);

	const kinds = useMemo<DisplayFilterKindOption[]>(
		() =>
			CALENDAR_FACETS.map((facet) => ({
				id: facet,
				label:
					facet === 'blocker'
						? t('calendar.kindsMenu.blocker')
						: t(`calendar.facets.${facet}`),
				icon: FACET_ICON_COMPONENT[facet],
				// Group dates have no button of their own in the kind row.
				showOnly: !CALENDAR_CHIP_FACETS.includes(facet)
			})),
		[t]
	);

	const value = useMemo<DisplayFilterValue>(
		() => ({
			autoReadHidden: false,
			view: chipView,
			kinds: Object.fromEntries(
				CALENDAR_FACETS.map((facet) => [
					facet,
					{
						show: !hiddenFacets.includes(facet),
						pill: chipFacets.includes(facet)
					}
				])
			)
		}),
		[hiddenFacets, chipFacets, chipView]
	);

	const onChange = useCallback(
		(next: DisplayFilterValue) => {
			const shown = (facet: CalendarEntryFacet) =>
				resolveKindSetting(next, facet).show;
			const hidden = CALENDAR_FACETS.filter((facet) => !shown(facet));
			if (hidden.join() !== hiddenFacets.join()) onHiddenChange(hidden);
			const chips = CALENDAR_CHIP_FACETS.filter(
				(facet) => resolveKindSetting(next, facet).pill
			);
			if (chips.join() !== chipFacets.join()) onChipsChange(chips);
			if (next.view && next.view !== chipView)
				onChipViewChange(next.view);
		},
		[
			hiddenFacets,
			chipFacets,
			chipView,
			onHiddenChange,
			onChipsChange,
			onChipViewChange
		]
	);

	const customised =
		hiddenFacets.length > 0 ||
		chipFacets.length !== CALENDAR_CHIP_FACETS.length ||
		chipView !== 'icons';

	return (
		<DisplayFilterDialog
			open={open}
			onClose={onClose}
			kinds={kinds}
			value={value}
			onChange={onChange}
			onReset={() => {
				onHiddenChange([]);
				onChipsChange(CALENDAR_CHIP_FACETS);
				onChipViewChange('icons');
			}}
			canReset={customised}
			showAutoRead={false}
			showPresentation="view"
			columns={{ show: true, sound: false }}
			email={email}
			labels={labels}
			icon={<EventOutlinedIcon />}
			fullScreen={fullScreen}
			id={id}
		/>
	);
};
