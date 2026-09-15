// @vitest-environment jsdom
/**
 * Runtime palette application (THB-05): stored seeds → engine →
 * `--m3-*` custom properties at :root, with safe fallbacks.
 *
 * Traces: UAT-D, UAT-E, UAT-I (Tests #18–#22 in THB — Test Logic).
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { computeOrisoPalette } from './orisoScheme';
import {
	ACTIVE_SCHEMES,
	THEME_APPLIED_EVENT,
	applyTenantPalette,
	computeOrisoSchemes,
	readTenantSeeds
} from './applyTenantTheme';

const freshRoot = () => {
	const root = document.createElement('div');
	return root;
};

afterEach(() => {
	vi.restoreAllMocks();
});

describe('seed reading (legacy compatible)', () => {
	it('treats a legacy primaryColor-only record as the primary seed', () => {
		expect(
			readTenantSeeds({
				primaryColor: '#a5000a',
				secondaryColor: '#a5000a'
			})
		).toEqual({ primary: '#a5000a', accent: undefined, signal: undefined });
	});

	it('reads accent and signal seeds when stored', () => {
		expect(
			readTenantSeeds({
				primaryColor: '#a5000a',
				accent: '#646d78',
				signal: '#b1005e'
			})
		).toEqual({
			primary: '#a5000a',
			accent: '#646d78',
			signal: '#b1005e'
		});
	});

	it('returns null without a primary seed', () => {
		expect(readTenantSeeds(undefined)).toBeNull();
		expect(readTenantSeeds({})).toBeNull();
		expect(readTenantSeeds({ logo: 'x' } as any)).toBeNull();
	});
});

/**
 * #1256: an empty/invalid seed must not discard the rest of the palette.
 * Empty string, whitespace and absent are the same (no seed). Invalid hex
 * is dropped for that field only.
 */
describe('independent seed fallback (#1256)', () => {
	const VALID_PRIMARY = '#A5000A';
	const VALID_ACCENT = '#646d78';
	const VALID_SIGNAL = '#b1005e';
	const BLANK = ['', '   ', undefined] as const;
	const INVALID_HEX = 'not-a-hex';

	it('treats empty, whitespace and absent primary as no palette', () => {
		for (const primaryColor of [...BLANK, null]) {
			expect(readTenantSeeds({ primaryColor })).toBeNull();
		}
	});

	it('treats empty, whitespace and absent accent as absent', () => {
		for (const accent of BLANK) {
			expect(
				readTenantSeeds({ primaryColor: VALID_PRIMARY, accent })
			).toEqual({
				primary: VALID_PRIMARY,
				accent: undefined,
				signal: undefined
			});
		}
	});

	it('treats empty, whitespace and absent signal as absent', () => {
		for (const signal of BLANK) {
			expect(
				readTenantSeeds({ primaryColor: VALID_PRIMARY, signal })
			).toEqual({
				primary: VALID_PRIMARY,
				accent: undefined,
				signal: undefined
			});
		}
	});

	it('applies a valid primary when accent is empty, whitespace, absent or invalid-hex', () => {
		const { tokens } = computeOrisoPalette(
			{ primary: VALID_PRIMARY },
			'light'
		);
		for (const accent of [...BLANK, INVALID_HEX]) {
			const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
			const root = freshRoot();
			const applied = applyTenantPalette(
				{ primaryColor: VALID_PRIMARY, accent },
				root
			);
			expect(applied, `accent=${String(accent)}`).toBe(true);
			expect(root.style.getPropertyValue('--m3-primary')).toBe(
				tokens['--m3-primary']
			);
			warn.mockRestore();
		}
	});

	it('applies a valid primary when signal is empty, whitespace, absent or invalid-hex', () => {
		const { tokens } = computeOrisoPalette(
			{ primary: VALID_PRIMARY },
			'light'
		);
		for (const signal of [...BLANK, INVALID_HEX]) {
			const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
			const root = freshRoot();
			const applied = applyTenantPalette(
				{ primaryColor: VALID_PRIMARY, signal },
				root
			);
			expect(applied, `signal=${String(signal)}`).toBe(true);
			expect(root.style.getPropertyValue('--m3-primary')).toBe(
				tokens['--m3-primary']
			);
			warn.mockRestore();
		}
	});

	it('keeps a valid accent when signal is empty or invalid-hex', () => {
		const { tokens } = computeOrisoPalette(
			{ primary: VALID_PRIMARY, accent: VALID_ACCENT },
			'light'
		);
		for (const signal of ['', '   ', INVALID_HEX]) {
			const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
			const root = freshRoot();
			expect(
				applyTenantPalette(
					{
						primaryColor: VALID_PRIMARY,
						accent: VALID_ACCENT,
						signal
					},
					root
				)
			).toBe(true);
			expect(root.style.getPropertyValue('--m3-secondary')).toBe(
				tokens['--m3-secondary']
			);
			warn.mockRestore();
		}
	});

	it('keeps a valid signal when accent is empty or invalid-hex', () => {
		const { tokens } = computeOrisoPalette(
			{ primary: VALID_PRIMARY, signal: VALID_SIGNAL },
			'light'
		);
		for (const accent of ['', '   ', INVALID_HEX]) {
			const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
			const root = freshRoot();
			expect(
				applyTenantPalette(
					{
						primaryColor: VALID_PRIMARY,
						accent,
						signal: VALID_SIGNAL
					},
					root
				)
			).toBe(true);
			expect(root.style.getPropertyValue('--m3-error')).toBe(
				tokens['--m3-error']
			);
			warn.mockRestore();
		}
	});

	it('does not apply when primary is empty, whitespace, absent or invalid-hex', () => {
		for (const primaryColor of [...BLANK, INVALID_HEX]) {
			const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
			const root = freshRoot();
			expect(
				applyTenantPalette(
					{
						primaryColor,
						accent: VALID_ACCENT,
						signal: VALID_SIGNAL
					},
					root
				)
			).toBe(false);
			expect(root.style.length).toBe(0);
			warn.mockRestore();
		}
	});

	it('does not warn all-or-nothing when only accent and signal are empty strings', () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		const root = freshRoot();
		const applied = applyTenantPalette(
			{ primaryColor: VALID_PRIMARY, accent: '', signal: '' },
			root
		);
		expect(applied).toBe(true);
		expect(warn).not.toHaveBeenCalled();
	});
});

describe('palette injection at :root (Test #18, UAT-D)', () => {
	it('sets every engine token as a custom property', () => {
		const root = freshRoot();
		const applied = applyTenantPalette({ primaryColor: '#A5000A' }, root);
		expect(applied).toBe(true);
		const { tokens } = computeOrisoPalette({ primary: '#A5000A' }, 'light');
		for (const [name, value] of Object.entries(tokens)) {
			expect(root.style.getPropertyValue(name), name).toBe(value);
		}
	});

	// Test #19 — preview/live parity: both consumers call the same
	// engine, so the injected values must equal the engine output for
	// the same seeds (the Admin preview asserts the same in THB-04).
	it('matches the engine output exactly (preview parity)', () => {
		const root = freshRoot();
		applyTenantPalette(
			{ primaryColor: '#A5000A', accent: '#646d78', signal: '#b1005e' },
			root
		);
		const { tokens } = computeOrisoPalette(
			{ primary: '#A5000A', accent: '#646d78', signal: '#b1005e' },
			'light'
		);
		expect(root.style.getPropertyValue('--m3-secondary')).toBe(
			tokens['--m3-secondary']
		);
		expect(root.style.getPropertyValue('--m3-error')).toBe(
			tokens['--m3-error']
		);
		expect(root.style.getPropertyValue('--oriso-lottie-accent-color')).toBe(
			tokens['--m3-primary-fixed-dim']
		);
	});

	it('announces the applied palette for the MUI theme refresh', () => {
		const root = freshRoot();
		const listener = vi.fn();
		window.addEventListener(THEME_APPLIED_EVENT, listener);
		applyTenantPalette({ primaryColor: '#A5000A' }, root);
		window.removeEventListener(THEME_APPLIED_EVENT, listener);
		expect(listener).toHaveBeenCalledTimes(1);
	});
});

describe('fallbacks (Tests #20/#21, UAT-E)', () => {
	it('keeps the static behaviour without a stored seed', () => {
		const root = freshRoot();
		const applied = applyTenantPalette({}, root);
		expect(applied).toBe(false);
		expect(root.style.length).toBe(0);
	});

	it('falls back and logs on an invalid stored value, never crashes', () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		const root = freshRoot();
		const applied = applyTenantPalette({ primaryColor: 'not-a-hex' }, root);
		expect(applied).toBe(false);
		expect(root.style.length).toBe(0);
		expect(warn).toHaveBeenCalled();
	});

	it('does not announce a theme when nothing was applied', () => {
		const listener = vi.fn();
		window.addEventListener(THEME_APPLIED_EVENT, listener);
		applyTenantPalette({}, freshRoot());
		applyTenantPalette({ primaryColor: 'not-a-hex' }, freshRoot());
		window.removeEventListener(THEME_APPLIED_EVENT, listener);
		expect(listener).not.toHaveBeenCalled();
	});

	it('rejects a near-achromatic seed (tooPale guard, #143) and logs', () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		const listener = vi.fn();
		window.addEventListener(THEME_APPLIED_EVENT, listener);
		const root = freshRoot();
		const applied = applyTenantPalette({ primaryColor: '#000000' }, root);
		window.removeEventListener(THEME_APPLIED_EVENT, listener);
		expect(applied).toBe(false);
		expect(root.style.length).toBe(0);
		expect(listener).not.toHaveBeenCalled();
		expect(warn).toHaveBeenCalledWith(expect.stringContaining('too pale'));
	});

	it('still applies a chromatic dark seed (guard is about chroma, not tone)', () => {
		const root = freshRoot();
		const applied = applyTenantPalette({ primaryColor: '#4B0082' }, root);
		expect(applied).toBe(true);
		expect(root.style.length).toBeGreaterThan(0);
	});
});

describe('scheme-keyed variable map (Test #22, UAT-I)', () => {
	it('produces light, dark and inverted maps from the same seeds', () => {
		const schemes = computeOrisoSchemes({ primary: '#A5000A' });
		expect(Object.keys(schemes).sort()).toEqual([
			'dark',
			'inverted',
			'light'
		]);
		const lightKeys = Object.keys(schemes.light).sort();
		expect(Object.keys(schemes.dark).sort()).toEqual(lightKeys);
		expect(Object.keys(schemes.inverted).sort()).toEqual(lightKeys);
		expect(schemes.light['--m3-primary']).toBe('#a5000a');
		expect(schemes.dark['--m3-primary']).not.toBe(
			schemes.light['--m3-primary']
		);
	});

	it('only the light scheme is active; dark stays behind the flag', () => {
		expect(ACTIVE_SCHEMES).toEqual({
			light: true,
			dark: false,
			inverted: false
		});
	});
});

describe('URL preview mode (Theme Builder iframe, security-constrained)', () => {
	it('parses strictly validated hex seeds from the query string', async () => {
		const { readPreviewSeeds } = await import('./applyTenantTheme');
		expect(
			readPreviewSeeds(
				'?themePreviewPrimary=a5000a&themePreviewAccent=646d78&themePreviewSignal=b1005e'
			)
		).toEqual({
			primary: '#a5000a',
			accent: '#646d78',
			signal: '#b1005e'
		});
	});

	it('returns null without a primary preview seed', async () => {
		const { readPreviewSeeds } = await import('./applyTenantTheme');
		expect(readPreviewSeeds('')).toBeNull();
		expect(readPreviewSeeds('?themePreviewAccent=646d78')).toBeNull();
	});

	it('rejects anything that is not a bare 6-digit hex (no injection surface)', async () => {
		const { readPreviewSeeds } = await import('./applyTenantTheme');
		expect(readPreviewSeeds('?themePreviewPrimary=red')).toBeNull();
		expect(readPreviewSeeds('?themePreviewPrimary=%23a5000a')).toBeNull();
		expect(
			readPreviewSeeds(
				'?themePreviewPrimary=a5000a&themePreviewAccent=javascript:alert(1)'
			)
		).toEqual({ primary: '#a5000a', accent: undefined, signal: undefined });
	});

	it('applies preview seeds to the root (preview wins over tenant)', async () => {
		const { applyPreviewFromLocation } = await import('./applyTenantTheme');
		const root = document.createElement('div');
		const applied = applyPreviewFromLocation(
			'?themePreviewPrimary=a5000a',
			root
		);
		expect(applied).toBe(true);
		expect(root.style.getPropertyValue('--m3-primary')).toBe('#a5000a');
	});

	it('applies nothing for a normal URL', async () => {
		const { applyPreviewFromLocation } = await import('./applyTenantTheme');
		const root = document.createElement('div');
		expect(applyPreviewFromLocation('?foo=bar', root)).toBe(false);
		expect(root.style.length).toBe(0);
	});
});
