import { webcrypto } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	DEFAULT_DISPLAY,
	displayStorageKey,
	getNextTextSize,
	parseDisplayPreferences
} from './preferences';

afterEach(() => vi.unstubAllGlobals());

describe('personal display values', () => {
	it('applies defaults to missing or damaged storage independently per field', () => {
		expect(parseDisplayPreferences(null)).toEqual(DEFAULT_DISPLAY);
		expect(parseDisplayPreferences('invalid json')).toEqual(
			DEFAULT_DISPLAY
		);
		expect(
			parseDisplayPreferences('{"scheme":"reserved","textSize":150}')
		).toEqual({
			scheme: 'system',
			textSize: 150,
			contrast: 'standard'
		});
		expect(
			parseDisplayPreferences('{"scheme":"dark","textSize":300}')
		).toEqual({
			scheme: 'dark',
			textSize: 100,
			contrast: 'standard'
		});
	});

	it('keeps known contrast values and uses Standard for older preferences', () => {
		expect(parseDisplayPreferences('{"contrast":"high"}').contrast).toBe(
			'high'
		);
		expect(parseDisplayPreferences('{"contrast":"medium"}').contrast).toBe(
			'medium'
		);
		expect(
			parseDisplayPreferences('{"contrast":"unrecognized"}').contrast
		).toBe('standard');
		expect(
			parseDisplayPreferences('{"scheme":"dark","textSize":150}')
		).toEqual({
			scheme: 'dark',
			textSize: 150,
			contrast: 'standard'
		});
	});

	it('steps in both directions without exceeding the bounds', () => {
		expect(getNextTextSize(100, -1)).toBe(90);
		expect(getNextTextSize(100, 1)).toBe(125);
		expect(getNextTextSize(90, -1)).toBe(90);
		expect(getNextTextSize(200, 1)).toBe(200);
	});

	it('uses stable, separate browser keys without storing a raw account identifier', async () => {
		vi.stubGlobal('crypto', webcrypto);
		const a = await displayStorageKey('["synthetic-account-a", 1]');
		const b = await displayStorageKey('["synthetic-account-b", 1]');
		expect(a).toMatch(/^oriso\.personal-display\.v1:[\da-f]{64}$/);
		expect(a).not.toBe(b);
		expect(a).toBe(await displayStorageKey('["synthetic-account-a", 1]'));
		expect(a).not.toBe(
			await displayStorageKey('["synthetic-account-a", 2]')
		);
	});
});
