// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * FE-H05: the mandatory imprint/privacy disclosure must never resolve to a
 * third-party provider. Falling back to Caritas pages is a wrong mandatory
 * provider disclosure under KDG/GDPR, not a cosmetic default.
 */
const loadRuntimeConfig = async (
	config: Record<string, string | undefined>
) => {
	(window as any).__ORISO_RUNTIME_CONFIG__ = config;
	vi.resetModules();
	return import('./runtimeConfig');
};

describe('legal URL resolution', () => {
	beforeEach(() => {
		delete (window as any).__ORISO_RUNTIME_CONFIG__;
	});

	it('falls back to the deployment origin, never to a third party', async () => {
		const { getLegalImprintUrl, getLegalPrivacyUrl } =
			await loadRuntimeConfig({});

		expect(getLegalImprintUrl()).toBe(
			`${window.location.origin}/impressum`
		);
		expect(getLegalPrivacyUrl()).toBe(
			`${window.location.origin}/datenschutz`
		);
	});

	it('honours explicitly configured legal URLs', async () => {
		const { getLegalImprintUrl, getLegalPrivacyUrl } =
			await loadRuntimeConfig({
				REACT_APP_LEGAL_IMPRINT_URL: 'https://example.test/impressum',
				REACT_APP_LEGAL_PRIVACY_URL: 'https://example.test/datenschutz'
			});

		expect(getLegalImprintUrl()).toBe('https://example.test/impressum');
		expect(getLegalPrivacyUrl()).toBe('https://example.test/datenschutz');
	});

	it('never resolves a caritas domain, whatever the environment omits', async () => {
		const { getLegalImprintUrl, getLegalPrivacyUrl } =
			await loadRuntimeConfig({
				REACT_APP_ORGANIZATION_HOME_URL: '',
				REACT_APP_LEGAL_IMPRINT_URL: '',
				REACT_APP_LEGAL_PRIVACY_URL: ''
			});

		expect(getLegalImprintUrl()).not.toMatch(/caritas/i);
		expect(getLegalPrivacyUrl()).not.toMatch(/caritas/i);
	});
});
