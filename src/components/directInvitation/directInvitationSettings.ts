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
	link,
	changed
}: InvitationDialogValue): DirectInvitationSettings => ({
	...(appointment && (!changed || changed.appointment)
		? {
				appointment: {
					startTime: appointment.start.toISOString(),
					endTime: appointment.end.toISOString()
				}
			}
		: {}),
	...(appointment &&
	typeof link?.validityMinutes === 'number' &&
	(!changed || changed.validityMinutes)
		? { validityAfterEndMinutes: link.validityMinutes }
		: {}),
	...(link && (!changed || changed.access)
		? { accessMode: toAccessMode(link.access) }
		: {}),
	...(link && (!changed || changed.knock) ? { knock: link.knock } : {})
});
