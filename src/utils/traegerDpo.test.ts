import { describe, expect, it } from 'vitest';
import { traegerDpoLine, withTraegerDpo } from './traegerDpo';

const dpo = {
	nameAndLegalForm: 'Dr. Maria Muster',
	street: 'Musterstraße 1',
	postcode: '79104',
	city: 'Freiburg',
	email: 'datenschutz@beispiel.de'
};

describe('withTraegerDpo', () => {
	it('fills the token in a flat HTML string', () => {
		expect(
			withTraegerDpo('<p>DSB: {{Datenschutzbeauftragte}}</p>', dpo)
		).toBe(
			'<p>DSB: Dr. Maria Muster, Musterstraße 1, 79104 Freiburg, datenschutz@beispiel.de</p>'
		);
	});

	it('fills every language of a map and leaves __meta alone', () => {
		const map = {
			de: '<p>{{Datenschutzbeauftragte}}</p>',
			de__meta: '{"note":"{{Datenschutzbeauftragte}}"}'
		};
		const filled = withTraegerDpo(map, dpo) as Record<string, string>;
		expect(filled.de).toContain('Dr. Maria Muster');
		expect(filled.de__meta).toBe(map.de__meta);
	});

	it('fills inside a serialised map without breaking the JSON', () => {
		const json = JSON.stringify({
			de: '<p>{{Datenschutzbeauftragte}}</p>'
		});
		const filled = withTraegerDpo(json, {
			nameAndLegalForm: 'Caritas "Mitte"'
		});
		expect(JSON.parse(filled as string).de).toBe(
			'<p>Caritas &quot;Mitte&quot;</p>'
		);
	});

	it('renders empty when the Träger has no DPO (not a required field)', () => {
		expect(
			withTraegerDpo('<p>DSB: {{Datenschutzbeauftragte}}</p>', null)
		).toBe('<p>DSB: </p>');
	});

	it('escapes markup in the DPO', () => {
		expect(traegerDpoLine({ nameAndLegalForm: '<b>x</b>' })).toBe(
			'<b>x</b>'
		);
		expect(
			withTraegerDpo('{{Datenschutzbeauftragte}}', {
				nameAndLegalForm: '<b>x</b>'
			})
		).toBe('&lt;b&gt;x&lt;/b&gt;');
	});
});
