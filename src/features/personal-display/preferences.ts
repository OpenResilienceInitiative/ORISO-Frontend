import type {
	ContrastLevel,
	DarkBrandMode
} from '../../utils/theme/orisoScheme';

export const CONTRAST_OPTIONS: readonly ContrastLevel[] = [
	'standard',
	'medium',
	'high'
];

// FE#1134: in dark, brand fills use the calm counterpart or the original
// brand colour (e.g. ORISO red).
export const DARK_BRAND_OPTIONS: readonly DarkBrandMode[] = [
	'counterpart',
	'original'
];

export const parseDarkBrand = (value: unknown): DarkBrandMode =>
	value === 'original' ? 'original' : 'counterpart';

/**
 * The last dark-brand choice on this device, without any identity, so the
 * sign-in page (before anyone is known) can follow it.
 */
export const DEVICE_DARK_BRAND_KEY = 'oriso.dark-brand.v1';

export const readDeviceDarkBrand = (): DarkBrandMode => {
	try {
		return parseDarkBrand(
			window.localStorage.getItem(DEVICE_DARK_BRAND_KEY)
		);
	} catch {
		return 'counterpart';
	}
};

export const parseContrastLevel = (value: unknown): ContrastLevel =>
	value === 'high' || value === 'medium' ? value : 'standard';

// Five evenly spaced slider stops with 100 % in the middle (Frank, FE#2451).
export const TEXT_SIZES = [50, 75, 100, 150, 200] as const;
export type TextSize = (typeof TEXT_SIZES)[number];
export type SchemePreference = 'system' | 'light' | 'dark';

export interface DisplayPreferences {
	scheme: SchemePreference;
	textSize: TextSize;
	contrast: ContrastLevel;
	darkBrand: DarkBrandMode;
}

export const DEFAULT_DISPLAY: DisplayPreferences = {
	scheme: 'system',
	textSize: 100,
	contrast: 'standard',
	darkBrand: 'counterpart'
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
			contrast: parseContrastLevel(value.contrast),
			darkBrand: parseDarkBrand(value.darkBrand)
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
