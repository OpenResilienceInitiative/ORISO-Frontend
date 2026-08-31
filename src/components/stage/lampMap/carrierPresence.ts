/**
 * Where the partner organisations shown on the stage are present — as the
 * picture design 5b ("Lichter der Hoffnung") paints it.
 *
 * ## This is schematic, not a data source
 *
 * The map on the login stage says "together they cover a lot of ground", it is
 * not a directory. Every carrier below is described the way the design does
 * it: a **nationwide share** of the dots inside the country (how much of the
 * whole map an organisation reaches at all), a few **clusters** around the
 * places it demonstrably concentrates on, and the **seed cities** its wave of
 * lights spreads out from. Bigger organisations light up from more cities at
 * once and reach further; small specialist services stay a handful of islands.
 *
 * None of this is a count or an address — see {@link loadCarrierPresence}
 * for how the platform's own agency data is meant to replace them one day.
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

export interface PresenceCluster {
	/** Places the organisation concentrates on, as lon/lat. */
	anchors: readonly GeoPoint[];
	/**
	 * Radius around each anchor in normalised map units (the map is 1x1), so
	 * ~0.06 is roughly a 40 km catchment.
	 */
	reach: number;
	/** Share of the grid points inside `reach` that light up, 0..1. */
	share: number;
}

export interface CarrierPresence {
	id: CarrierId;
	/**
	 * Share of *all* grid points inside the country that light up regardless
	 * of location, 0..1. Caritas is close to 1 — it is present in every
	 * diocese — a specialist service is 0.
	 */
	nationwide: number;
	/** Regional focus on top of the nationwide share. */
	clusters: readonly PresenceCluster[];
	/**
	 * Cities the wave of lights spreads out from. Every seed spreads at the
	 * same pace, so an organisation with many seeds simply lights up from more
	 * places in parallel — which is what "bigger" should look like.
	 */
	seeds: readonly GeoPoint[];
	/**
	 * Slows the spread down: 1 is the design's default pace, 3 makes the same
	 * number of lamps take three times as long to come on.
	 */
	pace: number;
	/** Human-readable source note, surfaced in the Storybook docs. */
	note: string;
}

/* --- cities, lon/lat ------------------------------------------------------ */

const AACHEN: GeoPoint = [6.08, 50.78];
const AUGSBURG: GeoPoint = [10.9, 48.37];
const BERLIN: GeoPoint = [13.4, 52.52];
const BREMEN: GeoPoint = [8.8, 53.08];
const DORTMUND: GeoPoint = [7.47, 51.51];
const DRESDEN: GeoPoint = [13.74, 51.05];
const DUESSELDORF: GeoPoint = [6.78, 51.23];
const ERFURT: GeoPoint = [11.03, 50.98];
const ESSEN: GeoPoint = [7.01, 51.46];
const FRANKFURT: GeoPoint = [8.68, 50.11];
const FREIBURG: GeoPoint = [7.85, 47.99];
const HAMBURG: GeoPoint = [10.0, 53.55];
const HANNOVER: GeoPoint = [9.73, 52.37];
const KOELN: GeoPoint = [6.96, 50.94];
const LEIPZIG: GeoPoint = [12.37, 51.34];
const MAGDEBURG: GeoPoint = [11.63, 52.13];
const MAINZ: GeoPoint = [8.27, 50.0];
const MUENCHEN: GeoPoint = [11.58, 48.14];
const MUENSTER: GeoPoint = [7.63, 51.96];
const NUERNBERG: GeoPoint = [11.08, 49.45];
const OSNABRUECK: GeoPoint = [8.05, 52.28];
const PADERBORN: GeoPoint = [8.75, 51.72];
const PASSAU: GeoPoint = [13.46, 48.57];
const REGENSBURG: GeoPoint = [12.1, 49.02];
const ROSTOCK: GeoPoint = [12.14, 54.09];
const STUTTGART: GeoPoint = [9.18, 48.78];
const WUERZBURG: GeoPoint = [9.93, 49.79];
const BAMBERG: GeoPoint = [10.89, 49.89];
const COTTBUS: GeoPoint = [14.33, 51.76];
const FULDA: GeoPoint = [9.68, 50.55];
const KARLSRUHE: GeoPoint = [8.4, 49.01];
const KIEL: GeoPoint = [10.14, 54.32];
const KOBLENZ: GeoPoint = [7.6, 50.36];
const KONSTANZ: GeoPoint = [9.17, 47.66];
const OLDENBURG: GeoPoint = [8.21, 53.14];
const SAARBRUECKEN: GeoPoint = [7.0, 49.23];
const SCHWERIN: GeoPoint = [11.42, 53.63];
const TRIER: GeoPoint = [6.64, 49.76];
const ULM: GeoPoint = [9.99, 48.4];

/*
 * Regional weighting. The Caritas family is densest where the Church is:
 * Rhineland/Westphalia, the south-west and Bavaria; a mid band through
 * Hesse, Rhineland-Palatinate, Saarland and Lower Saxony; thin in the north
 * and the east (Frank's Caritas locations map, 2026-08-18). Not counts —
 * a picture of where the marks are thick and where they are sparse.
 */
const HEARTLAND_WEST: readonly GeoPoint[] = [
	KOELN,
	DUESSELDORF,
	DORTMUND,
	ESSEN,
	MUENSTER,
	PADERBORN,
	AACHEN,
	KOBLENZ,
	TRIER
];
const HEARTLAND_SOUTHWEST: readonly GeoPoint[] = [
	FREIBURG,
	KARLSRUHE,
	STUTTGART,
	ULM,
	KONSTANZ,
	SAARBRUECKEN,
	MAINZ
];
const HEARTLAND_SOUTH: readonly GeoPoint[] = [
	MUENCHEN,
	AUGSBURG,
	REGENSBURG,
	PASSAU,
	NUERNBERG,
	WUERZBURG,
	BAMBERG
];
const MID_BAND: readonly GeoPoint[] = [
	FRANKFURT,
	FULDA,
	OSNABRUECK,
	OLDENBURG,
	HANNOVER,
	BREMEN
];
const NORTH_EAST_SPARSE: readonly GeoPoint[] = [
	HAMBURG,
	KIEL,
	SCHWERIN,
	ROSTOCK,
	BERLIN,
	MAGDEBURG,
	LEIPZIG,
	DRESDEN,
	ERFURT,
	COTTBUS
];

const IN_VIA_CITIES: readonly GeoPoint[] = [
	HAMBURG,
	BERLIN,
	HANNOVER,
	KOELN,
	DORTMUND,
	PADERBORN,
	FRANKFURT,
	MAINZ,
	WUERZBURG,
	NUERNBERG,
	MUENCHEN,
	STUTTGART,
	FREIBURG,
	DRESDEN,
	ERFURT,
	OSNABRUECK
];

const RAPHAEL_SITES: readonly GeoPoint[] = [
	HAMBURG,
	HANNOVER,
	OSNABRUECK,
	BERLIN,
	KOELN,
	FRANKFURT,
	STUTTGART,
	FREIBURG,
	MUENCHEN
];

/* --- the seven, as design 5b tunes them ----------------------------------- */

const STATIC_PRESENCE: readonly CarrierPresence[] = [
	{
		id: 'caritas',
		// A thin base everywhere; the heartlands stack on top of it.
		nationwide: 0.22,
		clusters: [
			{ anchors: HEARTLAND_WEST, reach: 0.13, share: 0.85 },
			{ anchors: HEARTLAND_SOUTHWEST, reach: 0.12, share: 0.8 },
			{ anchors: HEARTLAND_SOUTH, reach: 0.12, share: 0.75 },
			{ anchors: MID_BAND, reach: 0.1, share: 0.55 },
			{ anchors: NORTH_EAST_SPARSE, reach: 0.08, share: 0.3 }
		],
		seeds: [
			...HEARTLAND_WEST,
			...HEARTLAND_SOUTHWEST,
			...HEARTLAND_SOUTH,
			...MID_BAND,
			...NORTH_EAST_SPARSE
		],
		// The whole country takes its time — the wave should be watched, not
		// blink through.
		pace: 2.2,
		note: 'Present in every diocese with local branches — thick where the Church is (west, south-west, Bavaria), thinner through the middle, sparse in the north and east; the wave takes its time.'
	},
	{
		id: 'malteser',
		nationwide: 0.18,
		clusters: [
			{
				anchors: [
					...HEARTLAND_WEST,
					...HEARTLAND_SOUTH,
					...HEARTLAND_SOUTHWEST
				],
				reach: 0.11,
				share: 0.6
			},
			{
				anchors: [...MID_BAND, BERLIN, DRESDEN, HAMBURG],
				reach: 0.09,
				share: 0.4
			}
		],
		seeds: [
			KOELN,
			MUENCHEN,
			BERLIN,
			DRESDEN,
			MAINZ,
			HAMBURG,
			HANNOVER,
			STUTTGART,
			NUERNBERG,
			FREIBURG,
			MAGDEBURG,
			PASSAU,
			TRIER,
			PADERBORN
		],
		pace: 1,
		note: 'Nationwide along the dioceses, a bit thinner than Caritas, denser around the big centres of the west and south.'
	},
	{
		id: 'kreuzbund',
		nationwide: 0.12,
		clusters: [
			{ anchors: HEARTLAND_WEST, reach: 0.12, share: 0.8 },
			{
				anchors: [...HEARTLAND_SOUTH, ...HEARTLAND_SOUTHWEST],
				reach: 0.1,
				share: 0.6
			},
			{
				anchors: [OSNABRUECK, FULDA, HANNOVER, ERFURT],
				reach: 0.08,
				share: 0.45
			}
		],
		seeds: [
			PADERBORN,
			KOELN,
			MUENSTER,
			ESSEN,
			OSNABRUECK,
			WUERZBURG,
			REGENSBURG,
			BAMBERG,
			FREIBURG,
			ERFURT,
			HANNOVER,
			MUENCHEN,
			TRIER
		],
		pace: 1,
		note: 'Self-help groups organised along the dioceses, strongest in the west, then Bavaria and the south-west.'
	},
	{
		id: 'skf',
		nationwide: 0.06,
		clusters: [
			{ anchors: HEARTLAND_WEST, reach: 0.1, share: 0.7 },
			{
				anchors: [
					OSNABRUECK,
					HANNOVER,
					STUTTGART,
					MUENCHEN,
					AUGSBURG,
					FREIBURG,
					FRANKFURT,
					WUERZBURG
				],
				reach: 0.07,
				share: 0.55
			},
			{ anchors: [BERLIN, DRESDEN, ERFURT], reach: 0.05, share: 0.4 }
		],
		seeds: [
			DORTMUND,
			KOELN,
			ESSEN,
			OSNABRUECK,
			HANNOVER,
			STUTTGART,
			MUENCHEN,
			AUGSBURG,
			FREIBURG,
			FRANKFURT,
			BERLIN
		],
		pace: 1,
		note: 'Local associations, head office Dortmund — the west first, then the south and a few places in the east.'
	},
	{
		id: 'skm',
		nationwide: 0,
		clusters: [
			{ anchors: HEARTLAND_WEST, reach: 0.1, share: 0.75 },
			{
				anchors: [
					MAINZ,
					FRANKFURT,
					HANNOVER,
					OSNABRUECK,
					FREIBURG,
					STUTTGART,
					MUENCHEN,
					REGENSBURG,
					AUGSBURG
				],
				reach: 0.06,
				share: 0.55
			}
		],
		seeds: [
			KOELN,
			DUESSELDORF,
			DORTMUND,
			MUENSTER,
			MAINZ,
			MUENCHEN,
			HANNOVER,
			FREIBURG
		],
		pace: 1,
		note: 'Local associations with a focus on the Rhineland and Westphalia, plus a scatter through the south.'
	},
	{
		id: 'via',
		nationwide: 0,
		clusters: [{ anchors: IN_VIA_CITIES, reach: 0.045, share: 0.9 }],
		seeds: IN_VIA_CITIES,
		pace: 1,
		note: 'Active city by city, not area-wide.'
	},
	{
		id: 'raphael',
		nationwide: 0,
		clusters: [{ anchors: RAPHAEL_SITES, reach: 0.05, share: 1 }],
		seeds: RAPHAEL_SITES,
		pace: 3.2,
		note: 'Specialist migration counselling at a handful of sites — the sparsest picture of the seven, and the slowest to come on.'
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
 * counts, no "we are here" per address.
 */
export const loadCarrierPresence = async (): Promise<
	readonly CarrierPresence[]
> => STATIC_PRESENCE;

export const CARRIER_PRESENCE_IS_SCHEMATIC = true;
