import { STATUS_ENQUIRY } from '../../globalState/interfaces/SessionsDataInterface';

interface MessageEncryptionModeInput {
	isE2eeEnabled: boolean;
	isMatrixSession: boolean;
	isAskerEnquiry: boolean;
}

interface AskerEnquirySubmissionInput {
	isEnquiryListType: boolean;
	sessionStatus?: number;
	hasAskerAuthority: boolean;
	isAnonymousLiveChat: boolean;
}

interface MissingLegacyKeyGuardInput {
	usesLegacyE2ee: boolean;
	encrypted: boolean;
	hasKeyId: boolean;
}

export const shouldUseLegacyE2ee = ({
	isE2eeEnabled,
	isMatrixSession,
	isAskerEnquiry
}: MessageEncryptionModeInput): boolean =>
	isE2eeEnabled && !isMatrixSession && !isAskerEnquiry;

export const isAskerEnquirySubmission = ({
	isEnquiryListType,
	sessionStatus,
	hasAskerAuthority,
	isAnonymousLiveChat
}: AskerEnquirySubmissionInput): boolean =>
	(isEnquiryListType || sessionStatus === STATUS_ENQUIRY) &&
	hasAskerAuthority &&
	!isAnonymousLiveChat;

export const shouldBlockMissingLegacyE2eeKey = ({
	usesLegacyE2ee,
	encrypted,
	hasKeyId
}: MissingLegacyKeyGuardInput): boolean =>
	usesLegacyE2ee && encrypted && !hasKeyId;
