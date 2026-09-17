import { metrics, type Counter } from '@opentelemetry/api';
import type {
	LoginFailureOutcome,
	LoginFailureTransport
} from '../../components/login/loginErrorResolution';

/**
 * Failed sign-in attempts as one OpenTelemetry counter, exported to our
 * self-hosted SigNoz collector via the MeterProvider set up in
 * `meterProvider.ts` (same contract as `utdTracker.ts` and `webVitals.ts`).
 *
 * Why this exists: in September 2026 the Dev realm lost its 2FA direct-grant
 * flow and every counsellor login failed for days without anybody noticing,
 * because the login screen showed nothing and nothing was measured. With this
 * counter a spike of `outcome=credentials` or `outcome=unavailable` is visible
 * in SigNoz within one export interval.
 *
 * The meter name ('login-tracker') and the counter name ('login_failure') are
 * a dashboard contract: the SigNoz panel queries them by string.
 *
 * Deliberately NOT included, ever: username, e-mail, tenant, IP, user agent,
 * or anything else that could identify who failed to sign in. The three
 * attributes describe the health of the login path, not a person (ADR-011).
 */
export interface LoginFailureRecord {
	/** What went wrong, in the resolution's vocabulary. */
	outcome: LoginFailureOutcome;
	/** How the failure reached the browser. */
	transport: LoginFailureTransport;
	/** Whether the attempt already carried a one-time code. */
	stage: 'password' | 'otp';
}

let counter: Counter | undefined;

/**
 * Lazily resolved so the meter is created after `initMeterProvider()` ran.
 * A meter obtained at import time would snapshot the no-op provider forever
 * (see the note in `meterProvider.ts`).
 */
const getCounter = (): Counter => {
	if (!counter) {
		counter = metrics
			.getMeter('login-tracker')
			.createCounter('login_failure', {
				description:
					'Failed sign-in attempts in the ORISO frontend, by outcome, transport and stage'
			});
	}
	return counter;
};

/** Best-effort: telemetry must never break the login screen. */
export const recordLoginFailure = (record: LoginFailureRecord): void => {
	try {
		getCounter().add(1, {
			outcome: record.outcome,
			transport: record.transport,
			stage: record.stage
		});
	} catch {
		/* telemetry is best-effort */
	}
};

/** Test seam. */
export const resetLoginFailureTrackerForTests = (): void => {
	counter = undefined;
};
