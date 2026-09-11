import {
	AgencyDataInterface,
	AgencyDepartmentDataInterface
} from '../../../globalState/interfaces';

export interface AgencyDetails {
	address?: string;
	floorLocation?: string;
	lat?: number;
	lng?: number;
	phone?: string;
	hours?: string;
	about?: string;
	url?: string;
}

const trimmed = (value: unknown): string | undefined =>
	typeof value === 'string' && value.trim() ? value.trim() : undefined;

const finiteNumber = (value: unknown): number | undefined =>
	typeof value === 'number' && Number.isFinite(value) ? value : undefined;

/**
 * Derives the registration details panel content from the public agency DTO
 * (AgencyService #242: `street`, `houseNumber`, `phone`, `openingHours`) and
 * the department matching the selected topic (per-department `openingHours`,
 * `phoneExtension`, `floorLocation` overrides).
 *
 * Every field is optional: a missing backend value yields `undefined` and the
 * panel hides the row. This replaced a hardcoded demo table matched by regex
 * on the agency name — no placeholder value may ever be substituted here.
 */
export function getAgencyDetails(
	agency: AgencyDataInterface,
	department?: AgencyDepartmentDataInterface
): AgencyDetails {
	const streetLine = [trimmed(agency.street), trimmed(agency.houseNumber)]
		.filter(Boolean)
		.join(' ');
	const cityLine = [trimmed(agency.postcode), trimmed(agency.city)]
		.filter(Boolean)
		.join(' ');
	const address =
		[streetLine, cityLine].filter(Boolean).join(', ') || undefined;

	const phone = trimmed(agency.phone);
	const phoneExtension = trimmed(department?.phoneExtension);

	// No geo fields exist on the public DTO today. The map renders only when
	// a record really carries coordinates — never derived from a postcode.
	const record = agency as AgencyDataInterface & Record<string, unknown>;

	return {
		address,
		floorLocation: trimmed(department?.floorLocation),
		lat: finiteNumber(record.lat),
		lng: finiteNumber(record.lng),
		phone: phone && phoneExtension ? `${phone}-${phoneExtension}` : phone,
		hours:
			trimmed(department?.openingHours) ?? trimmed(agency.openingHours),
		about: trimmed(agency.description),
		url: trimmed(agency.url)
	};
}
