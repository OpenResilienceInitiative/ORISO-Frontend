import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { getAgencyDetails } from './agencyDetails';
import {
	AgencyDataInterface,
	AgencyDepartmentDataInterface
} from '../../../globalState/interfaces';

/**
 * The registration agency details panel used to ship a hardcoded DEMO_DETAILS
 * table matched by regex on the agency name (/kreuzberg/i, /u25/i, ...) plus a
 * COLOGNE_CENTER lat/lng fallback keyed on postcode 50667. Because the real
 * fields did not exist on the public AgencyResponseDTO, the fallback always
 * won and advice seekers saw invented addresses, phone numbers and opening
 * hours. These tests pin the replacement contract (AgencyService #242):
 * consume real DTO fields, and when a field is missing render nothing —
 * never invent a value.
 */

const baseAgency = (
	overrides: Partial<AgencyDataInterface> = {}
): AgencyDataInterface => ({
	id: 1,
	name: 'Beratungsstelle Musterstadt',
	city: '',
	postcode: '',
	description: '',
	consultingType: 0,
	offline: false,
	...overrides
});

describe('getAgencyDetails — real DTO fields', () => {
	it('builds the address from street, house number, postcode and city', () => {
		const details = getAgencyDetails(
			baseAgency({
				street: 'Musterstraße',
				houseNumber: '12',
				postcode: '50667',
				city: 'Köln'
			})
		);
		expect(details.address).toBe('Musterstraße 12, 50667 Köln');
	});

	it('falls back to postcode/city when street is absent (real fields only)', () => {
		const details = getAgencyDetails(
			baseAgency({ postcode: '50667', city: 'Köln' })
		);
		expect(details.address).toBe('50667 Köln');
	});

	it('returns no address when no address field is provided', () => {
		const details = getAgencyDetails(baseAgency());
		expect(details.address).toBeUndefined();
	});

	it('consumes phone and openingHours from the DTO', () => {
		const details = getAgencyDetails(
			baseAgency({
				phone: '0221 12345',
				openingHours: 'Mo-Fr 9-16 Uhr'
			})
		);
		expect(details.phone).toBe('0221 12345');
		expect(details.hours).toBe('Mo-Fr 9-16 Uhr');
	});

	it('treats whitespace-only values as missing', () => {
		const details = getAgencyDetails(
			baseAgency({
				street: '   ',
				phone: ' ',
				openingHours: '\t'
			})
		);
		expect(details.address).toBeUndefined();
		expect(details.phone).toBeUndefined();
		expect(details.hours).toBeUndefined();
	});
});

describe('getAgencyDetails — missing fields stay absent (never invented)', () => {
	const formerDemoNames = [
		'Caritasverband Wismar e.V.',
		'Caritas am Meer',
		'Beratungsstelle Kreuzberg',
		'U25 Köln',
		'codex predev agency'
	];

	for (const name of formerDemoNames) {
		it(`"${name}" no longer triggers placeholder contact data`, () => {
			const details = getAgencyDetails(
				baseAgency({ name, postcode: '10997', city: 'Berlin' })
			);
			expect(details.phone).toBeUndefined();
			expect(details.hours).toBeUndefined();
			expect(details.lat).toBeUndefined();
			expect(details.lng).toBeUndefined();
			// postcode/city are real backend values and may render;
			// nothing beyond them may appear.
			expect(details.address).toBe('10997 Berlin');
		});
	}

	it('postcode 50667 no longer resolves to the Cologne-centre map pin', () => {
		const details = getAgencyDetails(
			baseAgency({ postcode: '50667', city: 'Köln' })
		);
		expect(details.lat).toBeUndefined();
		expect(details.lng).toBeUndefined();
	});

	it('exposes coordinates only when the record really carries them', () => {
		const details = getAgencyDetails(
			baseAgency({ lat: 50.9384, lng: 6.9599 } as any)
		);
		expect(details.lat).toBe(50.9384);
		expect(details.lng).toBe(6.9599);
	});
});

describe('getAgencyDetails — per-department overrides (AgencyService #242)', () => {
	const department: AgencyDepartmentDataInterface = {
		topicId: 7,
		openingHours: 'Di+Do 10-14 Uhr',
		phoneExtension: '12',
		floorLocation: '3. OG, Raum 12'
	};

	it("prefers the department's opening hours over the agency's", () => {
		const details = getAgencyDetails(
			baseAgency({ openingHours: 'Mo-Fr 9-16 Uhr' }),
			department
		);
		expect(details.hours).toBe('Di+Do 10-14 Uhr');
	});

	it('appends the department phone extension to the agency phone', () => {
		const details = getAgencyDetails(
			baseAgency({ phone: '0221 12345' }),
			department
		);
		expect(details.phone).toBe('0221 12345-12');
	});

	it('ignores a phone extension without a base phone number', () => {
		const details = getAgencyDetails(baseAgency(), department);
		expect(details.phone).toBeUndefined();
	});

	it('exposes the department floor location', () => {
		const details = getAgencyDetails(baseAgency(), department);
		expect(details.floorLocation).toBe('3. OG, Raum 12');
	});

	it('keeps agency values when the department has no overrides', () => {
		const details = getAgencyDetails(
			baseAgency({ phone: '0221 12345', openingHours: 'Mo-Fr 9-16 Uhr' }),
			{ topicId: 7 }
		);
		expect(details.phone).toBe('0221 12345');
		expect(details.hours).toBe('Mo-Fr 9-16 Uhr');
	});
});

describe('demo-data source removal', () => {
	it('no demo table, name regex or postcode fallback remains in the sources', () => {
		for (const file of ['agencyDetails.ts', 'AgencyDetailsPanel.tsx']) {
			const source = fs.readFileSync(path.join(__dirname, file), 'utf8');
			expect(source).not.toMatch(/DEMO_DETAILS/);
			expect(source).not.toMatch(/COLOGNE_CENTER/);
			expect(source).not.toMatch(/kreuzberg/i);
			expect(source).not.toMatch(/u25/i);
			expect(source).not.toMatch(/50667/);
		}
	});
});
