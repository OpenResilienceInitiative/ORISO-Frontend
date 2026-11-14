/**
 * #2252: the shared dialog's value as the API's appointment and link
 * settings (create, patch and the 1:1 invitation take the same fields).
 */
import {
	type DirectInvitationSettings,
	toAccessMode
} from '../../api/apiDirectLinks';
import type { InvitationDialogValue } from './invitationModel';

export const directInvitationSettings = ({
	appointment,
	link
}: InvitationDialogValue): DirectInvitationSettings => ({
	...(appointment
		? {
				appointment: {
					startTime: appointment.start.toISOString(),
					endTime: appointment.end.toISOString()
				}
			}
		: {}),
	...(appointment && typeof link?.validityMinutes === 'number'
		? { validityAfterEndMinutes: link.validityMinutes }
		: {}),
	...(link
		? { accessMode: toAccessMode(link.access), knock: link.knock }
		: {})
});
