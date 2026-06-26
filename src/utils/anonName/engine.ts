// Shared anonymous-name engine — framework-agnostic core.
//
// Single source of truth for the "anonymous identity" used across ORISO: the
// registration step AND the registration-less live chat. Ported from Frank's
// standalone tool (github.com/Storypapst/anonymous-name-generator). Format:
// `adjective + Animal + name` (e.g. "freundliche Katze Mika"), with a matching
// animal avatar that is recoloured to contrast a random pastel circle.
//
// This module has NO app/framework coupling (no MUI, no bundler globals). Each
// app supplies its own way to load the animal SVG *text*, then calls
// `recolorSvg`. The prototype's Vite adapter lives in `loadAvatar.ts`.

import { LANGUAGE_DATA, type NickLang } from './data';

// The widget's 35-colour pastel palette (24 light + 11 dark). One random pick
// per generation; the animal is recoloured to contrast it.
const PASTEL_COLORS = [
	'#FFB3BA',
	'#FFDFBA',
	'#FFFFBA',
	'#BAFFC9',
	'#BAE1FF',
	'#E8BAFF',
	'#FFC9DE',
	'#C9FFE5',
	'#D4C9FF',
	'#FFE4C9',
	'#B5EAD7',
	'#C7CEEA',
	'#FFDAC1',
	'#FF9AA2',
	'#F0E6EF',
	'#D5AAFF',
	'#85E3FF',
	'#BFFCC6',
	'#DBCDF0',
	'#F2C6DE',
	'#A0CED9',
	'#FFC6FF',
	'#CAFFBF',
	'#9BF6FF',
	'#FFD6A5',
	'#2D4A3E',
	'#4A2D3E',
	'#2D3E4A',
	'#5C3A21',
	'#3E2D4A',
	'#1B3A4B',
	'#4B1B3A',
	'#3A4B1B',
	'#6B3FA0',
	'#A03F6B'
];

const secureRandomInt = (maxExclusive: number): number => {
	if (maxExclusive <= 0) {
		return 0;
	}

	const cryptoObject =
		typeof crypto !== 'undefined' &&
		typeof crypto.getRandomValues === 'function'
			? crypto
			: undefined;

	if (!cryptoObject) {
		return Math.floor(Math.random() * maxExclusive);
	}

	const maxUint32 = 0xffffffff;
	const limit = maxUint32 - (maxUint32 % maxExclusive);
	const values = new Uint32Array(1);
	let value = 0;

	do {
		cryptoObject.getRandomValues(values);
		value = values[0];
	} while (value >= limit);

	return value % maxExclusive;
};

const pick = <T>(arr: T[]): T => arr[secureRandomInt(arr.length)];

/** Perceived luminance (0–1) of a #rrggbb colour (same weights as the widget). */
export function luminance(hex: string): number {
	const n = parseInt(hex.slice(1), 16);
	const r = (n >> 16) & 255;
	const g = (n >> 8) & 255;
	const b = n & 255;
	return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

export interface Avatar {
	/** Animal SVG filename (the app maps this to its own asset path). */
	file: string;
	/** Random pastel circle background. */
	bg: string;
	/** Animal colour chosen to contrast bg: white on dark, near-black on light. */
	iconColor: string;
}

export interface Pseudonym {
	/** Display name, e.g. "freundliche Katze Mika" (never the identity/User-ID). */
	displayName: string;
	avatar: Avatar;
}

/** Languages the engine ships (others should fall back to one of these). */
export const SUPPORTED = Object.keys(LANGUAGE_DATA);

const dataFor = (lang: string): NickLang => {
	const normalizedLang = lang.toLowerCase().split(/[-_@.]/)[0];
	return (
		LANGUAGE_DATA[normalizedLang] ??
		LANGUAGE_DATA[lang] ??
		LANGUAGE_DATA.en ??
		LANGUAGE_DATA.de
	);
};

const avatarFor = (file: string): Avatar => {
	const bg = pick(PASTEL_COLORS);
	return { file, bg, iconColor: luminance(bg) < 0.5 ? '#ffffff' : '#1a1a1a' };
};

/** A display-name pseudonym + its matching avatar, in the given language. */
export function generatePseudonym(lang = 'de'): Pseudonym {
	const data = dataFor(lang);
	const group = pick(data.groups);
	const adjective = pick(group.adjectives);
	const animal = pick(group.animals);
	const name = pick(data.names);
	return {
		displayName: `${adjective} ${animal.label} ${name}`,
		avatar: avatarFor(animal.svg)
	};
}

/** Like generatePseudonym, but avoids immediately repeating `current`. */
export function regeneratePseudonym(
	current: Pseudonym | undefined,
	lang = 'de'
): Pseudonym {
	let next = generatePseudonym(lang);
	for (let i = 0; i < 8 && next.displayName === current?.displayName; i++) {
		next = generatePseudonym(lang);
	}
	return next;
}

/** Re-roll only the avatar animal (any group of the given language). */
export function generateAvatar(lang = 'de'): Avatar {
	return avatarFor(pick(pick(dataFor(lang).groups).animals).svg);
}

/** A 16-char password guaranteed to contain a digit, an upper- and a lowercase
 *  letter, and a special character. No ambiguous look-alikes. */
export function generatePassword(): string {
	const lower = 'abcdefghijkmnpqrstuvwxyz';
	const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
	const digit = '23456789';
	const special = '!@#$%&*?-_+';
	const all = lower + upper + digit + special;
	const chars = [
		pick([...lower]),
		pick([...upper]),
		pick([...digit]),
		pick([...special])
	];
	while (chars.length < 16) chars.push(pick([...all]));
	for (let i = chars.length - 1; i > 0; i--) {
		const j = secureRandomInt(i + 1);
		[chars[i], chars[j]] = [chars[j], chars[i]];
	}
	return chars.join('');
}

/** Recolour a monochrome animal SVG to `iconColor` (line/silhouette art that
 *  defaults to black). White / none are preserved so highlights stay light.
 *  Browser-only (uses DOMParser); both ORISO apps run in the browser. */
export function recolorSvg(svgText: string, iconColor: string): string {
	const doc = new DOMParser().parseFromString(svgText, 'image/svg+xml');
	const svg = doc.documentElement;
	svg.setAttribute('width', '100%');
	svg.setAttribute('height', '100%');
	const keep = new Set(['none', 'white', '#fff', '#ffffff']);
	svg.querySelectorAll(
		'path, circle, rect, ellipse, line, polyline, polygon'
	).forEach((el) => {
		const f = el.getAttribute('fill');
		if (f === null || !keep.has(f.toLowerCase()))
			el.setAttribute('fill', iconColor);
		const s = el.getAttribute('stroke');
		if (s && !keep.has(s.toLowerCase()))
			el.setAttribute('stroke', iconColor);
	});
	return new XMLSerializer().serializeToString(svg);
}
