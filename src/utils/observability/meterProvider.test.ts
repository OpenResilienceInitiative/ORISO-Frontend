import { beforeEach, describe, expect, it, vi } from 'vitest';

// vi.mock factories are hoisted above imports, so referenced variables must
// be prefixed with "mock" (Vitest's hoisting convention) -- see
// https://vitest.dev/api/vi.html#vi-mock
const mockSetGlobalMeterProvider = vi.fn();
const mockResourceFromAttributes = vi.fn((attributes: unknown) => ({
	attributes
}));
const mockOTLPMetricExporter = vi.fn();
const mockPeriodicExportingMetricReader = vi.fn();
const mockMeterProvider = vi.fn();

vi.mock('@opentelemetry/api', () => ({
	metrics: { setGlobalMeterProvider: mockSetGlobalMeterProvider }
}));

vi.mock('@opentelemetry/resources', () => ({
	resourceFromAttributes: mockResourceFromAttributes
}));

vi.mock('@opentelemetry/exporter-metrics-otlp-http', () => ({
	OTLPMetricExporter: vi.fn(function (this: unknown, options: unknown) {
		mockOTLPMetricExporter(options);
	})
}));

vi.mock('@opentelemetry/sdk-metrics', () => ({
	PeriodicExportingMetricReader: vi.fn(function (
		this: unknown,
		options: unknown
	) {
		mockPeriodicExportingMetricReader(options);
	}),
	MeterProvider: vi.fn(function (this: unknown, options: unknown) {
		mockMeterProvider(options);
	})
}));

describe('initMeterProvider', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.resetModules();
	});

	it('builds the resource with service.name "frontend"', async () => {
		const { initMeterProvider } = await import('./meterProvider');

		initMeterProvider();

		expect(mockResourceFromAttributes).toHaveBeenCalledWith({
			'service.name': 'frontend'
		});
	});

	it('configures the OTLP exporter with the SigNoz metrics endpoint', async () => {
		const { initMeterProvider } = await import('./meterProvider');

		initMeterProvider();

		expect(mockOTLPMetricExporter).toHaveBeenCalledWith({
			url: 'https://signoz.oriso-dev.site/v1/metrics'
		});
	});

	it('exports every 10 seconds', async () => {
		const { initMeterProvider } = await import('./meterProvider');

		initMeterProvider();

		expect(mockPeriodicExportingMetricReader).toHaveBeenCalledWith(
			expect.objectContaining({ exportIntervalMillis: 10000 })
		);
	});

	it('registers the constructed MeterProvider as the global meter provider', async () => {
		const { initMeterProvider } = await import('./meterProvider');

		initMeterProvider();

		expect(mockMeterProvider).toHaveBeenCalledWith(
			expect.objectContaining({
				resource: { attributes: { 'service.name': 'frontend' } }
			})
		);
		expect(mockSetGlobalMeterProvider).toHaveBeenCalledTimes(1);
	});

	it('only builds the provider once even if called repeatedly', async () => {
		const { initMeterProvider } = await import('./meterProvider');

		initMeterProvider();
		initMeterProvider();
		initMeterProvider();

		expect(mockMeterProvider).toHaveBeenCalledTimes(1);
		expect(mockSetGlobalMeterProvider).toHaveBeenCalledTimes(1);
	});

	it('never throws when the SDK setup fails', async () => {
		mockMeterProvider.mockImplementationOnce(() => {
			throw new Error('boom');
		});
		const { initMeterProvider } = await import('./meterProvider');

		expect(() => initMeterProvider()).not.toThrow();
	});
});
