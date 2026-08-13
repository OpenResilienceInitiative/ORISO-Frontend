import { AgencyDataInterface } from '../globalState/interfaces';

/**
 * Agencies the asker is already in contact with come first (Array.prototype
 * .sort is stable, so relative order inside both groups is preserved).
 */
export const sortKnownAgenciesFirst = (
	agencies: AgencyDataInterface[],
	knownAgencyIds: number[] = []
): AgencyDataInterface[] => {
	const known = new Set(knownAgencyIds);
	return [...agencies].sort(
		(a, b) => Number(known.has(b.id)) - Number(known.has(a.id))
	);
};
