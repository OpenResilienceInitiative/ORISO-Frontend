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
		const applied = applyTenantPalette(
			{ primaryColor: 'not-a-hex' },
			root
		);
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
