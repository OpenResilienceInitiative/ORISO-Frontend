/**
 * "Arbeitszeit festlegen" (ADR-032, UserService#1649): one window per
 * weekday. Outside them the calendar is shaded and the free-time search
 * does not look; booking ignores them.
 */
import * as React from 'react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { M3Dialog } from '../m3Dialog/M3Dialog';
import { Switch } from '../Switch';
import {
	groupWorkingHours,
	invalidRows,
	rowsToWorkingHours,
	workingHoursToRows,
	type WorkingDayRow,
	type WorkingHours
} from './calendarWorkingHours';

export interface WorkingHoursDialogProps {
	open: boolean;
	hours: WorkingHours;
	fullScreen?: boolean;
	onSave: (hours: WorkingHours) => void;
	onClose: () => void;
}

/** Long weekday names in the reader's language, by JavaScript weekday. */
export const useWeekdayNames = (style: 'long' | 'short' = 'long') => {
	const { i18n } = useTranslation();
	const locale = i18n.language?.startsWith('en') ? 'en-GB' : 'de-DE';
	const format = new Intl.DateTimeFormat(locale, { weekday: style });
	// 15 November 2026 is a Sunday.
	return (weekday: number) =>
		format.format(new Date(2026, 10, 15 + weekday)).replace(/\.$/, '');
};

/** "Mo–Fr 08:00–18:00, Sa 10:00–12:00", or undefined when none is set. */
export const useWorkingHoursSummary = () => {
	const dayName = useWeekdayNames('short');
	return (hours: WorkingHours) => {
		const groups = groupWorkingHours(hours);
		if (groups.length === 0) return undefined;
		return groups
			.map((g) => {
				const days =
					g.contiguous && g.weekdays.length > 2
						? `${dayName(g.weekdays[0])}–${dayName(g.weekdays[g.weekdays.length - 1])}`
						: g.weekdays.map(dayName).join(', ');
				return `${days} ${g.start}–${g.end}`;
			})
			.join(' · ');
	};
};

export const WorkingHoursDialog = ({
	open,
	hours,
	fullScreen,
	onSave,
	onClose
}: WorkingHoursDialogProps) => {
	const { t } = useTranslation();
	const dayName = useWeekdayNames();
	const [rows, setRows] = useState<WorkingDayRow[]>(() =>
		workingHoursToRows(hours)
	);
	const invalid = invalidRows(rows);
	const update = (weekday: number, patch: Partial<WorkingDayRow>) =>
		setRows((all) =>
			all.map((r) => (r.weekday === weekday ? { ...r, ...patch } : r))
		);

	return (
		<M3Dialog
			open={open}
			title={t('calendar.workingHours.title')}
			description={t('calendar.workingHours.description')}
			fullScreen={fullScreen}
			onClose={onClose}
			closeLabel={t('app.close')}
			data-testid="calendar-working-hours-dialog"
			actions={[
				{ label: t('app.cancel'), onClick: onClose },
				{
					label: t('calendar.workingHours.save'),
					primary: true,
					disabled: invalid.length > 0,
					onClick: () => onSave(rowsToWorkingHours(rows)),
					testId: 'calendar-working-hours-save'
				}
			]}
		>
			<div
				className="calendarHours"
				role="group"
				aria-label={t('calendar.workingHours.title')}
			>
				{rows.map((row) => {
					const name = dayName(row.weekday);
					const wrong = invalid.includes(row.weekday);
					return (
						<div
							key={row.weekday}
							className={`calendarHours__row${row.enabled ? '' : ' calendarHours__row--off'}`}
							data-cy={`calendar-hours-${row.weekday}`}
						>
							<Switch
								checked={row.enabled}
								onChange={(enabled) =>
									update(row.weekday, { enabled })
								}
								aria-label={name}
								showIcon={false}
							/>
							<span className="calendarHours__day">{name}</span>
							<label className="calendarHours__time">
								<span className="sr-only">
									{t('calendar.workingHours.from', {
										day: name
									})}
								</span>
								<input
									type="time"
									step={900}
									value={row.start}
									disabled={!row.enabled}
									aria-invalid={wrong || undefined}
									onChange={(e) =>
										update(row.weekday, {
											start: e.target.value
										})
									}
								/>
							</label>
							<span aria-hidden="true">–</span>
							<label className="calendarHours__time">
								<span className="sr-only">
									{t('calendar.workingHours.to', {
										day: name
									})}
								</span>
								<input
									type="time"
									step={900}
									value={row.end}
									disabled={!row.enabled}
									aria-invalid={wrong || undefined}
									onChange={(e) =>
										update(row.weekday, {
											end: e.target.value
										})
									}
								/>
							</label>
						</div>
					);
				})}
				{invalid.length > 0 && (
					<p className="calendarDialog__error" role="alert">
						{t('calendar.workingHours.invalid')}
					</p>
				)}
			</div>
		</M3Dialog>
	);
};
