import { describe, expect, it } from 'vite-plus/test';
import {
	asksDirectLinkPostcode,
	DIRECT_LINK_FALLBACK_POSTCODE,
	isDirectLinkPostcode
} from './directLinkPostcode';

describe('the postcode of a direct-link registration (ORISO-Frontend#1795)', () => {
	it('is asked for a registered account, not for a temporary one', () => {
		expect(
			asksDirectLinkPostcode({ temporaryAccount: false } as never)
		).toBe(true);
		expect(asksDirectLinkPostcode({} as never)).toBe(true);
		expect(
			asksDirectLinkPostcode({ temporaryAccount: true } as never)
		).toBe(false);
	});

	it.each(['10115', '00000', '99999'])('accepts %s', (value) => {
		expect(isDirectLinkPostcode(value)).toBe(true);
	});

	it.each(['', '1011', '101155', '10 15', 'abcde', '1011a'])(
		'rejects "%s"',
		(value) => {
			expect(isDirectLinkPostcode(value)).toBe(false);
		}
	);

	it('keeps the placeholder the backend knows for temporary accounts', () => {
		expect(DIRECT_LINK_FALLBACK_POSTCODE).toBe('00000');
	});
});
