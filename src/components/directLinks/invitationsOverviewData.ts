/**
 * #2252 "Termine & Direkteinladungen": the counsellor's direct links and
 * 1:1 appointments as the overview's two sections. An invitation with an
 * appointment is listed by its date; a 1:1 appointment that already has an
 * invitation appears once, with the invitation's link.
 */
import type { SessionAppointment } from '../../api/apiSessionAppointments';
import type { DirectLink } from '../conversationCreate/directLink/directLink';
import type { UpcomingInvitation } from '../directInvitation/InvitationsOverview';

export const APPOINTMENT_ROW_PREFIX = 'appointment-';

export const invitationRow = (link: DirectLink): UpcomingInvitation | null =>
	link.appointment
		? {
				id: link.id,
				name: link.name,
				url: link.url,
				medium: link.medium,
				start: new Date(link.appointment.start),
				end: new Date(link.appointment.end),
				...(link.access ? { access: link.access } : {}),
				...(link.knock !== undefined ? { knock: link.knock } : {}),
				...(link.expiresAt
					? { expiresAt: new Date(link.expiresAt) }
					: {})
			}
		: null;

export const overviewSections = (
	links: readonly DirectLink[],
	sessionAppointments: readonly SessionAppointment[],
	appointmentName: string
): { appointments: UpcomingInvitation[]; links: DirectLink[] } => {
	const withDate = links.filter((link) => link.appointment);
	const bound = new Set(withDate.map((link) => link.appointment!.id));
	const oneToOne = sessionAppointments
		.filter(
			(appointment) =>
				appointment.status === 'SCHEDULED' && !bound.has(appointment.id)
		)
		.map((appointment): UpcomingInvitation => {
			const counterpart =
				appointment.counterpart?.displayName ||
				appointment.counterpart?.username;
			return {
				id: `${APPOINTMENT_ROW_PREFIX}${appointment.id}`,
				name: appointmentName,
				medium: 'CHAT',
				start: new Date(appointment.startTime),
				end: new Date(appointment.endTime),
				...(counterpart ? { counterpart } : {})
			};
		});
	return {
		appointments: [
			...withDate
				.map(invitationRow)
				.filter((row): row is UpcomingInvitation => row !== null),
			...oneToOne
		],
		links: links.filter((link) => !link.appointment)
	};
};
