/**
 * Where the partner organisations shown on the stage are actually present.
 *
 * ## This is schematic, not a data source
 *
 * The map on the login stage is a picture of "together they cover a lot of
 * ground", not a directory. The anchors below are the publicly documented
 * seats and focus regions of each organisation, not the platform's own agency
 * records — see {@link loadCarrierPresence} for how the real data is meant to
 * get in here later.
 *
 * Two rules keep the picture honest:
 *
 * 1. **No carrier covers the whole country.** Not even Caritas. Everything is
 *    anchored to places it demonstrably reaches, so the gaps stay gaps. A map
 *    where every square kilometre lights up for a single organisation reads as
 *    marketing; the empty patches are what make the combined coverage — and
 *    the fact that the carriers complement each other — believable.
 * 2. **Reach and density are per carrier.** A nationwide association with 700
 *    locations does not look like a specialist service at nine sites.
 */

export type GeoPoint = readonly [lon: number, lat: number];

export type CarrierId =
	| 'caritas'
	| 'malteser'
	| 'kreuzbund'
	| 'skf'
	| 'skm'
	| 'via'
	| 'raphael';

export interface CarrierPresence {
	id: CarrierId;
	/** Places the organisation reaches, as lon/lat. */
	anchors: readonly GeoPoint[];
	/**
	 * Radius around each anchor in normalised map units (the map is 1x1), so
	 * ~0.06 is roughly a 40 km catchment.
	 */
	reach: number;
	/** Share of the grid points inside `reach` that light up, 0..1. */
	density: number;
	/** Human-readable source note, surfaced in the Storybook docs. */
	note: string;
}

/**
 * The 27 German (arch)dioceses. Caritas, Malteser and Kreuzbund are all
 * organised along them, so they share this list and differ in reach/density.
 */
const DIOCESE_SEATS: readonly GeoPoint[] = [
	[6.08, 50.78], // Aachen
	[10.9, 48.37], // Augsburg
	[10.89, 49.89], // Bamberg
	[13.4, 52.52], // Berlin
	[13.74, 51.05], // Dresden-Meissen
	[11.19, 48.89], // Eichstaett
	[11.03, 50.98], // Erfurt
	[7.01, 51.46], // Essen
	[7.85, 47.99], // Freiburg
	[9.68, 50.55], // Fulda
	[14.99, 51.15], // Goerlitz
	[10.0, 53.55], // Hamburg
	[9.95, 52.15], // Hildesheim
	[6.96, 50.94], // Koeln
	[8.06, 50.39], // Limburg
	[11.63, 52.13], // Magdeburg
	[8.27, 50.0], // Mainz
	[11.58, 48.14], // Muenchen und Freising
	[7.63, 51.96], // Muenster
	[8.05, 52.28], // Osnabrueck
	[8.75, 51.72], // Paderborn
	[13.46, 48.57], // Passau
	[12.1, 49.02], // Regensburg
	[8.93, 48.48], // Rottenburg-Stuttgart
	[8.43, 49.32], // Speyer
	[6.64, 49.76], // Trier
	[9.93, 49.79] // Wuerzburg
];

/** Rhineland / Westphalia — the historic heartland of SkF, SkM and Kreuzbund. */
const WEST: readonly GeoPoint[] = [
	[6.96, 50.94], // Koeln
	[6.78, 51.23], // Duesseldorf
	[7.47, 51.51], // Dortmund
	[7.63, 51.96], // Muenster
	[8.75, 51.72], // Paderborn
	[7.01, 51.46], // Essen
	[6.08, 50.78], // Aachen
	[7.22, 51.27], // Wuppertal
	[7.1, 50.74] // Bonn
];

const BIG_CITIES: readonly GeoPoint[] = [
	[13.4, 52.52], // Berlin
	[10.0, 53.55], // Hamburg
	[11.58, 48.14], // Muenchen
	[6.96, 50.94], // Koeln
	[8.68, 50.11], // Frankfurt
	[9.18, 48.78], // Stuttgart
	[6.78, 51.23], // Duesseldorf
	[7.47, 51.51], // Dortmund
	[12.37, 51.34], // Leipzig
	[9.73, 52.37], // Hannover
	[11.08, 49.45], // Nuernberg
	[8.8, 53.08], // Bremen
	[13.74, 51.05], // Dresden
	[12.14, 54.09], // Rostock
	[10.14, 54.32], // Kiel
	[11.63, 52.13] // Magdeburg
];

const STATIC_PRESENCE: readonly CarrierPresence[] = [
	{
		id: 'caritas',
		anchors: [...DIOCESE_SEATS, ...BIG_CITIES],
		reach: 0.115,
		density: 0.82,
		note: 'Present in all 27 dioceses with local branches. Widest reach of the seven — but the sparsely covered north-east and the Eifel/Altmark gaps are real, not a rendering artefact.'
	},
	{
		id: 'malteser',
		anchors: [...DIOCESE_SEATS, ...BIG_CITIES],
		reach: 0.085,
		density: 0.5,
		note: 'Around 700 locations and 29 diocesan offices — nationwide, but thinner between the centres.'
	},
	{
		id: 'kreuzbund',
		anchors: [...DIOCESE_SEATS, ...WEST],
		reach: 0.075,
		density: 0.45,
		note: 'Roughly 1,400 self-help groups in 27 diocesan associations, strongest in the west.'
	},
	{
		id: 'skf',
		anchors: [
			...WEST,
			[9.73, 52.37], // Hannover
			[9.18, 48.78], // Stuttgart
			[11.58, 48.14], // Muenchen
			[10.9, 48.37], // Augsburg
			[7.85, 47.99], // Freiburg
			[13.4, 52.52], // Berlin
			[8.68, 50.11], // Frankfurt
			[9.93, 49.79], // Wuerzburg
			[8.05, 52.28] // Osnabrueck
		],
		reach: 0.055,
		density: 0.6,
		note: 'Roughly 130-150 local associations, head office Dortmund.'
	},
	{
		id: 'skm',
		anchors: [
			...WEST,
			[8.27, 50.0], // Mainz
			[8.68, 50.11], // Frankfurt
			[9.73, 52.37], // Hannover
			[7.85, 47.99], // Freiburg
			[11.58, 48.14] // Muenchen
		],
		reach: 0.05,
		density: 0.6,
		note: 'Roughly 120 associations from eleven dioceses, focus on the Rhineland and Westphalia.'
	},
	{
		id: 'via',
		anchors: [
			[10.0, 53.55], // Hamburg
			[13.4, 52.52], // Berlin
			[9.73, 52.37], // Hannover
			[6.96, 50.94], // Koeln
			[7.47, 51.51], // Dortmund
			[8.75, 51.72], // Paderborn
			[8.68, 50.11], // Frankfurt
			[8.27, 50.0], // Mainz
			[9.93, 49.79], // Wuerzburg
			[11.08, 49.45], // Nuernberg
			[11.58, 48.14], // Muenchen
			[9.18, 48.78], // Stuttgart
			[7.85, 47.99], // Freiburg
			[13.74, 51.05], // Dresden
			[11.03, 50.98], // Erfurt
			[8.05, 52.28] // Osnabrueck
		],
		reach: 0.04,
		density: 0.85,
		note: 'Active in more than 70 cities — city by city, not area-wide.'
	},
	{
		id: 'raphael',
		anchors: [
			[10.0, 53.55], // Hamburg
			[9.73, 52.37], // Hannover
			[8.05, 52.28], // Osnabrueck
			[13.4, 52.52], // Berlin
			[6.96, 50.94], // Koeln
			[8.68, 50.11], // Frankfurt
			[9.18, 48.78], // Stuttgart
			[7.85, 47.99], // Freiburg
			[11.58, 48.14] // Muenchen
		],
		reach: 0.032,
		density: 1,
		note: 'Specialist migration counselling at a handful of sites — deliberately the sparsest picture of the seven.'
	}
];

/**
 * The single seam where real coverage data will be plugged in.
 *
 * Today it resolves the static dataset above. The live path needs a public,
 * unauthenticated endpoint that aggregates agency postcodes per carrier — the
 * data exists server-side (`AgencyService` carries `postcode` on the agency,
 * `UserService` carries `PostcodeRangeDTO`), but the only public endpoint
 * today, `apiGetAgenciesByTenant`, takes a postcode as *input* and cannot
 * enumerate coverage.
 *
 * Once that endpoint exists this function fetches it, maps postcode prefixes
 * to coordinates and returns the same shape — nothing else in the effect has
 * to change.
 *
 * Whatever the source, the result must stay a picture and never a claim: no
 * counts, no "we are here" per address, and gaps must remain visible.
 */
export const loadCarrierPresence = async (): Promise<
	readonly CarrierPresence[]
> => STATIC_PRESENCE;

export const CARRIER_PRESENCE_IS_SCHEMATIC = true;
