/**
 * One save path for an appointment in a conversation, whichever door it
 * comes from: "Termin anlegen" in a 1:1 and "Neuer Eintrag" in the calendar
 * both store the appointment with its Art and, with "Weitere Personen per
 * Link einladen", bind the invitation to that appointment (`appointmentId`,
 * ORISO-UserService#1648). The appointment comes first because only it
 * carries the Art; the invitation then meets at it.
 */
import {
	apiCreateSessionAppointment,
	apiMoveSessionAppointment
} from '../../api/apiSessionAppointments';
import { apiCreateSessionDirectInvitation } from '../../api/apiDirectLinks';
import { kindToApi } from '../calendar/calendarApiMapping';
import type { AppointmentKind } from '../calendar/calendarModel';
import type { DirectLink } from '../conversationCreate/directLink/directLink';
import { toAppointmentSlot } from '../sessionsList/timeline/conversationAppointments';
import { directInvitationSettings } from './directInvitationSettings';
import {
	MEDIUM_FOR_KIND,
	type InvitationLinkSettings,
	type InvitationSlot
} from './invitationModel';

/**
 * The appointment is stored, the invitation is not. A retry passes the
 * stored appointment back as `saved`, so it adds the link without a second
 * appointment.
 */
export class InvitationAfterAppointmentError extends Error {
	constructor(
		readonly appointmentId: string,
		readonly cause: unknown
	) {
		super('The appointment was saved, the invitation was not.');
		this.name = 'InvitationAfterAppointmentError';
	}
}

export interface AppointmentInvitationInput {
	sessionId: number;
	slot: InvitationSlot;
	kind?: AppointmentKind;
	/** `null`: no further people; only the appointment. */
	link: InvitationLinkSettings | null;
	/**
	 * A retry after {@link InvitationAfterAppointmentError}: the stored
	 * appointment, updated first when its time or Art was changed since.
	 */
	saved?: SavedAppointment;
}

/** The appointment a failed invitation left behind, as it is stored. */
export interface SavedAppointment {
	appointmentId: string;
	slot: InvitationSlot;
	kind?: AppointmentKind;
}

export interface AppointmentInvitationResult {
	appointmentId?: string;
	invitation?: DirectLink;
}

export const sameSlot = (a: InvitationSlot, b: InvitationSlot) =>
	a.start.getTime() === b.start.getTime() &&
	a.end.getTime() === b.end.getTime();

export const saveAppointmentInvitation = async ({
	sessionId,
	slot,
	kind,
	link,
	saved
}: AppointmentInvitationInput): Promise<AppointmentInvitationResult> => {
	const timeAndKind = {
		...toAppointmentSlot(slot.start, slot.end),
		...(kind ? { kind: kindToApi(kind) } : {})
	};
	let id = saved?.appointmentId;
	/* The link's medium follows the Art: a changed Art is stored first, so
	   appointment and link never disagree. */
	if (saved && (!sameSlot(saved.slot, slot) || saved.kind !== kind)) {
		await apiMoveSessionAppointment(
			sessionId,
			saved.appointmentId,
			timeAndKind
		);
	} else if (!saved) {
		id = (await apiCreateSessionAppointment(sessionId, timeAndKind))?.id;
	}
	if (!link) return { appointmentId: id };
	if (!id) throw new Error('appointment without id');
	/* The appointment is given by its id; only the link settings travel. */
	const { appointment: _slot, ...settings } = directInvitationSettings({
		appointment: slot,
		link
	});
	try {
		const invitation = await apiCreateSessionDirectInvitation(sessionId, {
			appointmentId: id,
			...(kind ? { medium: MEDIUM_FOR_KIND[kind] } : {}),
			...settings
		});
		return { appointmentId: id, invitation };
	} catch (cause) {
		throw new InvitationAfterAppointmentError(id, cause);
	}
};
