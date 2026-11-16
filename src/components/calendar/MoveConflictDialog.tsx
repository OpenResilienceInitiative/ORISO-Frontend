/**
 * A dragged entry would overlap own entries: ask before moving it, as the
 * creation dialogs do (review 4577641945). A new entry made outside the
 * creation dialogs (quick entry, a blocker from the grid or the month) asks
 * the same question with the dialogs' title and "Trotzdem anlegen"
 * (review 4582758042).
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
	/** Already translated; defaults to "Trotzdem verschieben?". */
	title?: string;
	/** Already translated; defaults to "Trotzdem verschieben". */
	confirmLabel?: string;
	/** `calendar-move` gives `calendar-move-conflict`, `-cancel`, `-anyway`. */
	testIdPrefix?: string;
}

export const MoveConflictDialog = ({
	conflicts,
	fullScreen,
	onConfirm,
	onCancel,
	title,
	confirmLabel,
	testIdPrefix = 'calendar-move'
}: MoveConflictDialogProps) => {
	const { t } = useTranslation();
	const label = useEntryLabel();
	const format = useRangeFormat();
	return (
		<M3Dialog
			open
			data-testid={`${testIdPrefix}-conflict`}
			title={title ?? t('calendar.moveConflict.title')}
			width={400}
			fullScreen={fullScreen}
			onClose={onCancel}
			closeLabel={t('app.close')}
			actions={[
				{
					label: t('app.cancel'),
					onClick: onCancel,
					testId: `${testIdPrefix}-cancel`
				},
				{
					label: confirmLabel ?? t('calendar.moveConflict.confirm'),
					onClick: onConfirm,
					primary: true,
					testId: `${testIdPrefix}-anyway`
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
