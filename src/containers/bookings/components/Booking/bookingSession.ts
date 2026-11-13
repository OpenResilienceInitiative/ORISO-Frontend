import {
	ListItemInterface,
	STATUS_EMPTY,
	UserDataInterface
} from '../../../../globalState/interfaces';

/** Query parameter that names the conversation a booking belongs to (#2010). */
export const BOOKING_SESSION_PARAM = 'sessionId';

/** Route to the booking page for one conversation. */
export const bookingPathFor = (sessionId?: number | string | null) =>
	sessionId != null && sessionId !== ''
		? `/booking/?${BOOKING_SESSION_PARAM}=${encodeURIComponent(String(sessionId))}`
		: '/booking/';

/**
 * The conversation a booking is made for. When the page names one, only that
 * conversation qualifies; a foreign id books nothing. Without one, a single
 * conversation with an agency is unambiguous; with several we do not guess,
 * because guessing booked against the first conversation's counsellor (#2010).
 */
export const pickBookingSession = (
	sessions: ListItemInterface[],
	sessionId: string | null | undefined
): ListItemInterface | undefined => {
	if (sessionId) {
		return sessions.find(
			(s) => String(s.session?.id) === String(sessionId)
		);
	}
	const withAgency = sessions.filter((s) => !!s.agency);
	return withAgency.length === 1 ? withAgency[0] : undefined;
};

/**
 * Metadata cal.com stores with the booking. It never carries a credential:
 * the login token used to be sent here and reached a third party (#2010).
 */
export const bookingMetadata = (
	userData: Pick<UserDataInterface, 'userId'>,
	session: ListItemInterface
) => ({
	'metadata[user]': userData.userId,
	'metadata[isInitialAppointment]':
		!session.consultant || session.session.status === STATUS_EMPTY,
	'metadata[sessionId]': session.session.id
});
