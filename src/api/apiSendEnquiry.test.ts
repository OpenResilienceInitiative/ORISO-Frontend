import { describe, expect, it } from 'vite-plus/test';
import { buildEncryptedEnquiryFinalizationPayload } from './encryptedEnquiryPayload';

describe('buildEncryptedEnquiryFinalizationPayload', () => {
	it('contains only the encrypted Matrix event reference and no enquiry plaintext', () => {
		expect(
			buildEncryptedEnquiryFinalizationPayload('$encrypted', 'de')
		).toEqual({
			message: '',
			t: 'e2e',
			matrixEventId: '$encrypted',
			language: 'de'
		});
	});
});
