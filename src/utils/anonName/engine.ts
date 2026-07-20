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

// Curated 52-colour avatar palette drawn from traditional Japanese (和色) and
// British/English heritage colours, spanning light AND deep-dark tones for
// variety. Every colour is vetted so that either near-black (#1a1a1a) or white
// reaches a WCAG contrast ratio ≥ 4.5 against it (see pickIconColor); muddy
// mid-tones where neither is crisp were deliberately excluded. One random pick
// per generation; the animal is recoloured to contrast the background.
const AVATAR_COLORS = [
	// --- Light (pairs with a near-black animal) ---
	'#FCE7E6', // JP Sakura
	'#F6BFBC', // JP Toki
	'#EEBBCB', // JP Nadeshiko
	'#F0908D', // JP Usubeni
	'#FCE2C4', // JP Tamago
	'#EAD56B', // JP Kariyasu
	'#D6E9CA', // JP Byakuroku
	'#D8E698', // JP Wakana
	'#EBF6F7', // JP Aijiro
	'#BBBCDE', // JP Fuji
	'#BCE2E8', // JP Mizu
	'#FABF14', // JP Ukon
	'#A3C1AD', // UK Cambridge Blue
	'#B0E0E6', // UK Powder Blue
	'#96C8A2', // UK Eton Blue
	'#B2AC88', // UK Sage
	'#F0DC82', // UK Buff
	'#F6DE9B', // UK Primrose
	'#F7CAC9', // UK Rose Quartz
	'#C6D3E3', // UK Wedgwood
	'#C9E4DE', // UK Duck Egg
	'#C3B1D0', // UK Heather
	// --- Dark (pairs with a white animal) ---
	'#165E83', // JP Ai (indigo)
	'#223A70', // JP Kon
	'#1E50A2', // JP Ruri
	'#19448E', // JP Rurikon
	'#4C6CB3', // JP Gunjo
	'#007B43', // JP Tokiwa (green)
	'#B7282E', // JP Akane
	'#C9171E', // JP Kurenai
	'#6C2C2F', // JP Ebicha
	'#745399', // JP Edomurasaki
	'#5E4491', // JP Sumire
	'#4F284B', // JP Murasaki
	'#1D697C', // JP Nando
	'#2C4F54', // JP Onando
	'#181B39', // JP Kachi
	'#A22041', // JP Botan
	'#211915', // JP Kurotsurubami
	'#004225', // UK British Racing Green
	'#002147', // UK Oxford Blue
	'#003153', // UK Prussian Blue
	'#7F1734', // UK Claret
	'#800020', // UK Burgundy
	'#355E3B', // UK Hunter Green
	'#005F6A', // UK Teal
	'#1B1F3B', // UK Navy
	'#472D47', // UK Aubergine
	'#4B2E44', // UK Damson
	'#48586A', // UK Slate
	'#5C2A4B', // UK Mulberry
	'#093824' // UK Bottle Green
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

/** WCAG relative luminance (0–1) of a #rrggbb colour (gamma-correct sRGB). */
export function luminance(hex: string): number {
	const n = parseInt(hex.slice(1), 16);
	const channel = (c: number) => {
		const s = c / 255;
		return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
	};
	const r = channel((n >> 16) & 255);
	const g = channel((n >> 8) & 255);
	const b = channel(n & 255);
	return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio (1–21) between two colours (given as #rrggbb). */
export function contrastRatio(a: string, b: string): number {
	const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
	return (hi + 0.05) / (lo + 0.05);
}

const ICON_DARK = '#1a1a1a';
const ICON_LIGHT = '#ffffff';

/** Minimum WCAG contrast an animal colour must reach against its background so
 *  the silhouette stays clearly legible. */
const MIN_ICON_CONTRAST = 4.5;

/** How many complementary palette colours to offer per background (the most
 *  hue-distant, contrast-passing ones). Black + white are always added on top,
 *  so they stay part of the mix. */
const COMPLEMENTARY_ICON_LIMIT = 6;

/** Hue angle (0–360) of a #rrggbb colour. */
function hueOf(hex: string): number {
	const n = parseInt(hex.slice(1), 16);
	const r = ((n >> 16) & 255) / 255;
	const g = ((n >> 8) & 255) / 255;
	const b = (n & 255) / 255;
	const max = Math.max(r, g, b);
	const min = Math.min(r, g, b);
	const d = max - min;
	if (d === 0) return 0;
	let h: number;
	if (max === r) h = ((g - b) / d) % 6;
	else if (max === g) h = (b - r) / d + 2;
	else h = (r - g) / d + 4;
	h *= 60;
	return h < 0 ? h + 360 : h;
}

/** Shortest angular distance (0–180) between two hues. */
function hueDistance(a: number, b: number): number {
	const d = Math.abs(a - b) % 360;
	return d > 180 ? 360 - d : d;
}

const PALETTE_META = AVATAR_COLORS.map((hex) => ({ hex, hue: hueOf(hex) }));

/** Pick the animal colour (near-black or white) that maximises WCAG contrast
 *  against the given background — legible on any palette entry. */
export function pickIconColor(bg: string): string {
	return contrastRatio(bg, ICON_DARK) >= contrastRatio(bg, ICON_LIGHT)
		? ICON_DARK
		: ICON_LIGHT;
}

/**
 * All animal-colour options that stay legible on `bg` (WCAG ≥ 4.5): the
 * black/white that pass, PLUS the most hue-distant ("complementary") colours
 * from the same curated palette. Black/white remain in the pool so the classic
 * high-contrast look still appears. Always returns at least one entry.
 */
export function iconCandidates(bg: string): string[] {
	const bw = [ICON_DARK, ICON_LIGHT].filter(
		(c) => contrastRatio(bg, c) >= MIN_ICON_CONTRAST
	);
	const bgHue = hueOf(bg);
	const complementary = PALETTE_META.filter(
		(p) => p.hex.toLowerCase() !== bg.toLowerCase()
	)
		.map((p) => ({ hex: p.hex, dist: hueDistance(bgHue, p.hue) }))
		.filter((p) => contrastRatio(bg, p.hex) >= MIN_ICON_CONTRAST)
		.sort((x, y) => y.dist - x.dist)
		.slice(0, COMPLEMENTARY_ICON_LIMIT)
		.map((p) => p.hex);

	const pool = [...bw, ...complementary];
	return pool.length > 0 ? pool : [pickIconColor(bg)];
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
	/** Animal label of the display name, e.g. "Katze". Used to build a short
	 *  login username (animal + name, without the adjective). */
	animalLabel: string;
	/** Given name of the display name, e.g. "Mika". */
	name: string;
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
	const bg = pick(AVATAR_COLORS);
	return { file, bg, iconColor: pick(iconCandidates(bg)) };
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
		avatar: avatarFor(animal.svg),
		animalLabel: animal.label,
		name
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

const ALL_ANIMAL_FILES = [
	...new Set(
		Object.values(LANGUAGE_DATA)
			.flatMap((lang) => lang.groups)
			.flatMap((group) => group.animals)
			.map((animal) => animal.svg)
	)
];

function hashUserId(userId: string): number {
	let hash = 0;
	for (let i = 0; i < userId.length; i++) {
		hash = (hash << 5) - hash + userId.charCodeAt(i);
		hash |= 0;
	}
	return Math.abs(hash);
}

/** Deterministic avatar derived from a stable user identifier. */
export function generateAvatarForUser(userId: string): Avatar {
	const absHash = hashUserId(userId);
	const bg = AVATAR_COLORS[absHash % AVATAR_COLORS.length];
	// Deterministic icon colour from the same candidate pool as the random path
	// (a shifted hash slice so it doesn't track the bg index).
	const candidates = iconCandidates(bg);
	const iconColor =
		candidates[Math.floor(absHash / AVATAR_COLORS.length) % candidates.length];
	const animalFile =
		ALL_ANIMAL_FILES[absHash % ALL_ANIMAL_FILES.length] ??
		ALL_ANIMAL_FILES[0];

	return { file: animalFile, bg, iconColor };
}

/** A 16-char password guaranteed to contain a digit, an upper- and a lowercase
 *  letter, and a special character. No ambiguous look-alikes. Keep special
 *  characters URI-safe: registration currently sends the password through an
 *  encoded JSON payload before auto-login reuses the raw value.
 */
export function generatePassword(): string {
	const lower = 'abcdefghijkmnpqrstuvwxyz';
	const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
	const digit = '23456789';
	const special = '!-_*';
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
	svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
	svg.setAttribute(
		'style',
		`${svg.getAttribute('style') || ''};display:block;max-width:100%;max-height:100%;overflow:visible;`
	);
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
