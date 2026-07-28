// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

const loadConfig = async (config: Record<string, string | undefined>) => {
	(window as any).__ORISO_RUNTIME_CONFIG__ = config;
	vi.resetModules();
	return import('./runtimeConfig');
};

describe('observability runtime config', () => {
	beforeEach(() => {
		delete (window as any).__ORISO_RUNTIME_CONFIG__;
	});

	it('is disabled by default and does not infer an endpoint', async () => {
		const { getObservabilityConfig } = await loadConfig({});

		expect(getObservabilityConfig()).toEqual({
			enabled: false,
			metricsUrl: '',
			exportIntervalMillis: 60000
		});
	});

	it('accepts explicit runtime values', async () => {
		const { getObservabilityConfig } = await loadConfig({
			REACT_APP_OBSERVABILITY_ENABLED: 'TRUE',
			REACT_APP_OTEL_METRICS_URL:
				'https://collector.example.test/v1/metrics',
			REACT_APP_OTEL_EXPORT_INTERVAL_MS: '45000'
		});

		expect(getObservabilityConfig()).toEqual({
			enabled: true,
			metricsUrl: 'https://collector.example.test/v1/metrics',
			exportIntervalMillis: 45000
		});
	});

	it('rejects non-http endpoints and too-frequent intervals', async () => {
		const { getObservabilityConfig } = await loadConfig({
			REACT_APP_OBSERVABILITY_ENABLED: 'true',
			REACT_APP_OTEL_METRICS_URL: 'file:///tmp/metrics',
			REACT_APP_OTEL_EXPORT_INTERVAL_MS: '1000'
		});

		expect(getObservabilityConfig()).toEqual({
			enabled: true,
			metricsUrl: '',
			exportIntervalMillis: 60000
		});
	});
});
