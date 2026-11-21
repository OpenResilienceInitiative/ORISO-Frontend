/**
 * "Neuen Termin anlegen" on a cancelled appointment's card in the chat. The
 * create dialog belongs to the room's appointment slot
 * (`ConversationAppointmentSlot`), which alone knows whether this viewer may
 * create one in this conversation now — the same rule as the ⋮ menu's
 * "Termin anlegen". It lends its opener here, keyed by conversation; the
 * cards borrow it and show the shortcut only while it is lent.
 */
import { useSyncExternalStore } from 'react';

export interface AppointmentCreateLoan {
	/** Opens the create dialog of this conversation. */
	open: () => void;
	/** The conversation already has a coming appointment. */
	hasUpcoming: boolean;
}

const loans = new Map<number, AppointmentCreateLoan>();
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());

/** Lend the opener; the returned function takes it back. */
export const lendAppointmentCreate = (
	sessionId: number,
	loan: AppointmentCreateLoan
): (() => void) => {
	loans.set(sessionId, loan);
	emit();
	return () => {
		// A newer loan for the same conversation stays.
		if (loans.get(sessionId) !== loan) return;
		loans.delete(sessionId);
		emit();
	};
};

const subscribe = (listener: () => void) => {
	listeners.add(listener);
	return () => {
		listeners.delete(listener);
	};
};

/** The opener lent for this conversation, if any. */
export const useAppointmentCreate = (
	sessionId?: number
): AppointmentCreateLoan | undefined => {
	const snapshot = () =>
		sessionId === undefined ? undefined : loans.get(sessionId);
	return useSyncExternalStore(subscribe, snapshot, snapshot);
};
