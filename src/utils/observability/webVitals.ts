import { metrics } from '@opentelemetry/api';
import { onCLS, onFCP, onINP, onLCP, onTTFB, type Metric } from 'web-vitals';

/**
 * Core Web Vitals capture (OBS-P8, ORISO-Helm#62), recorded as OpenTelemetry
 * metrics and exported to SigNoz via the MeterProvider set up in
 * `meterProvider.ts`.
 *
 * The meter name ('web-vitals') and the five instrument names ('lcp', 'cls',
 * 'inp', 'ttfb', 'fcp') intentionally match the SigNoz "web vitals with
 * metrics" contract exactly -- the imported SigNoz dashboard queries these
 * names, and a typo here would silently break it with no error anywhere.
 *
 * Deliberately NOT included (see PR description): any per-user identifier
 * (e.g. `user.id`) or browser/user-agent attribute. `url.path_template` --
 * already scrubbed of ids by `normalizedPagePath` -- is the only attribute
 * attached. This app treats SigNoz as developer/ops tooling only, never
 * per-user tracking (ADR-011).
 */

/**
 * Normalizes the current pathname into a low-cardinality route template for
 * metric attributes: strips the query string, then replaces numeric AND
 * UUID-shaped path segments with `:id`. SigNoz's own sample regex only
 * handles numeric segments -- this app's routes carry UUIDs (session/user/
 * agency ids), so the UUID pattern is added on top.
 */
export const normalizedPagePath = (): string =>
	window.location.pathname
		.replace(/\?.*$/, '')
		.replace(/\/[0-9a-fA-F-]{8,}/g, '/:id')
		.replace(/\/\d+/g, '/:id');

let initialized = false;

/**
 * Wires the `web-vitals` reporting callbacks to OpenTelemetry histograms
 * (and an observable gauge for CLS). Only needs to run once per page load --
 * call this once at app startup, alongside `initMeterProvider`, not per
 * component.
 *
 * Best-effort, must never throw or block rendering -- same principle as
 * OBS-P3's `apiPostError.ts`. `web-vitals` and the OTel SDK are already
 * fire-and-forget by design; the try/catch below only guards against a
 * misconfigured meter (e.g. `initMeterProvider` not having run yet).
 */
export const initWebVitals = (): void => {
	if (initialized) {
		return;
	}
	initialized = true;

	try {
		const meter = metrics.getMeter('web-vitals');
		const lcp = meter.createHistogram('lcp');
		const cls = meter.createObservableGauge('cls');
		const inp = meter.createHistogram('inp');
		const ttfb = meter.createHistogram('ttfb');
		const fcp = meter.createHistogram('fcp');

		const sendToAnalytics = (metric: Metric): void => {
			try {
				const attributes = {
					'url.path_template': normalizedPagePath()
				};
				switch (metric.name) {
					case 'LCP':
						lcp.record(metric.value, attributes);
						break;
					case 'CLS':
						cls.addCallback((r) =>
							r.observe(metric.value, attributes)
						);
						break;
					case 'INP':
						inp.record(metric.value, attributes);
						break;
					case 'TTFB':
						ttfb.record(metric.value, attributes);
						break;
					case 'FCP':
						fcp.record(metric.value, attributes);
						break;
				}
			} catch (e) {
				// Recording a Web Vital must never throw into web-vitals'
				// own reporting loop.
			}
		};

		onCLS(sendToAnalytics);
		onINP(sendToAnalytics);
		onLCP(sendToAnalytics);
		onTTFB(sendToAnalytics);
		onFCP(sendToAnalytics);
	} catch (e) {
		// Swallow wiring failures -- this is telemetry, not a critical
		// path, and must never surface as a new error or block app startup.
	}
};
