/**
 * Only counsellors start calls (Frank, 17 Nov 2026). An advice seeker's call
 * button opens information instead: the conversation's next appointment, or
 * the way to ask for one. This file holds the rules, without React.
 */
import type {
	SessionAppointment,
	SessionAppointmentKind
} from '../../../api/apiSessionAppointments';
import {
	pendingRequests,
	upcomingAppointments
} from '../../sessionsList/timeline/conversationAppointments';

export type AskerCallMedium = 'video' | 'phone' | 'onsite' | 'chat';

export type AskerCallInfoState =
	| { status: 'loading' }
	| { status: 'error' }
	| { status: 'none' }
	| {
			status: 'appointment';
			start: Date;
			end: Date;
			medium: AskerCallMedium;
			/** FE#2287: asked for, waiting for the counsellor to confirm. */
			requested?: true;
	  };

const MEDIUM: Record<SessionAppointmentKind, AskerCallMedium> = {
	VIDEO: 'video',
	PHONE: 'phone',
	ONSITE: 'onsite',
	CHAT: 'chat'
};

/**
 * `undefined` while the appointments are being read, `'error'` when the read
 * failed. An appointment without a kind was made before the calendar and was
 * a video call (same rule as `appointmentToBooking`).
 */
export const askerCallInfoState = (
	appointments: SessionAppointment[] | 'error' | undefined,
	now: Date
): AskerCallInfoState => {
	if (appointments === undefined) return { status: 'loading' };
	if (appointments === 'error') return { status: 'error' };
	/* A conversation has one at a time: a scheduled appointment, or else a
	   request waiting for the counsellor (FE#2287). */
	const scheduled = upcomingAppointments(appointments, now)[0];
	const next = scheduled ?? pendingRequests(appointments, now)[0];
	if (!next) return { status: 'none' };
	return {
		status: 'appointment',
		start: new Date(next.startTime),
		end: new Date(next.endTime),
		medium: (next.kind && MEDIUM[next.kind]) || 'video',
		...(scheduled ? {} : { requested: true as const })
	};
};

export interface AskerCallInfoAudience {
	isAsker: boolean;
	isConsultant: boolean;
	isSession: boolean;
	isGroup: boolean;
	isEnquiryList: boolean;
	isRejectedCase: boolean;
	isSupervisor: boolean;
	/** The consulting type allows calls at all. */
	videoCallAllowed: boolean;
}

/**
 * Who gets the information buttons: an advice seeker (never a counsellor, who
 * keeps the real call buttons) in an accepted 1:1 conversation whose
 * consulting type has calls. Group chats keep their own header.
 */
export const canAskerSeeCallInfo = ({
	isAsker,
	isConsultant,
	isSession,
	isGroup,
	isEnquiryList,
	isRejectedCase,
	isSupervisor,
	videoCallAllowed
}: AskerCallInfoAudience): boolean =>
	isAsker &&
	!isConsultant &&
	isSession &&
	!isGroup &&
	!isEnquiryList &&
	!isRejectedCase &&
	!isSupervisor &&
	videoCallAllowed;
