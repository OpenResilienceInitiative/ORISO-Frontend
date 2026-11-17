/**
 * "Neuer Eintrag" (prototype v17): one dialog for "Neu" and every other way
 * to enter something, with the tabs Termin | Sperrzeit. "Termin" is the
 * shared invitation form (one flow with "Chat erstellen" and the 1:1's
 * "Termin anlegen"), "Sperrzeit" the blocker form; switching keeps what was
 * entered in the other.
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
import { useCalendarInvitationForm } from './useCalendarInvitationForm';
import { useBlockerForm } from './BlockerDialog';
import type { InvitationPreset } from '../directInvitation/invitationModel';
import type { DirectLinkMedium } from '../conversationCreate/directLink/directLink';
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
	/** Termin: the media "Direkteinladung erlauben" allows (the Art's medium). */
	inviteMedia?: readonly DirectLinkMedium[];
	/** Termin: "Neue Person per Direkteinladung …" opens "Chat erstellen". */
	onInviteNewPerson?: (preset: InvitationPreset) => void;
	onClose: () => void;
}

const TABS: NewEntryTab[] = ['appointment', 'blocker'];

/** Which tab a key moves to, from the index of the selected one. */
const TAB_KEYS: Partial<Record<string, (at: number) => number>> = {
	ArrowRight: (at) => (at + 1) % TABS.length,
	ArrowLeft: (at) => (at - 1 + TABS.length) % TABS.length,
	Home: () => 0,
	End: () => TABS.length - 1
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
	allowGuestInvite,
	inviteMedia,
	onInviteNewPerson,
	onClose
}: NewEntryDialogProps) => {
	const { t } = useTranslation();
	const [tab, setTab] = useState<NewEntryTab>(initialTab);
	const ids = useId();
	const tabId = (value: NewEntryTab) => `${ids}-tab-${value}`;
	const panelId = `${ids}-panel`;
	const tabRefs = useRef<Partial<Record<NewEntryTab, HTMLButtonElement>>>({});
	const onTabKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
		const step = TAB_KEYS[event.key];
		if (!step) return;
		event.preventDefault();
		const next = TABS[step(TABS.indexOf(tab))];
		setTab(next);
		tabRefs.current[next]?.focus();
	};
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
		inviteMedia,
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
					role="tablist"
					aria-label={t('calendar.dialog.entryKind')}
				>
					{TABS.map((value) => (
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
							aria-selected={tab === value}
							aria-controls={panelId}
							tabIndex={tab === value ? 0 : -1}
							onClick={() => setTab(value)}
							onKeyDown={onTabKeyDown}
							data-cy={`calendar-new-tab-${value}`}
						>
							{t(`calendar.dialog.tabs.${value}`)}
						</button>
					))}
				</div>
				<div role="tabpanel" id={panelId} aria-labelledby={tabId(tab)}>
					{form.content}
				</div>
			</div>
		</M3Dialog>
	);
};
