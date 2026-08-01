import { STATUS_ENQUIRY } from '../../globalState/interfaces/SessionsDataInterface';

interface AskerEnquirySubmissionInput {
	isEnquiryListType: boolean;
	sessionStatus?: number;
	hasAskerAuthority: boolean;
	isAnonymousLiveChat: boolean;
	hasEnquiryMessage?: boolean;
}

export const isAskerEnquirySubmission = ({
	isEnquiryListType,
	sessionStatus,
	hasAskerAuthority,
	isAnonymousLiveChat,
	hasEnquiryMessage
}: AskerEnquirySubmissionInput): boolean =>
	(isEnquiryListType || sessionStatus === STATUS_ENQUIRY) &&
	hasAskerAuthority &&
	!isAnonymousLiveChat &&
	!hasEnquiryMessage;
