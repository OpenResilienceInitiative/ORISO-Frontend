import { ExtendedSessionInterface } from '../../globalState/helpers/stateHelpers';
import { SESSION_LIST_TYPES } from './sessionHelpers';

/**
 * #1472: in the enquiry area a counsellor only sees their own open enquiries.
 * A case that is no longer an enquiry and belongs to someone else was taken
 * by a colleague; the room lookup then falls back to the read-only
 * case-handover view, which must not look like an enquiry still on offer.
 */
export const isEnquiryTakenByColleague = (
	listType: SESSION_LIST_TYPES,
	session: ExtendedSessionInterface | null | undefined,
	ownUserId: string | undefined
): boolean => {
	if (listType !== SESSION_LIST_TYPES.ENQUIRY || !session?.isSession) {
		return false;
	}
	if (session.isEnquiry || session.isRejected) {
		return false;
	}
	const ownerId = session.consultant?.id ?? session.consultant?.consultantId;
	return Boolean(ownerId && ownUserId && ownerId !== ownUserId);
};
