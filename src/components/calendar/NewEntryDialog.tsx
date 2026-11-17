/**
 * "Neuer Eintrag" (prototype v17): one dialog for "Neu" and every other way
 * to enter something, with the tabs Termin | Sperrzeit. Each tab is the
 * form of the appointment or the blocker dialog; switching keeps what was
 * entered in the other. A counsellor also gets "Abwesenheit", a planned
 * absence over whole days (ORISO-Frontend#2303).
 *
 * The switch is a WAI-ARIA tab list, since it changes the form below: one
 * Tab stop on the selected tab, the arrow keys (wrapping), Home and End
 * move and select, and the form sits in the tab panel the tabs control
 * (review 4595635797).
 */
import * as React from 'react';
import { useId, useRef, useState } from 'react';
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

/** Which tab a key moves to, from the index of the selected one among `count`. */
const TAB_KEYS: Partial<Record<string, (at: number, count: number) => number>> =
	{
		ArrowRight: (at, count) => (at + 1) % count,
		ArrowLeft: (at, count) => (at - 1 + count) % count,
		Home: () => 0,
		End: (_at, count) => count - 1
	};

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
	const ids = useId();
	const tabId = (value: NewEntryTab) => `${ids}-tab-${value}`;
	const panelId = `${ids}-panel`;
	const tabRefs = useRef<Partial<Record<NewEntryTab, HTMLButtonElement>>>({});
	// "Abwesenheit" only where an absence can be stored (#2303).
	const tabs = TABS.filter((value) => value !== 'absence' || onSaveAbsence);
	const shown = tabs.includes(tab) ? tab : 'appointment';
	const onTabKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
		const step = TAB_KEYS[event.key];
		if (!step) return;
		event.preventDefault();
		const next = tabs[step(tabs.indexOf(shown), tabs.length)];
		setTab(next);
		tabRefs.current[next]?.focus();
	};
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
					role="tablist"
					aria-label={t('calendar.dialog.entryKind')}
				>
					{tabs.map((value) => (
						<button
							key={value}
							ref={(el) => {
								if (el) tabRefs.current[value] = el;
								else delete tabRefs.current[value];
							}}
							type="button"
							role="tab"
							id={tabId(value)}
							className="calendarNewEntry__tab"
							aria-selected={shown === value}
							aria-controls={panelId}
							tabIndex={shown === value ? 0 : -1}
							onClick={() => setTab(value)}
							onKeyDown={onTabKeyDown}
							data-cy={`calendar-new-tab-${value}`}
						>
							{t(`calendar.dialog.tabs.${value}`)}
						</button>
					))}
				</div>
				<div
					role="tabpanel"
					id={panelId}
					aria-labelledby={tabId(shown)}
				>
					{form.content}
				</div>
			</div>
		</M3Dialog>
	);
};
