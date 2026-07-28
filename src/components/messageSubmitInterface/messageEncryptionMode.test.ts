import { describe, expect, it } from 'vitest';
import { isAskerEnquirySubmission } from './messageEncryptionMode';
import { STATUS_ENQUIRY } from '../../globalState/interfaces/SessionsDataInterface';

describe('messageEncryptionMode', () => {
	it('detects asker enquiry submissions from the enquiry list type', () => {
		expect(
			isAskerEnquirySubmission({
				isEnquiryListType: true,
				sessionStatus: undefined,
				hasAskerAuthority: true,
				isAnonymousLiveChat: false
			})
		).toBe(true);
	});

	it('detects redirected asker enquiry submissions from the session status', () => {
		expect(
			isAskerEnquirySubmission({
				isEnquiryListType: false,
				sessionStatus: STATUS_ENQUIRY,
				hasAskerAuthority: true,
				isAnonymousLiveChat: false
			})
		).toBe(true);
	});

	it('does not treat anonymous live chat as an asker enquiry submission', () => {
		expect(
			isAskerEnquirySubmission({
				isEnquiryListType: true,
				sessionStatus: STATUS_ENQUIRY,
				hasAskerAuthority: true,
				isAnonymousLiveChat: true
			})
		).toBe(false);
	});

	it('does not use the enquiry endpoint once the session has a Matrix room', () => {
		expect(
			isAskerEnquirySubmission({
				isEnquiryListType: false,
				sessionStatus: STATUS_ENQUIRY,
				hasAskerAuthority: true,
				isAnonymousLiveChat: false,
				hasMatrixRoom: true
			})
		).toBe(false);
	});

	it('requires asker authority for enquiry submissions', () => {
		expect(
			isAskerEnquirySubmission({
				isEnquiryListType: true,
				sessionStatus: STATUS_ENQUIRY,
				hasAskerAuthority: false,
				isAnonymousLiveChat: false
			})
		).toBe(false);
	});
});
