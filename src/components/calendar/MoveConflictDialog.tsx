/**
 * A dragged entry would overlap own entries: ask before moving it, as the
 * creation dialogs do (review 4577641945).
 */
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { M3Dialog } from '../m3Dialog/M3Dialog';
import type { CalendarEntry } from './calendarModel';
import { useEntryLabel, useRangeFormat } from './useEntryLabel';

export interface MoveConflictDialogProps {
	conflicts: CalendarEntry[];
	fullScreen?: boolean;
	onConfirm: () => void;
	onCancel: () => void;
}

export const MoveConflictDialog = ({
	conflicts,
	fullScreen,
	onConfirm,
	onCancel
}: MoveConflictDialogProps) => {
	const { t } = useTranslation();
	const label = useEntryLabel();
	const format = useRangeFormat();
	return (
		<M3Dialog
			open
			data-testid="calendar-move-conflict"
			title={t('calendar.moveConflict.title')}
			width={400}
			fullScreen={fullScreen}
			onClose={onCancel}
			closeLabel={t('app.close')}
			actions={[
				{
					label: t('app.cancel'),
					onClick: onCancel,
					testId: 'calendar-move-cancel'
				},
				{
					label: t('calendar.moveConflict.confirm'),
					onClick: onConfirm,
					primary: true,
					testId: 'calendar-move-anyway'
				}
			]}
		>
			<p className="calendarDialog__note" role="status">
				{t('calendar.dialog.conflict', {
					list: conflicts
						.map((c) => `${label(c)} (${format(c.start, c.end)})`)
						.join(', ')
				})}
			</p>
		</M3Dialog>
	);
};
