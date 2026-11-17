/**
 * "Neuer Eintrag" (prototype v17): one dialog for "Neu" and every other way
 * to enter something, with the tabs Termin | Sperrzeit. "Termin" is the
 * shared invitation form (one flow with "Chat erstellen" and the 1:1's
 * "Termin anlegen"), "Sperrzeit" the blocker form; switching keeps what was
 * entered in the other.
 */
import * as React from 'react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { M3Dialog } from '../m3Dialog/M3Dialog';
import { useCalendarInvitationForm } from './useCalendarInvitationForm';
import { useBlockerForm } from './BlockerDialog';
import type { InvitationPreset } from '../directInvitation/invitationModel';
import type {
	AppointmentDraft,
	AppointmentKind,
	CalendarConversation,
	CalendarEntry
} from './calendarModel';

export type NewEntryTab = 'appointment' | 'blocker';

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
	/** Termin: "Weitere Personen per Link einladen", as in the 1:1. */
	allowGuestInvite?: boolean;
	/** Termin: "Neue Person per Direkteinladung …" opens "Chat erstellen". */
	onInviteNewPerson?: (preset: InvitationPreset) => void;
	onClose: () => void;
}

const TABS: NewEntryTab[] = ['appointment', 'blocker'];

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
	allowGuestInvite,
	onInviteNewPerson,
	onClose
}: NewEntryDialogProps) => {
	const { t } = useTranslation();
	const [tab, setTab] = useState<NewEntryTab>(initialTab);
	/* The shared invitation form of "Chat erstellen" and the 1:1. */
	const appointment = useCalendarInvitationForm({
		slot,
		initialSessionId,
		conversations,
		entries,
		ownerId,
		now,
		onSave: onSaveAppointment,
		allowGuestInvite,
		onInviteNewPerson,
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
	const form = tab === 'appointment' ? appointment : blocker;

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
					{TABS.map((value) => (
						<button
							key={value}
							type="button"
							className="calendarNewEntry__tab"
							aria-pressed={tab === value}
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
