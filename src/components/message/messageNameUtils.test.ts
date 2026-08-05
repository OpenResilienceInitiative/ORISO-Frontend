import { describe, expect, it } from 'vitest';
import {
	formatAgencyLine,
	formatAgencyLineWithI18n,
	formatMessagePersonName,
	getMessagePersonInitials
} from './messageNameUtils';

describe('formatMessagePersonName', () => {
	it('prefers the real name when present', () => {
		expect(
			formatMessagePersonName('ignored', 'ignored', 'Karina', 'P')
		).toBe('Karina P');
	});

	it('keeps anonymous display names untouched', () => {
		expect(formatMessagePersonName('sanftes Alpaka Kim', undefined)).toBe(
			'sanftes Alpaka Kim'
		);
	});

	it('humanizes technical usernames with underscores', () => {
		expect(formatMessagePersonName(undefined, 'free_bee_frankie_821')).toBe(
			'free bee frankie'
		);
	});

	it('humanizes technical display names too', () => {
		expect(formatMessagePersonName('free_bee_frankie_821', undefined)).toBe(
			'free bee frankie'
		);
	});

	it('strips the numeric suffix even when a single word remains', () => {
		expect(formatMessagePersonName(undefined, 'user_821')).toBe('user');
	});

	it('leaves user-configured display names with punctuation untouched', () => {
		expect(formatMessagePersonName('Dr. Kim', undefined)).toBe('Dr. Kim');
		expect(formatMessagePersonName('A. Einstein', undefined)).toBe(
			'A. Einstein'
		);
	});

	it('strips matrix domain and @ prefix', () => {
		expect(
			formatMessagePersonName(undefined, '@free_bee_frankie_821:oriso.de')
		).toBe('free bee frankie');
	});

	it('keeps only the local part of email-style identifiers', () => {
		expect(
			formatMessagePersonName(undefined, 'testuser@example.invalid')
		).toBe('testuser');
	});
});

describe('getMessagePersonInitials', () => {
	it('uses first letters of the humanized name', () => {
		expect(
			getMessagePersonInitials(undefined, 'free_bee_frankie_821')
		).toBe('FB');
	});
});

describe('formatAgencyLine', () => {
	it('puts the postcode in front of the counselling centre', () => {
		expect(
			formatAgencyLine({ postcode: '54222', name: 'Caritas Mainz' })
		).toBe('54222 Caritas Mainz');
	});

	it('accepts a numeric postcode from the session payload', () => {
		expect(
			formatAgencyLine({ postcode: 55116, name: 'Caritas Mainz' })
		).toBe('55116 Caritas Mainz');
	});

	/**
	 * Live Chat registers anonymous askers with the placeholder postcode
	 * "00000". Printing it would tell the reader the counselling centre sits in
	 * a place that does not exist, so the name goes out on its own instead.
	 */
	it('drops the anonymous placeholder postcode', () => {
		expect(
			formatAgencyLine({ postcode: '00000', name: 'Caritas Mainz' })
		).toBe('Caritas Mainz');
	});

	it('falls back to the name alone when there is no postcode', () => {
		expect(formatAgencyLine({ name: 'Caritas Mainz' })).toBe(
			'Caritas Mainz'
		);
		expect(
			formatAgencyLine({ postcode: '   ', name: 'Caritas Mainz' })
		).toBe('Caritas Mainz');
	});

	/** No name means no line at all — never a bare postcode with no place. */
	it('returns an empty string without a name', () => {
		expect(formatAgencyLine({ postcode: '54222' })).toBe('');
		expect(formatAgencyLine({})).toBe('');
		expect(formatAgencyLine(null)).toBe('');
		expect(formatAgencyLine(undefined)).toBe('');
	});

	it('trims stray whitespace on both parts', () => {
		expect(
			formatAgencyLine({ postcode: ' 54222 ', name: '  Caritas Mainz ' })
		).toBe('54222 Caritas Mainz');
	});
});

describe('formatAgencyLineWithI18n', () => {
	it('uses the agencies-namespace override for the message subtitle name', () => {
		const translate = (
			keys: [string, string],
			_options: { ns: 'agencies' }
		) => {
			if (keys[0] === 'agency.42.name') {
				return 'Tenant Overlay Caritas';
			}
			return keys[1];
		};
		expect(
			formatAgencyLineWithI18n(
				{ id: 42, postcode: '54222', name: 'Caritas Mainz' },
				translate
			)
		).toBe('54222 Tenant Overlay Caritas');
	});
});
