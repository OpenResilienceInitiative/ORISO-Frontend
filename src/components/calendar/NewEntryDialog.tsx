/**
 * "Neuer Eintrag" (prototype v17): one dialog for "Neu" and every other way
 * to enter something, with the tabs Termin | Sperrzeit. Each tab is the
 * form of the appointment or the blocker dialog; switching keeps what was
 * entered in the other. A counsellor also gets "Abwesenheit", a planned
 * absence over whole days (ORISO-Frontend#2303).
 */
import * as React from 'react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { M3Dialog } from '../m3Dialog/M3Dialog';
import { useAppointmentForm } from './AppointmentDialog';
import { useBlockerForm } from './BlockerDialog';
import { useAbsenceForm, type AbsenceDraft } from './AbsenceForm';
import type {
	AppointmentDraft,
	AppointmentKind,
	CalendarConversation,
	CalendarEntry
} from './calendarModel';

export type NewEntryTab = 'appointment' | 'blocker' | 'absence';

export interface NewEntryDialogProps {
	open: boolean;
	/** The tab it opens on. */
	initialTab: NewEntryTab;
	/** Preset range; without a kind the appointment tab offers the kind tiles. */
	slot?: { start: Date; end: Date; kind?: AppointmentKind };
	initialSessionId?: number;
	/** Blocker tab: weekdays ticked already. */
	initialWeekdays?: number[];
	initialAllDay?: boolean;
	initialNote?: string;
	conversations: CalendarConversation[];
	entries: CalendarEntry[];
	ownerId: string;
	now: Date;
	fullScreen?: boolean;
	onSaveAppointment: (draft: AppointmentDraft) => void;
	onSaveBlocker: (drafts: AppointmentDraft[]) => void;
	/** "Arbeitszeit festlegen" under the blocker form. */
	onWorkingHours?: () => void;
	/**
	 * Saves a planned absence; without it there is no "Abwesenheit" tab
	 * (ORISO-Frontend#2303).
	 */
	onSaveAbsence?: (draft: AbsenceDraft) => void;
	/** The absence the profile holds already, to edit it here. */
	initialAbsence?: Partial<AbsenceDraft>;
	onClose: () => void;
}

const TABS: NewEntryTab[] = ['appointment', 'blocker', 'absence'];

export const NewEntryDialog = ({
	open,
	initialTab,
	slot,
	initialSessionId,
	initialWeekdays,
	initialAllDay,
	initialNote,
	conversations,
	entries,
	ownerId,
	now,
	fullScreen,
	onSaveAppointment,
	onSaveBlocker,
	onWorkingHours,
	onSaveAbsence,
	initialAbsence,
	onClose
}: NewEntryDialogProps) => {
	const { t } = useTranslation();
	const [tab, setTab] = useState<NewEntryTab>(initialTab);
	const appointment = useAppointmentForm({
		slot,
		initialSessionId,
		conversations,
		entries,
		ownerId,
		now,
		onSave: onSaveAppointment,
		onClose
	});
	const blocker = useBlockerForm({
		slot: slot && { start: slot.start, end: slot.end },
		entries,
		ownerId,
		now,
		initialWeekdays,
		initialAllDay,
		initialNote,
		onWorkingHours,
		onSave: onSaveBlocker,
		onClose
	});
	const absence = useAbsenceForm({
		slot: slot && { start: slot.start, end: slot.end },
		initialAbsence,
		entries,
		ownerId,
		now,
		onSave: (draft) => onSaveAbsence?.(draft),
		onClose
	});
	const tabs = TABS.filter((value) => value !== 'absence' || onSaveAbsence);
	const shown = tabs.includes(tab) ? tab : 'appointment';
	const form =
		shown === 'appointment'
			? appointment
			: shown === 'blocker'
				? blocker
				: absence;

	return (
		<M3Dialog
			open={open}
			data-testid={form.testId}
			title={t('calendar.dialog.createTitle')}
			description={form.description}
			icon={form.icon}
			width={680}
			fullScreen={fullScreen}
			onClose={onClose}
			closeLabel={t('app.close')}
			actions={form.actions}
		>
			<div className="calendarNewEntry">
				<div
					className="calendarNewEntry__tabs"
					role="group"
					aria-label={t('calendar.dialog.entryKind')}
				>
					{tabs.map((value) => (
						<button
							key={value}
							type="button"
							className="calendarNewEntry__tab"
							aria-pressed={shown === value}
							onClick={() => setTab(value)}
							data-cy={`calendar-new-tab-${value}`}
						>
							{t(`calendar.dialog.tabs.${value}`)}
						</button>
					))}
				</div>
				{form.content}
			</div>
		</M3Dialog>
	);
};
