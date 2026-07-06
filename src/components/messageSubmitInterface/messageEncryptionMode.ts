import { STATUS_ENQUIRY } from '../../globalState/interfaces/SessionsDataInterface';

interface AskerEnquirySubmissionInput {
	isEnquiryListType: boolean;
	sessionStatus?: number;
	hasAskerAuthority: boolean;
	isAnonymousLiveChat: boolean;
}

export const isAskerEnquirySubmission = ({
	isEnquiryListType,
	sessionStatus,
	hasAskerAuthority,
	isAnonymousLiveChat
}: AskerEnquirySubmissionInput): boolean =>
	(isEnquiryListType || sessionStatus === STATUS_ENQUIRY) &&
	hasAskerAuthority &&
	!isAnonymousLiveChat;
