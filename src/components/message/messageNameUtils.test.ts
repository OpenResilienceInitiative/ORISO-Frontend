import { describe, expect, it } from 'vitest';
import {
	formatAgencyLine,
	formatAgencyLineWithI18n,
	formatMessagePersonName,
	resolveIncomingConsultantNameForAsker,
	resolveOwnConsultantName
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

describe('resolveIncomingConsultantNameForAsker', () => {
	it('prefers the session displayName over Matrix and legal-looking names', () => {
		expect(
			resolveIncomingConsultantNameForAsker({
				sessionConsultantDisplayName: 'sanftes Alpaka Kim',
				matrixDisplayName: 'Karina P',
				eventDisplayName: 'K. Müller',
				username: 'karina.p'
			})
		).toEqual({ displayName: 'sanftes Alpaka Kim' });
	});

	it('does not return firstName or lastName when displayName is set', () => {
		const resolved = resolveIncomingConsultantNameForAsker({
			sessionConsultantDisplayName: 'Beratende Person Kim',
			matrixDisplayName: 'Karina P'
		});
		expect(resolved.firstName).toBeUndefined();
		expect(resolved.lastName).toBeUndefined();
		expect(
			formatMessagePersonName(
				resolved.displayName,
				'karina.p',
				resolved.firstName,
				resolved.lastName
			)
		).toBe('Beratende Person Kim');
	});

	it('falls back to Matrix name, then event name, then username', () => {
		expect(
			resolveIncomingConsultantNameForAsker({
				matrixDisplayName: 'Karina P',
				eventDisplayName: 'K. Müller',
				username: 'karina.p'
			})
		).toEqual({ displayName: 'Karina P' });
		expect(
			resolveIncomingConsultantNameForAsker({
				eventDisplayName: 'K. Müller',
				username: 'karina.p'
			})
		).toEqual({ displayName: 'K. Müller' });
		expect(
			resolveIncomingConsultantNameForAsker({
				username: 'karina.p'
			})
		).toEqual({ displayName: 'karina.p' });
	});
});

describe('resolveOwnConsultantName', () => {
	it('prefers displayName over firstName and lastName', () => {
		expect(
			resolveOwnConsultantName({
				displayName: 'Beratende Person Kim',
				firstName: 'Karina',
				lastName: 'P',
				username: 'karina.p'
			})
		).toEqual({ displayName: 'Beratende Person Kim' });
	});

	it('does not pass firstName or lastName when displayName is set', () => {
		const resolved = resolveOwnConsultantName({
			displayName: 'Beratende Person Kim',
			firstName: 'Karina',
			lastName: 'P',
			username: 'karina.p'
		});
		expect(resolved.firstName).toBeUndefined();
		expect(resolved.lastName).toBeUndefined();
		expect(
			formatMessagePersonName(
				resolved.displayName,
				'karina.p',
				resolved.firstName,
				resolved.lastName
			)
		).toBe('Beratende Person Kim');
	});

	it('falls back to firstName and lastName, then username', () => {
		expect(
			resolveOwnConsultantName({
				firstName: 'Karina',
				lastName: 'P',
				username: 'karina.p'
			})
		).toEqual({ firstName: 'Karina', lastName: 'P' });
		expect(
			resolveOwnConsultantName({
				username: 'karina.p'
			})
		).toEqual({ displayName: 'karina.p' });
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

	it('shows tenant i18n overlay when the API name is empty', () => {
		const translate = (
			keys: [string, string],
			_options: { ns: 'agencies' }
		) => {
			if (keys[0] === 'agency.42.name') {
				return 'Tenant Overlay';
			}
			return keys[1];
		};
		expect(
			formatAgencyLineWithI18n(
				{ id: 42, postcode: '54222', name: '' },
				translate
			)
		).toBe('54222 Tenant Overlay');
	});
});
