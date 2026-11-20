/**
 * "Termine automatisch annehmen" (FE#2305, Frank 2026-11-17): each
 * counsellor keeps a list of colleagues whose appointments are fixed at
 * once. An appointment from anyone else waits until it is accepted.
 * Reached from the calendar's more menu.
 */
import * as React from 'react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import EventAvailableOutlinedIcon from '@mui/icons-material/EventAvailableOutlined';
import { M3Dialog } from '../m3Dialog/M3Dialog';
import { OrisoMultiSelect } from '../form/OrisoSelect';
import type { Colleague } from './calendarModel';

export interface AutoAcceptDialogProps {
	open: boolean;
	/** The calendar's colleague list: everyone in reach. */
	colleagues: Colleague[];
	/** Ids on the list now. */
	selected: string[];
	fullScreen?: boolean;
	onSave: (colleagueIds: string[]) => void;
	onClose: () => void;
}

export const AutoAcceptDialog = ({
	open,
	colleagues,
	selected,
	fullScreen,
	onSave,
	onClose
}: AutoAcceptDialogProps) => {
	const { t } = useTranslation();
	const [chosen, setChosen] = useState<string[]>(selected);
	return (
		<M3Dialog
			open={open}
			data-testid="calendar-auto-accept-dialog"
			title={t('calendar.autoAccept.title')}
			description={t('calendar.autoAccept.description')}
			icon={<EventAvailableOutlinedIcon />}
			width={480}
			fullScreen={fullScreen}
			onClose={onClose}
			closeLabel={t('app.close')}
			actions={[
				{ label: t('app.cancel'), onClick: onClose },
				{
					label: t('calendar.autoAccept.save'),
					onClick: () => onSave(chosen),
					primary: true,
					testId: 'calendar-auto-accept-save'
				}
			]}
		>
			<div className="calendarDialog__fields">
				<OrisoMultiSelect
					label={t('calendar.autoAccept.colleagues')}
					value={chosen}
					options={colleagues.map((c) => ({
						value: c.id,
						label: c.agencyName
							? `${c.displayName} · ${c.agencyName}`
							: c.displayName
					}))}
					onChange={(event) => {
						const { value } = event.target;
						setChosen(
							typeof value === 'string' ? value.split(',') : value
						);
					}}
					searchable
					searchPlaceholder={t('calendar.autoAccept.search')}
					fullWidth
				/>
				<p className="calendarDialog__note">
					{t('calendar.autoAccept.hint')}
				</p>
			</div>
		</M3Dialog>
	);
};
