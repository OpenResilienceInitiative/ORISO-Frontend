// @vitest-environment jsdom
/**
 * Theme preview mode (decided 2026-06-11): the admin panel embeds the
 * app's public sign-in screen in a sandboxed iframe and passes draft
 * seeds as strictly-validated query params. This is the receiving end:
 * bare 6-digit hex only, colours only — nothing else changes.
 *
 * Traces: UAT-C.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { computeOrisoPalette } from './orisoScheme';
import { applyPreviewPalette, readPreviewSeeds } from './applyTenantTheme';

afterEach(() => {
	vi.restoreAllMocks();
});

describe('readPreviewSeeds (strict validation)', () => {
	it('reads bare-hex seeds from the query string', () => {
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

	it('normalises uppercase hex and omits absent optional seeds', () => {
		expect(readPreviewSeeds('?themePreviewPrimary=A5000A')).toEqual({
			primary: '#a5000a',
			accent: undefined,
			signal: undefined
		});
	});

	it('returns null without a primary param', () => {
		expect(readPreviewSeeds('')).toBeNull();
		expect(readPreviewSeeds('?themePreviewAccent=646d78')).toBeNull();
	});

	it('rejects anything that is not bare 6-digit hex', () => {
		expect(readPreviewSeeds('?themePreviewPrimary=red')).toBeNull();
		expect(readPreviewSeeds('?themePreviewPrimary=%23a5000a')).toBeNull();
		expect(readPreviewSeeds('?themePreviewPrimary=a5000')).toBeNull();
		expect(
			readPreviewSeeds('?themePreviewPrimary=a5000a;url(x)')
		).toBeNull();
	});

	it('drops invalid optional seeds but keeps the valid primary', () => {
		expect(
			readPreviewSeeds(
				'?themePreviewPrimary=a5000a&themePreviewAccent=nope'
			)
		).toEqual({ primary: '#a5000a', accent: undefined, signal: undefined });
	});
});

describe('applyPreviewPalette', () => {
	it('applies the preview seeds through the engine', () => {
		const root = document.createElement('div');
		const applied = applyPreviewPalette('?themePreviewPrimary=a5000a', root);
		expect(applied).toBe(true);
		const { tokens } = computeOrisoPalette({ primary: '#a5000a' }, 'light');
		expect(root.style.getPropertyValue('--m3-primary')).toBe(
			tokens['--m3-primary']
		);
		expect(root.style.getPropertyValue('--m3-surface')).toBe(
			tokens['--m3-surface']
		);
	});

	it('does nothing without preview params (normal tenant flow)', () => {
		const root = document.createElement('div');
		expect(applyPreviewPalette('', root)).toBe(false);
		expect(root.style.length).toBe(0);
	});
});
