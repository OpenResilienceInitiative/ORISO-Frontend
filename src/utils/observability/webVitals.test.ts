// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

// vi.mock factories are hoisted above imports, so referenced variables must
// be prefixed with "mock" (Vitest's hoisting convention) -- see
// https://vitest.dev/api/vi.html#vi-mock
const mockCreateHistogram = vi.fn();
const mockCreateObservableGauge = vi.fn();
const mockGetMeter = vi.fn(() => ({
	createHistogram: mockCreateHistogram,
	createObservableGauge: mockCreateObservableGauge
}));

vi.mock('@opentelemetry/api', () => ({
	metrics: { getMeter: mockGetMeter }
}));

const mockOnCLS = vi.fn();
const mockOnFCP = vi.fn();
const mockOnINP = vi.fn();
const mockOnLCP = vi.fn();
const mockOnTTFB = vi.fn();

vi.mock('web-vitals', () => ({
	onCLS: mockOnCLS,
	onFCP: mockOnFCP,
	onINP: mockOnINP,
	onLCP: mockOnLCP,
	onTTFB: mockOnTTFB
}));

describe('normalizedPagePath', () => {
	beforeEach(() => {
		window.history.pushState({}, '', '/');
	});

	it('strips the query string', async () => {
		const { normalizedPagePath } = await import('./webVitals');
		window.history.pushState({}, '', '/sessions?foo=bar&baz=1');

		expect(normalizedPagePath()).toBe('/sessions');
	});

	it('replaces numeric path segments with :id', async () => {
		const { normalizedPagePath } = await import('./webVitals');
		window.history.pushState({}, '', '/sessions/12345/details');

		expect(normalizedPagePath()).toBe('/sessions/:id/details');
	});

	it('replaces UUID-shaped path segments with :id', async () => {
		const { normalizedPagePath } = await import('./webVitals');
		window.history.pushState(
			{},
			'',
			'/sessions/9f1c9b3e-5a2d-4b7a-8c3f-1a2b3c4d5e6f/details'
		);

		expect(normalizedPagePath()).toBe('/sessions/:id/details');
	});

	it('replaces both numeric and UUID segments in the same path', async () => {
		const { normalizedPagePath } = await import('./webVitals');
		window.history.pushState(
			{},
			'',
			'/agencies/42/counsellors/9f1c9b3e-5a2d-4b7a-8c3f-1a2b3c4d5e6f?tab=info'
		);

		expect(normalizedPagePath()).toBe('/agencies/:id/counsellors/:id');
	});

	it('leaves an already low-cardinality path untouched', async () => {
		const { normalizedPagePath } = await import('./webVitals');
		window.history.pushState({}, '', '/registration/topic-selection');

		expect(normalizedPagePath()).toBe('/registration/topic-selection');
	});
});

describe('initWebVitals', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.resetModules();
		window.history.pushState({}, '', '/chat');
	});

	it('gets a meter named "web-vitals"', async () => {
		const { initWebVitals } = await import('./webVitals');

		initWebVitals();

		expect(mockGetMeter).toHaveBeenCalledWith('web-vitals');
	});

	it('creates histograms named exactly lcp, inp, ttfb, fcp', async () => {
		const { initWebVitals } = await import('./webVitals');

		initWebVitals();

		expect(mockCreateHistogram.mock.calls.map((call) => call[0])).toEqual([
			'lcp',
			'inp',
			'ttfb',
			'fcp'
		]);
	});

	it('creates an observable gauge named exactly cls', async () => {
		const { initWebVitals } = await import('./webVitals');

		initWebVitals();

		expect(mockCreateObservableGauge).toHaveBeenCalledWith('cls');
	});

	it('registers a callback with all five web-vitals reporters', async () => {
		const { initWebVitals } = await import('./webVitals');

		initWebVitals();

		expect(mockOnCLS).toHaveBeenCalledTimes(1);
		expect(mockOnINP).toHaveBeenCalledTimes(1);
		expect(mockOnLCP).toHaveBeenCalledTimes(1);
		expect(mockOnTTFB).toHaveBeenCalledTimes(1);
		expect(mockOnFCP).toHaveBeenCalledTimes(1);
	});

	it('records LCP on the lcp histogram with the normalized path attribute', async () => {
		const histogramRecord = vi.fn();
		mockCreateHistogram.mockReturnValue({ record: histogramRecord });
		const { initWebVitals } = await import('./webVitals');

		initWebVitals();

		const onLcpCallback = mockOnLCP.mock.calls[0][0];
		onLcpCallback({ name: 'LCP', value: 2500 });

		expect(histogramRecord).toHaveBeenCalledWith(2500, {
			'url.path_template': '/chat'
		});
	});

	it('observes CLS via the observable gauge callback, not a direct record', async () => {
		const addCallback = vi.fn();
		mockCreateObservableGauge.mockReturnValue({ addCallback });
		const { initWebVitals } = await import('./webVitals');

		initWebVitals();

		const onClsCallback = mockOnCLS.mock.calls[0][0];
		onClsCallback({ name: 'CLS', value: 0.05 });

		expect(addCallback).toHaveBeenCalledTimes(1);
		const observeCallback = addCallback.mock.calls[0][0];
		const observe = vi.fn();
		observeCallback({ observe });

		expect(observe).toHaveBeenCalledWith(0.05, {
			'url.path_template': '/chat'
		});
	});

	it('does not attach any per-user or user-agent identifier as an attribute', async () => {
		const histogramRecord = vi.fn();
		mockCreateHistogram.mockReturnValue({ record: histogramRecord });
		const { initWebVitals } = await import('./webVitals');

		initWebVitals();

		const onFcpCallback = mockOnFCP.mock.calls[0][0];
		onFcpCallback({ name: 'FCP', value: 1200 });

		const [, attributes] = histogramRecord.mock.calls[0];
		expect(Object.keys(attributes)).toEqual(['url.path_template']);
	});

	it('only wires the reporters once even if called repeatedly', async () => {
		const { initWebVitals } = await import('./webVitals');

		initWebVitals();
		initWebVitals();
		initWebVitals();

		expect(mockGetMeter).toHaveBeenCalledTimes(1);
		expect(mockOnLCP).toHaveBeenCalledTimes(1);
	});

	it('never throws when the meter is unavailable', async () => {
		mockGetMeter.mockImplementationOnce(() => {
			throw new Error('boom');
		});
		const { initWebVitals } = await import('./webVitals');

		expect(() => initWebVitals()).not.toThrow();
	});

	it('never throws when recording a metric fails', async () => {
		const { initWebVitals } = await import('./webVitals');
		mockCreateHistogram.mockReturnValue({
			record: () => {
				throw new Error('export failed');
			}
		});

		initWebVitals();
		const onLcpCallback = mockOnLCP.mock.calls[0][0];

		expect(() => onLcpCallback({ name: 'LCP', value: 2500 })).not.toThrow();
	});
});
