import {
	MeterProvider,
	PeriodicExportingMetricReader
} from '@opentelemetry/sdk-metrics';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { metrics } from '@opentelemetry/api';

/**
 * Browser-side OpenTelemetry MeterProvider for Real User Monitoring
 * (OBS-P8, ORISO-Helm#62). Exports metrics -- currently Core Web Vitals,
 * see `webVitals.ts` -- to our self-hosted SigNoz collector.
 *
 * `service.name` and the exporter URL/interval intentionally match the
 * SigNoz "web vitals with metrics" contract exactly: the SigNoz dashboard
 * we're importing queries these names, so don't rename them.
 *
 * Deliberately NOT included (see PR description): any per-user identifier
 * (e.g. `user.id` from localStorage) or browser/user-agent attribute that
 * SigNoz's docs show as an optional variant. This app treats SigNoz as
 * developer/ops tooling only, never per-user tracking (ADR-011).
 */
const SIGNOZ_METRICS_URL = 'https://signoz.oriso-dev.site/v1/metrics';
const EXPORT_INTERVAL_MILLIS = 10000;

export const OBSERVABILITY_RESOURCE_ATTRIBUTES = {
	'service.name': 'frontend'
} as const;

let meterProvider: MeterProvider | undefined;

/**
 * Sets up the global MeterProvider once, as early as possible during app
 * startup and before any module that calls `metrics.getMeter(...)` is
 * initialized (the OTel API snapshots whatever MeterProvider is globally
 * registered at call time -- a meter obtained before this runs stays a
 * no-op meter forever, even after this later registers a real provider).
 *
 * Best-effort, must never throw or block rendering: the underlying OTel SDK
 * already swallows export failures internally (its default diag logger is
 * a no-op, so a failed OTLP export never surfaces as a console error or an
 * unhandled rejection), but the synchronous setup below is still guarded in
 * case of misconfiguration -- same "telemetry must be best-effort"
 * principle as OBS-P3's `apiPostError.ts`.
 */
export const initMeterProvider = (): void => {
	if (meterProvider) {
		return;
	}

	try {
		const resource = resourceFromAttributes(
			OBSERVABILITY_RESOURCE_ATTRIBUTES
		);

		const metricReader = new PeriodicExportingMetricReader({
			exporter: new OTLPMetricExporter({ url: SIGNOZ_METRICS_URL }),
			exportIntervalMillis: EXPORT_INTERVAL_MILLIS
		});

		meterProvider = new MeterProvider({
			resource,
			readers: [metricReader]
		});

		metrics.setGlobalMeterProvider(meterProvider);
	} catch (e) {
		// Swallow setup failures -- this is telemetry, not a critical path,
		// and must never surface as a new error or block app startup.
	}
};
