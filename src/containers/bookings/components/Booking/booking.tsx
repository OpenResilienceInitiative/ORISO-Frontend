import * as React from 'react';
import { useContext, useEffect, useState } from 'react';
import { UserDataContext } from '../../../../globalState';
import {
	ListItemInterface,
	UserDataInterface
} from '../../../../globalState/interfaces';
import {
	apiGetAskerSessionList,
	getCounselorAppointmentLink,
	getTeamAppointmentLink
} from '../../../../api';
import Cal from '../Calcom/Cal';
import { useAppConfig } from '../../../../hooks/useAppConfig';
import { useSearchParam } from '../../../../hooks/useSearchParams';
import {
	BOOKING_SESSION_PARAM,
	bookingMetadata,
	pickBookingSession
} from './bookingSession';

export const getUserEmail = (userData: UserDataInterface) => {
	return userData.email
		? userData.email
		: userData.userName?.replace(/ /g, '') + '@suchtberatung.digital';
};

export const Booking = () => {
	const { userData } = useContext(UserDataContext);
	const [session, setSession] = useState<ListItemInterface>();
	const [appointmentLink, setAppointmentLink] = useState<string | null>(null);
	const settings = useAppConfig();
	const sessionId = useSearchParam<string | null>(BOOKING_SESSION_PARAM);

	useEffect(() => {
		// A newer conversation (sessionId) or user supersedes this run: its
		// late responses must not overwrite the current booking (#2010).
		let cancelled = false;
		setSession(undefined);
		setAppointmentLink(null);
		apiGetAskerSessionList().then(({ sessions }) => {
			if (cancelled) return;
			const session = pickBookingSession(sessions, sessionId);
			setSession(session);
			if (!session) return;
			const consultant = session?.consultant;
			const agencyId = session?.agency?.id;
			if (consultant) {
				const consultantId = consultant?.consultantId || consultant?.id;
				getCounselorAppointmentLink(consultantId).then((response) => {
					if (!cancelled) setAppointmentLink(response.slug);
				});
			} else {
				getTeamAppointmentLink(agencyId).then((response) => {
					if (!cancelled) setAppointmentLink(`team/${response.slug}`);
				});
			}
		});
		return () => {
			cancelled = true;
		};
	}, [userData, sessionId]);

	if (!session) return null;

	return (
		<React.Fragment>
			{appointmentLink && settings.calcomUrl && (
				<Cal
					calLink={appointmentLink}
					calOrigin={settings.calcomUrl}
					config={{
						name: userData.userName,
						email: getUserEmail(userData),
						theme: 'light',
						...bookingMetadata(userData, session)
					}}
					embedJsUrl={`${settings.calcomUrl}/embed/embed.js`}
				/>
			)}
		</React.Fragment>
	);
};
