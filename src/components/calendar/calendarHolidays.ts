/**
 * German public holidays per Bundesland (FE#1050, contract v1.2): the
 * calendar treats them as days off when the counsellor names a region.
 * UserService stores only the region; the dates are computed here.
 *
 * Pure and dependency-free. Only holidays that are statutory in a whole
 * Land count: Fronleichnam in parts of Saxony and Thuringia, Mariä
 * Himmelfahrt in Bavarian municipalities and the Augsburger Friedensfest
 * are local and left out, as are one-off holidays (Berlin, 8 May 2020/2025).
 */

/** ISO 3166-2:DE suffixes, the order of the contract. */
export const HOLIDAY_REGIONS = [
	'BW',
	'BY',
	'BE',
	'BB',
	'HB',
	'HH',
	'HE',
	'MV',
	'NI',
	'NW',
	'RP',
	'SL',
	'SN',
	'ST',
	'SH',
	'TH'
] as const;

export type HolidayRegion = (typeof HOLIDAY_REGIONS)[number];

export const isHolidayRegion = (value: unknown): value is HolidayRegion =>
	typeof value === 'string' &&
	(HOLIDAY_REGIONS as readonly string[]).includes(value);

/** Stable keys, so the UI can name a holiday in the reader's language. */
export type HolidayKey =
	| 'newYear'
	| 'epiphany'
	| 'womensDay'
	| 'goodFriday'
	| 'easterSunday'
	| 'easterMonday'
	| 'labourDay'
	| 'ascension'
	| 'whitSunday'
	| 'whitMonday'
	| 'corpusChristi'
	| 'assumption'
	| 'childrensDay'
	| 'unityDay'
	| 'reformationDay'
	| 'allSaints'
	| 'repentanceDay'
	| 'christmasDay'
	| 'boxingDay';

export interface PublicHoliday {
	/** Local date, YYYY-MM-DD. */
	date: string;
	key: HolidayKey;
	/** The German name, e.g. "Buß- und Bettag". */
	name: string;
}

/** YYYY-MM-DD of a local date. */
export const dateKeyOf = (date: Date) =>
	`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

/**
 * Easter Sunday of a Gregorian year (the anonymous Gregorian algorithm,
 * Meeus/Jones/Butcher), as a local date at midnight.
 */
export const easterSunday = (year: number) => {
	const a = year % 19;
	const b = Math.floor(year / 100);
	const c = year % 100;
	const d = Math.floor(b / 4);
	const e = b % 4;
	const f = Math.floor((b + 8) / 25);
	const g = Math.floor((b - f + 1) / 3);
	const h = (19 * a + b - d - g + 15) % 30;
	const i = Math.floor(c / 4);
	const k = c % 4;
	const l = (32 + 2 * e + 2 * i - h - k) % 7;
	const m = Math.floor((a + 11 * h + 22 * l) / 451);
	const month = Math.floor((h + l - 7 * m + 114) / 31);
	const day = ((h + l - 7 * m + 114) % 31) + 1;
	return new Date(year, month - 1, day);
};

const plusDays = (date: Date, days: number) =>
	new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);

/** Buß- und Bettag: the Wednesday before 23 November. */
const repentanceDay = (year: number) => {
	const nov22 = new Date(year, 10, 22);
	return plusDays(nov22, -((nov22.getDay() - 3 + 7) % 7));
};

interface Rule {
	key: HolidayKey;
	name: string;
	date: (year: number, easter: Date) => Date;
	/** Absent = every Land. */
	regions?: HolidayRegion[];
	/** First year the rule applies in (per region where it differs). */
	since?: number | Partial<Record<HolidayRegion, number>>;
}

const fixed = (month: number, day: number) => (year: number) =>
	new Date(year, month - 1, day);
const fromEaster = (days: number) => (_year: number, easter: Date) =>
	plusDays(easter, days);

const RULES: Rule[] = [
	{ key: 'newYear', name: 'Neujahr', date: fixed(1, 1) },
	{
		key: 'epiphany',
		name: 'Heilige Drei Könige',
		date: fixed(1, 6),
		regions: ['BW', 'BY', 'ST']
	},
	{
		key: 'womensDay',
		name: 'Internationaler Frauentag',
		date: fixed(3, 8),
		regions: ['BE', 'MV'],
		since: { BE: 2019, MV: 2023 }
	},
	{ key: 'goodFriday', name: 'Karfreitag', date: fromEaster(-2) },
	{
		key: 'easterSunday',
		name: 'Ostersonntag',
		date: fromEaster(0),
		regions: ['BB', 'HE']
	},
	{ key: 'easterMonday', name: 'Ostermontag', date: fromEaster(1) },
	{ key: 'labourDay', name: 'Tag der Arbeit', date: fixed(5, 1) },
	{ key: 'ascension', name: 'Christi Himmelfahrt', date: fromEaster(39) },
	{
		key: 'whitSunday',
		name: 'Pfingstsonntag',
		date: fromEaster(49),
		regions: ['BB', 'HE']
	},
	{ key: 'whitMonday', name: 'Pfingstmontag', date: fromEaster(50) },
	{
		key: 'corpusChristi',
		name: 'Fronleichnam',
		date: fromEaster(60),
		regions: ['BW', 'BY', 'HE', 'NW', 'RP', 'SL']
	},
	{
		key: 'assumption',
		name: 'Mariä Himmelfahrt',
		date: fixed(8, 15),
		regions: ['SL']
	},
	{
		key: 'childrensDay',
		name: 'Weltkindertag',
		date: fixed(9, 20),
		regions: ['TH'],
		since: 2019
	},
	{ key: 'unityDay', name: 'Tag der Deutschen Einheit', date: fixed(10, 3) },
	{
		key: 'reformationDay',
		name: 'Reformationstag',
		date: fixed(10, 31),
		regions: ['BB', 'HB', 'HH', 'MV', 'NI', 'SN', 'ST', 'SH', 'TH'],
		since: { HB: 2018, HH: 2018, NI: 2018, SH: 2018 }
	},
	{
		key: 'allSaints',
		name: 'Allerheiligen',
		date: fixed(11, 1),
		regions: ['BW', 'BY', 'NW', 'RP', 'SL']
	},
	{
		key: 'repentanceDay',
		name: 'Buß- und Bettag',
		date: (year) => repentanceDay(year),
		regions: ['SN']
	},
	{ key: 'christmasDay', name: '1. Weihnachtstag', date: fixed(12, 25) },
	{ key: 'boxingDay', name: '2. Weihnachtstag', date: fixed(12, 26) }
];

const applies = (rule: Rule, year: number, region: HolidayRegion) => {
	if (rule.regions && !rule.regions.includes(region)) return false;
	if (rule.since === undefined) return true;
	const since =
		typeof rule.since === 'number' ? rule.since : rule.since[region];
	return since === undefined || year >= since;
};

const cache = new Map<string, PublicHoliday[]>();

/** Every public holiday of `region` in `year`, earliest first. */
export const publicHolidays = (
	year: number,
	region: HolidayRegion
): PublicHoliday[] => {
	const cacheKey = `${year}-${region}`;
	const cached = cache.get(cacheKey);
	if (cached) return cached;
	const easter = easterSunday(year);
	const list = RULES.filter((rule) => applies(rule, year, region))
		.map((rule) => ({
			date: dateKeyOf(rule.date(year, easter)),
			key: rule.key,
			name: rule.name
		}))
		.sort((a, b) => a.date.localeCompare(b.date));
	cache.set(cacheKey, list);
	return list;
};

/** The holiday on that local day, if `region` has one. */
export const holidayOn = (
	date: Date,
	region?: HolidayRegion | null
): PublicHoliday | undefined => {
	if (!region) return undefined;
	const key = dateKeyOf(date);
	return publicHolidays(date.getFullYear(), region).find(
		(h) => h.date === key
	);
};

/** The first holiday on or after `from` ("Nächster Feiertag: …"). */
export const nextHoliday = (
	from: Date,
	region?: HolidayRegion | null
): PublicHoliday | undefined => {
	if (!region) return undefined;
	const key = dateKeyOf(from);
	const year = from.getFullYear();
	return [
		...publicHolidays(year, region),
		...publicHolidays(year + 1, region)
	].find((h) => h.date >= key);
};
