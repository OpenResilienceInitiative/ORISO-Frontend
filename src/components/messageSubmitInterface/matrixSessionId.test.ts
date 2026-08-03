import { describe, expect, it } from 'vitest';
import { hasMatrixSessionId, resolveMatrixSessionId } from './matrixSessionId';

describe('resolveMatrixSessionId', () => {
	it.each([
		['zero', '0', 0],
		['positive', '42', 42],
		['numeric input', 7, 7]
	])('preserves a valid %s session id', (_label, value, expected) => {
		expect(resolveMatrixSessionId(value)).toBe(expected);
	});

	it.each([undefined, null, '', 'not-a-number', -1, 1.5])(
		'rejects the invalid session id %s',
		(value) => {
			expect(resolveMatrixSessionId(value)).toBeUndefined();
		}
	);
});

describe('hasMatrixSessionId', () => {
	it('accepts zero as a defined Matrix session id', () => {
		expect(hasMatrixSessionId(0)).toBe(true);
	});

	it('rejects an undefined Matrix session id', () => {
		expect(hasMatrixSessionId(undefined)).toBe(false);
	});
});
