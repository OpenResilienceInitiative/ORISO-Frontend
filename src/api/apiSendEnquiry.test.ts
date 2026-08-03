import { describe, expect, it } from 'vitest';
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
