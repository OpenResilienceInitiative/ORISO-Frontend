/**
 * Where the carriers actually have counselling centres.
 *
 * ⚠️ PROVISIONAL DATA — Frank, 2026-08-07.
 *
 * These figures are reasoned estimates from each carrier's own published
 * self-description (number of associations, dioceses, locations), not from our
 * own agency records. They are good enough to be *plausible* and deliberately
 * not uniform: a map where every carrier covers every corner of Germany reads
 * as marketing, and it undersells the point that the carriers complement each
 * other. Gaps are the argument.
 *
 * What "real" would take: our agency API answers "which agencies serve postcode
 * X" (`GET /service/agencies?postcode=…`) — it cannot list the postcodes a
 * carrier actually covers. Making this truthful needs a coverage endpoint in
 * AgencyService (or a build-time export of agency postcodes), and then this
 * module becomes a thin adapter over that data.
 *
 * Everything the map knows lives in this one file, so swapping estimates for
 * real coverage touches nothing else.
 */

export interface CarrierCoverage {
	/** Fraction of the national dot grid this carrier lights up, 0..1. */
	national: number;
	/** Cities the carrier is concentrated around, by key of `CITIES`. */
	strongholds: string[];
	/** Radius around each stronghold, in normalised map units. */
	strongholdRadius: number;
	/** Fraction of grid dots inside a stronghold that light up, 0..1. */
	strongholdShare: number;
	/** Cities the lights spread out from, in parallel. */
	seeds: string[];
}

/** Longitude / latitude of the cities the coverage refers to. */
export const CITIES: Record<string, [number, number]> = {
	aachen: [6.08, 50.78],
	augsburg: [10.9, 48.37],
	berlin: [13.4, 52.52],
	bremen: [8.8, 53.08],
	dortmund: [7.47, 51.51],
	dresden: [13.74, 51.05],
	duesseldorf: [6.78, 51.23],
	erfurt: [11.03, 50.98],
	essen: [7.01, 51.46],
	frankfurt: [8.68, 50.11],
	freiburg: [7.85, 47.99],
	fulda: [9.68, 50.55],
	hamburg: [10.0, 53.55],
	hannover: [9.73, 52.37],
	kiel: [10.14, 54.32],
	koeln: [6.96, 50.94],
	leipzig: [12.37, 51.34],
	magdeburg: [11.63, 52.13],
	mainz: [8.27, 50.0],
	muenchen: [11.58, 48.14],
	muenster: [7.63, 51.96],
	nuernberg: [11.08, 49.45],
	osnabrueck: [8.05, 52.28],
	paderborn: [8.75, 51.72],
	passau: [13.46, 48.57],
	regensburg: [12.1, 49.02],
	rostock: [12.14, 54.09],
	speyer: [8.43, 49.32],
	stuttgart: [9.18, 48.78],
	trier: [6.64, 49.76],
	wuerzburg: [9.93, 49.79]
};

const WEST = [
	'koeln',
	'duesseldorf',
	'dortmund',
	'muenster',
	'paderborn',
	'essen',
	'aachen'
];

export const CARRIER_COVERAGE: Record<string, CarrierCoverage> = {
	// Present in all 27 dioceses — the broadest reach by far, but not literally
	// every village. Lowered from a near-total 0.99: a fully covered map was
	// the single least believable thing on the screen.
	caritas: {
		national: 0.82,
		strongholds: ['koeln', 'freiburg', 'muenchen', 'paderborn'],
		strongholdRadius: 0.1,
		strongholdShare: 0.9,
		seeds: [
			'berlin',
			'hamburg',
			'muenchen',
			'koeln',
			'frankfurt',
			'stuttgart',
			'duesseldorf',
			'dortmund',
			'leipzig',
			'dresden',
			'hannover',
			'nuernberg',
			'bremen',
			'muenster',
			'freiburg',
			'rostock',
			'erfurt',
			'magdeburg'
		],
	},
	// 700+ locations, 29 diocesan offices — nationwide, noticeably thinner.
	malteser: {
		national: 0.5,
		strongholds: ['koeln', 'muenchen', 'berlin', 'dresden', 'mainz'],
		strongholdRadius: 0.12,
		strongholdShare: 0.8,
		seeds: [
			'koeln',
			'muenchen',
			'berlin',
			'dresden',
			'mainz',
			'hamburg',
			'hannover',
			'stuttgart',
			'nuernberg',
			'freiburg',
			'magdeburg',
			'passau'
		],
	},
	// ~1400 self-help groups in 27 diocesan associations, strongest in the west.
	kreuzbund: {
		national: 0.3,
		strongholds: [
			...WEST,
			'paderborn',
			'osnabrueck',
			'wuerzburg',
			'regensburg'
		],
		strongholdRadius: 0.11,
		strongholdShare: 0.85,
		seeds: [
			'paderborn',
			'koeln',
			'muenster',
			'osnabrueck',
			'wuerzburg',
			'regensburg',
			'freiburg',
			'erfurt',
			'hannover',
			'muenchen'
		],
	},
	// ~130–150 local associations, head office Dortmund.
	skf: {
		national: 0.16,
		strongholds: [
			...WEST,
			'hannover',
			'stuttgart',
			'muenchen',
			'augsburg',
			'freiburg'
		],
		strongholdRadius: 0.1,
		strongholdShare: 0.75,
		seeds: [
			'dortmund',
			'koeln',
			'hannover',
			'stuttgart',
			'muenchen',
			'augsburg',
			'freiburg',
			'berlin'
		],
	},
	// ~120 associations from eleven dioceses, Rhineland / Westphalia focus.
	skm: {
		national: 0,
		strongholds: [
			...WEST,
			'mainz',
			'frankfurt',
			'hannover',
			'freiburg',
			'muenchen'
		],
		strongholdRadius: 0.1,
		strongholdShare: 0.8,
		seeds: [
			'koeln',
			'duesseldorf',
			'dortmund',
			'mainz',
			'muenchen',
			'hannover'
		],
	},
	// Active in more than 70 cities.
	via: {
		national: 0,
		strongholds: [
			'hamburg',
			'berlin',
			'hannover',
			'koeln',
			'dortmund',
			'paderborn',
			'frankfurt',
			'mainz',
			'wuerzburg',
			'nuernberg',
			'muenchen',
			'stuttgart',
			'freiburg',
			'dresden',
			'erfurt',
			'osnabrueck'
		],
		strongholdRadius: 0.045,
		strongholdShare: 0.9,
		seeds: [
			'hamburg',
			'berlin',
			'hannover',
			'koeln',
			'dortmund',
			'frankfurt',
			'muenchen',
			'stuttgart'
		],
	},
	// Specialist migration counselling at a handful of locations only.
	raphael: {
		national: 0,
		strongholds: ['hamburg', 'berlin', 'frankfurt', 'muenchen', 'koeln'],
		strongholdRadius: 0.03,
		strongholdShare: 0.95,
		seeds: ['hamburg', 'berlin', 'frankfurt', 'muenchen', 'koeln'],
	}
};

/**
 * True while the map is drawn from the estimates above rather than from real
 * agency data. Storybook reads this to label the story honestly.
 */
export const COVERAGE_IS_PROVISIONAL = true;
