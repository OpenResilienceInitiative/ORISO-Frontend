import { describe, expect, it } from 'vite-plus/test';
import { DepartmentLegalData } from '../../../api/apiGetDepartmentLegal';
import { isPrivacyNoticeMissing } from './hasStoredPrivacyNotice';

const legal = (dppContent: string | null): DepartmentLegalData => ({
	dpp: { content: dppContent, consentText: null },
	imprint: { content: null, consentText: null }
});

describe('isPrivacyNoticeMissing', () => {
	it('is true when the centre answered and no privacy text exists at any level', () => {
		expect(isPrivacyNoticeMissing(legal(null))).toBe(true);
	});

	it('is true for text that carries no visible wording', () => {
		expect(isPrivacyNoticeMissing(legal('   '))).toBe(true);
		expect(isPrivacyNoticeMissing(legal('{"de":""}'))).toBe(true);
		expect(isPrivacyNoticeMissing(legal('{"de__meta":"{}"}'))).toBe(true);
	});

	it('is false when any text is stored, whatever its level or correctness', () => {
		expect(isPrivacyNoticeMissing(legal('{"de":"<p>Text</p>"}'))).toBe(
			false
		);
		expect(isPrivacyNoticeMissing(legal('<p>Plain HTML</p>'))).toBe(false);
	});

	it('is false when the answer is unknown, so a 404 or a failed lookup never warns', () => {
		expect(isPrivacyNoticeMissing(null)).toBe(false);
		expect(isPrivacyNoticeMissing(undefined)).toBe(false);
	});
});
