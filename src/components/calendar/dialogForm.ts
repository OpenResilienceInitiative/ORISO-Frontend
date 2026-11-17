/**
 * The calendar's creation forms without their dialog frame. "Neuer Eintrag"
 * puts the appointment ("Termin", the shared invitation form) and the
 * blocker form under one title with tabs (prototype v17); each keeps its
 * state.
 */
import type * as React from 'react';
import type { M3DialogAction } from '../m3Dialog/M3Dialog';
import type {
	AppointmentDraft,
	AppointmentKind,
	CalendarConversation,
	CalendarEntry
} from './calendarModel';

/** What the frame shows around a form, and the form itself. */
export interface DialogForm {
	description?: React.ReactNode;
	icon?: React.ReactNode;
	width: number;
	actions: M3DialogAction[];
	content: React.ReactNode;
	/** The dialog's `data-testid` while this form shows. */
	testId: string;
}

/** What the "Termin" form is given by the calendar. */
export interface AppointmentFormProps {
	/**
	 * Preset from a selected slot; absent when opened from the button. A
	 * slot without a kind ("Neuer Eintrag" from a drag) still offers the
	 * kind tiles.
	 */
	slot?: { start: Date; end: Date; kind?: AppointmentKind };
	/** Preset conversation, e.g. from the quick entry. */
	initialSessionId?: number;
	conversations: CalendarConversation[];
	entries: CalendarEntry[];
	ownerId: string;
	now: Date;
	onSave: (draft: AppointmentDraft) => void;
	onClose: () => void;
}
