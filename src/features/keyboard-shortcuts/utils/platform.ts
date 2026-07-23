import type { Platform } from '../types';

/**
 * Detect runtime platform. Safe for SSR / tests — pass an injected navigator.
 */
export const getPlatform = (
	userAgent?: string,
	platformHint?: string
): Platform => {
	const ua =
		userAgent ??
		(typeof navigator !== 'undefined' ? navigator.userAgent : '');
	const plat =
		platformHint ??
		(typeof navigator !== 'undefined'
			? (
					navigator as Navigator & {
						userAgentData?: { platform?: string };
					}
				).userAgentData?.platform || navigator.platform
			: '');

	const haystack = `${ua} ${plat}`.toLowerCase();
	if (/mac|iphone|ipad|ipod/.test(haystack)) {
		return 'mac';
	}
	if (/win/.test(haystack)) {
		return 'windows';
	}
	if (/linux|android|cros/.test(haystack)) {
		return 'linux';
	}
	return 'unknown';
};

/** Primary modifier: Cmd (meta) on macOS, Ctrl elsewhere. */
export const getPrimaryModifier = (platform: Platform): 'meta' | 'ctrl' =>
	platform === 'mac' ? 'meta' : 'ctrl';

export const isPrimaryModifierPressed = (
	event: Pick<KeyboardEvent, 'ctrlKey' | 'metaKey'>,
	platform: Platform
): boolean => {
	const primary = getPrimaryModifier(platform);
	return primary === 'meta' ? event.metaKey : event.ctrlKey;
};
