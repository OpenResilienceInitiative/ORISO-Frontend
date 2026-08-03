import { STATUS_ENQUIRY } from '../../globalState/interfaces/SessionsDataInterface';

interface AskerEnquirySubmissionInput {
	isEnquiryListType: boolean;
	sessionStatus?: number;
	hasAskerAuthority: boolean;
	isAnonymousLiveChat: boolean;
	hasEnquiryMessage?: boolean;
}

export type AskerMessageTransport = 'enquiry' | 'matrix' | 'blocked' | 'other';

interface AskerMessageTransportInput extends AskerEnquirySubmissionInput {
	isMatrixSession: boolean;
	matrixRoomId?: string | null;
}

interface AskerMessageTransportDispatch {
	transport: AskerMessageTransport;
	sendEnquiry: () => Promise<unknown>;
	sendMatrix: () => Promise<unknown>;
	onBlocked: () => void;
}

export interface EnquirySubmissionGuard {
	markFailed: () => void;
	markSucceeded: () => void;
	tryStart: () => boolean;
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

export const resolveAskerMessageTransport = (
	input: AskerMessageTransportInput
): AskerMessageTransport => {
	if (isAskerEnquirySubmission(input)) {
		return 'enquiry';
	}
	if (
		!input.hasAskerAuthority ||
		input.isAnonymousLiveChat ||
		!input.hasEnquiryMessage
	) {
		return 'other';
	}

	return input.isMatrixSession && Boolean(input.matrixRoomId)
		? 'matrix'
		: 'blocked';
};

export const dispatchAskerMessageTransport = async ({
	transport,
	sendEnquiry,
	sendMatrix,
	onBlocked
}: AskerMessageTransportDispatch): Promise<boolean> => {
	if (transport === 'enquiry') {
		await sendEnquiry();
		return true;
	}
	if (transport === 'matrix') {
		await sendMatrix();
		return true;
	}
	if (transport === 'blocked') {
		onBlocked();
		return true;
	}
	return false;
};

export const createEnquirySubmissionGuard = (): EnquirySubmissionGuard => {
	let state: 'idle' | 'inFlight' | 'submitted' = 'idle';
	return {
		tryStart: () => {
			if (state !== 'idle') {
				return false;
			}
			state = 'inFlight';
			return true;
		},
		markSucceeded: () => {
			state = 'submitted';
		},
		markFailed: () => {
			if (state === 'inFlight') {
				state = 'idle';
			}
		}
	};
};
