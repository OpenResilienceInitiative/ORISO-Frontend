import { describe, expect, it } from 'vitest';
import {
	shouldBlockMissingLegacyE2eeKey,
	shouldUseLegacyE2ee
} from './messageEncryptionMode';

describe('messageEncryptionMode', () => {
	it('uses legacy E2EE for non-Matrix conversations when E2EE is enabled', () => {
		expect(
			shouldUseLegacyE2ee({
				isE2eeEnabled: true,
				isMatrixSession: false,
				isAskerEnquiry: false
			})
		).toBe(true);
	});

	it('does not use legacy E2EE for Matrix-backed sessions', () => {
		expect(
			shouldUseLegacyE2ee({
				isE2eeEnabled: true,
				isMatrixSession: true,
				isAskerEnquiry: false
			})
		).toBe(false);
	});

	it('does not use legacy E2EE for asker enquiries', () => {
		expect(
			shouldUseLegacyE2ee({
				isE2eeEnabled: true,
				isMatrixSession: false,
				isAskerEnquiry: true
			})
		).toBe(false);
	});

	it('only blocks missing keys for the legacy E2EE path', () => {
		expect(
			shouldBlockMissingLegacyE2eeKey({
				usesLegacyE2ee: true,
				encrypted: true,
				hasKeyId: false
			})
		).toBe(true);

		expect(
			shouldBlockMissingLegacyE2eeKey({
				usesLegacyE2ee: false,
				encrypted: true,
				hasKeyId: false
			})
		).toBe(false);
	});
});
