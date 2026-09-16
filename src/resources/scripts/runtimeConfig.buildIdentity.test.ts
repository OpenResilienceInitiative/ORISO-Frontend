// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getBuildCommit, getPlatformVersion } from './runtimeConfig';

afterEach(() => {
	vi.unstubAllEnvs();
	vi.unstubAllGlobals();
});

describe('bundle identity', () => {
	it('ignores runtime and Cypress spoofing while retaining the runtime release', () => {
		vi.stubEnv('REACT_APP_BUILD_COMMIT', 'a'.repeat(40));
		vi.stubGlobal('__ORISO_RUNTIME_CONFIG__', {
			REACT_APP_PLATFORM_VERSION: 'v2.0.6',
			REACT_APP_BUILD_COMMIT: 'b'.repeat(40),
			VITE_BUILD_COMMIT: 'c'.repeat(40)
		});
		vi.stubGlobal('Cypress', {
			env: () => ({ REACT_APP_BUILD_COMMIT: 'd'.repeat(40) })
		});
		expect(getPlatformVersion()).toBe('v2.0.6');
		expect(getBuildCommit()).toBe('a'.repeat(40));
	});

	it.each([
		undefined,
		'',
		'unknown',
		'a3445a9',
		'g'.repeat(40),
		'a'.repeat(39),
		'a'.repeat(41),
		` ${'a'.repeat(40)}`
	])('leaves malformed or absent commit unidentified: %s', (commit) => {
		vi.stubEnv('REACT_APP_BUILD_COMMIT', commit);
		vi.stubGlobal('__ORISO_RUNTIME_CONFIG__', {
			REACT_APP_BUILD_COMMIT: 'b'.repeat(40)
		});
		expect(getBuildCommit()).toBeUndefined();
	});
});
