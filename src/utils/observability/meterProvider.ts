import {
	MeterProvider,
	PeriodicExportingMetricReader
} from '@opentelemetry/sdk-metrics';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { metrics } from '@opentelemetry/api';
import { getObservabilityConfig } from '../../resources/scripts/runtimeConfig';

/**
 * Browser-side OpenTelemetry MeterProvider for Real User Monitoring
 * (OBS-P8, ORISO-Helm#62). Exports metrics -- currently Core Web Vitals,
 * see `webVitals.ts` -- to our self-hosted SigNoz collector.
 *
 * `service.name` intentionally matches the SigNoz "web vitals with metrics"
 * contract. The exporter endpoint and interval come from container runtime
 * configuration so one image can safely run in every environment.
 *
 * Deliberately NOT included (see PR description): any per-user identifier
 * (e.g. `user.id` from localStorage) or browser/user-agent attribute that
 * SigNoz's docs show as an optional variant. This app treats SigNoz as
 * developer/ops tooling only, never per-user tracking (ADR-011).
 */
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

	const observability = getObservabilityConfig();
	if (!observability.enabled || !observability.metricsUrl) {
		return;
	}

	try {
		const resource = resourceFromAttributes(
			OBSERVABILITY_RESOURCE_ATTRIBUTES
		);

		const metricReader = new PeriodicExportingMetricReader({
			exporter: new OTLPMetricExporter({ url: observability.metricsUrl }),
			exportIntervalMillis: observability.exportIntervalMillis
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
