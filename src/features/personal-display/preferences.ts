import type { ContrastLevel } from '../../utils/theme/orisoScheme';

export const CONTRAST_OPTIONS: readonly ContrastLevel[] = [
	'standard',
	'medium',
	'high'
];

export const parseContrastLevel = (value: unknown): ContrastLevel =>
	value === 'high' || value === 'medium' ? value : 'standard';

export const TEXT_SIZES = [90, 100, 125, 150, 175, 200] as const;
export type TextSize = (typeof TEXT_SIZES)[number];
export type SchemePreference = 'system' | 'light' | 'dark';

export interface DisplayPreferences {
	scheme: SchemePreference;
	textSize: TextSize;
	contrast: ContrastLevel;
}

export const DEFAULT_DISPLAY: DisplayPreferences = {
	scheme: 'system',
	textSize: 100,
	contrast: 'standard'
};

const KEY_PREFIX = 'oriso.personal-display.v1:';

export const displayStorageKey = async (identity: string): Promise<string> => {
	const bytes = new TextEncoder().encode(identity);
	const digest = await crypto.subtle.digest('SHA-256', bytes);
	return (
		KEY_PREFIX +
		Array.from(new Uint8Array(digest), (byte) =>
			byte.toString(16).padStart(2, '0')
		).join('')
	);
};

export const parseDisplayPreferences = (
	stored: string | null
): DisplayPreferences => {
	if (stored === null) return DEFAULT_DISPLAY;
	try {
		const value = JSON.parse(stored);
		if (!value || typeof value !== 'object') return DEFAULT_DISPLAY;
		const scheme =
			value.scheme === 'light' || value.scheme === 'dark'
				? value.scheme
				: 'system';
		const textSize = TEXT_SIZES.includes(value.textSize)
			? value.textSize
			: 100;
		return {
			scheme,
			textSize,
			contrast: parseContrastLevel(value.contrast)
		};
	} catch {
		return DEFAULT_DISPLAY;
	}
};

export const getNextTextSize = (
	current: TextSize,
	direction: -1 | 1
): TextSize => {
	const index = TEXT_SIZES.indexOf(current) + direction;
	return TEXT_SIZES[index] ?? current;
};
