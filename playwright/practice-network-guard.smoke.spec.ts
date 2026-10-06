import { test, type Page } from '@playwright/test';
import {
	assertNoPracticeWrites,
	type RecordedNetworkRequest
} from '../src/practice/assertNoPracticeWrites';
import { PRACTICE_TOUR_IDS } from '../src/practice/practiceTourIds';

/**
 * T2 (FE#1622 spec section 7): the same claim as the unit test of the network
 * guard, proven end to end. Over a full run of each practice flow, the browser
 * must send no write except the two allowlisted ones: the tutorial-progress
 * PUT of the running tour and the identity-provider refresh grant. Because the
 * policy treats every non-GET request alike, this also covers the Matrix
 * writes the spec names (send, receipt, typing, account_data, join) and any
 * user-service write, without listing them.
 *
 * Needs an authenticated consultant storageState (same as product-tour):
 *
 *   ORISO_TOUR_STORAGE_STATE=/path/state.json \
 *   PLAYWRIGHT_BASE_URL=https://dev.oriso.org \
 *   ORISO_KEYCLOAK_TOKEN_URL=https://.../auth/realms/<realm>/protocol/openid-connect/token \
 *   npm run test:smoke -- practice-network-guard
 *
 * `ORISO_TUTORIAL_PROGRESS_URL` overrides the default
 * `<base>/service/users/tutorials/progress` when the user service has its own origin.
 *
 * The flow steps are TODO(S9): they need the flows (S5, S6) and the entry
 * (S7). Until then both tests report as "fixme" instead of passing without
 * having run a flow.
 */
const storageState = process.env.ORISO_TOUR_STORAGE_STATE;

const FLOWS = [
	{ name: 'F1 accept an enquiry', tourId: PRACTICE_TOUR_IDS[0] },
	{ name: 'F2 supervision', tourId: PRACTICE_TOUR_IDS[1] }
];

// Everything the browser sends, in order. `slice(mark)` = one practice run.
const recordTraffic = (page: Page) => {
	const requests: RecordedNetworkRequest[] = [];
	page.on('request', (request) => {
		requests.push({
			method: request.method(),
			url: request.url(),
			postData: request.postData()
		});
	});
	return requests;
};

const policyConfig = (tourId: string) => {
	const base =
		process.env.ORISO_APP_BASE_URL || process.env.PLAYWRIGHT_BASE_URL;
	const tokenRefreshUrl = process.env.ORISO_KEYCLOAK_TOKEN_URL;
	if (!tokenRefreshUrl) {
		throw new Error(
			'set ORISO_KEYCLOAK_TOKEN_URL (identity-provider token URL)'
		);
	}
	return {
		allowedTourIds: [tourId],
		tutorialProgressUrl:
			process.env.ORISO_TUTORIAL_PROGRESS_URL ??
			new URL('/service/users/tutorials/progress', base).href,
		tokenRefreshUrl
	};
};

test.describe('practice network guard (T2)', () => {
	test.skip(
		!storageState,
		'set ORISO_TOUR_STORAGE_STATE to an authenticated consultant storage state'
	);

	test.use({ storageState });

	for (const flow of FLOWS) {
		test(`${flow.name}: no write leaves the page except the allowlist`, async ({
			page
		}) => {
			test.fixme(
				true,
				'TODO(S9): drive the flow once S5/S6 (flows) and S7 (entry) exist'
			);
			test.setTimeout(240_000);

			const traffic = recordTraffic(page);

			// Practice is off by default; switch the release flag on for this run only.
			// Shape per AppConfigProvider.transformReleaseToggles: a map of strings.
			await page.route('**/service/settings', async (route) => {
				const response = await route.fetch();
				const body = await response.json();
				if (body.enableWalkthrough) {
					body.enableWalkthrough.value = true;
				}
				body.releaseToggles = {
					...(body.releaseToggles ?? {}),
					enablePracticeArea: 'true'
				};
				await route.fulfill({ response, json: body });
			});

			await page.goto('/profile/hilfe/rundgaenge', {
				waitUntil: 'domcontentloaded'
			});

			// The run window starts at the click on the practice card: what the
			// app sends before that is ordinary real-mode traffic.
			const runStart = traffic.length;
			// TODO(S9): start the practice card for `flow` and walk every step of
			// the flow (spec 3.3 for F1, 3.4 for F2). For F1 run once with and
			// once without the Team-Besprechung variant.
			// TODO(S9): finish the flow, then leave practice with "End practice".
			const runEnd = traffic.length;

			assertNoPracticeWrites(
				traffic.slice(runStart, runEnd),
				policyConfig(flow.tourId)
			);
			// TODO(S9): assert that the completion PUT for flow.tourId was sent
			// (the guard must let the one allowed write through, not just block).
		});
	}
});
