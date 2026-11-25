import { expect, test, type Page } from '@playwright/test';
import {
	PRACTICE_GROUP_CIRCLE_TOUR_ID,
	PRACTICE_TOUR_IDS
} from '../src/practice/practiceTourIds';
import type { RequestPolicyConfig } from '../src/practice/requestPolicy';
import {
	assertRunLeftNothing,
	banner,
	CALL_PATH,
	TTS_HOST,
	diffStorage,
	driveAcceptFlow,
	driveCircleFlow,
	driveSupervisionFlow,
	endFromBanner,
	exactText,
	expectNoLiveMedia,
	expectRealEnquiriesFree,
	finishButton,
	instrumentCallPath,
	openThePracticeEnquiry,
	practiceCard,
	progressWriteStatuses,
	readCallProbe,
	recordSockets,
	recordTraffic,
	snapshotStorage,
	startButton,
	tourCard,
	tourStartButton,
	type FlowRun
} from './practice-proof';

/**
 * T2 (FE#1622 spec section 7): the claims of the practice area, proven end to
 * end in a real browser against a deployed frontend. A human runs it; it needs
 * a build of this branch on Dev and cannot run in CI.
 *
 * Needs an authenticated consultant storage state (same as product-tour), a
 * test account, and the token URL of the identity provider:
 *
 *   ORISO_TOUR_STORAGE_STATE=/path/state.json \
 *   PLAYWRIGHT_BASE_URL=https://dev.oriso.org \
 *   ORISO_KEYCLOAK_TOKEN_URL=https://<keycloak>/auth/realms/<realm>/protocol/openid-connect/token \
 *   npx playwright test practice-network-guard --project=chromium
 *
 * Optional: `ORISO_TUTORIAL_PROGRESS_URL` replaces the default
 * `<base>/service/users/tutorials/progress` when the user service has its own
 * origin; `ORISO_APP_BASE_URL` replaces `PLAYWRIGHT_BASE_URL` for that default.
 * The run marks the account's practice tour as completed (the one allowed write).
 *
 * `/service/settings` is rewritten for this run only: the platform master
 * switch `enableWalkthrough` and the release flag `enablePracticeArea` are
 * forced on. Everything else, the Help page, the tour, the fake backend and
 * the guard, is the real app.
 *
 * Per flow, from the click on the practice card to the end of the practice:
 *  - the browser sent no write except the tutorial-progress PUT of the running
 *    tour (and the token refresh), and sent a PUT with status "completed";
 *  - no request URL or body names a practice id (`-1`, `practice-...`,
 *    `practice.invalid`), carries what was typed, or is a WebSocket publish;
 *  - localStorage, sessionStorage and the IndexedDB database names are the
 *    same as before the start, except the acknowledgement time of the allowed
 *    live-chat heartbeat (a bodyless POST, FE#2545); a PUT to the
 *    availability stays a forbidden write;
 *  - after the practice, the real Anfragen list holds no practice id or name.
 * Flow F1 runs with the Team-Besprechung steps when the tenant has them
 * switched on, and without otherwise: the variant is reported as an annotation.
 * Flow F2 is skipped, with a message, when the tenant has no supervision.
 *
 * The Gesprächskreis flow (FE#2545) starts from its topic tour card and runs
 * with Chromium's fake camera and microphone. On top of the claims above it
 * proves the practice call stays local: no `.element-call-iframe`, no LiveKit
 * or Element Call socket, no `/service/matrix/calls` or Matrix RTC request,
 * no notification, getUserMedia called once (by the stage), and after leaving
 * every track has ended and every AudioContext is closed. It is skipped when
 * the tenant offers no circles.
 */
const storageState = process.env.ORISO_TOUR_STORAGE_STATE;

/*
 * Chromium's fake camera and microphone, granted without a prompt, for the
 * Gesprächskreis call. Top level because Playwright refuses launch options
 * inside a describe (they force a new worker); F1 and F2 ask for no media,
 * so the flags change nothing for them.
 */
test.use({
	launchOptions: {
		args: [
			'--use-fake-ui-for-media-stream',
			'--use-fake-device-for-media-stream'
		]
	}
});

const [ACCEPT_TOUR_ID, SUPERVISION_TOUR_ID] = PRACTICE_TOUR_IDS;

const policyConfig = (tourId: string): RequestPolicyConfig => {
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
		tokenRefreshUrl,
		// The app allows this one write during practice (FE#2545): a counsellor
		// who is really available keeps her lease. Same origin as the progress URL.
		liveChatHeartbeatUrl: new URL(
			'/service/conversations/consultants/availability/heartbeat',
			process.env.ORISO_TUTORIAL_PROGRESS_URL ?? base
		).href
	};
};

/** Practice is off by default: force the master switch and the release flag for this page. */
const forceSettings = (page: Page) =>
	page.route('**/service/settings', async (route) => {
		const response = await route.fetch();
		const body = await response.json();
		body.enableWalkthrough = { ...body.enableWalkthrough, value: true };
		// `releaseToggles` is a map of strings (AppConfigProvider.transformReleaseToggles).
		body.releaseToggles = {
			...body.releaseToggles,
			enablePracticeArea: 'true'
		};
		await route.fulfill({ response, json: body });
	});

/** Profile -> Help -> "Meine Rundgänge": the tour cards and the practice cards. */
const openMyTours = async (page: Page) => {
	await page.goto('/profile/allgemeines', { waitUntil: 'domcontentloaded' });
	await page
		.getByRole('tab', { name: exactText('profile.routes.help.title') })
		.click({ timeout: 60_000 });
	// Below the desktop breakpoint the Help page is a menu first.
	const toursLink = page.getByRole('link', {
		name: exactText('profile.routes.help.tours')
	});
	if (await toursLink.isVisible().catch(() => false)) {
		await toursLink.click();
	}
	await expect(
		page.getByText(exactText('walkthrough.overview.title')).first()
	).toBeVisible({ timeout: 30_000 });
	await expect(
		page.getByRole('heading', { name: exactText('practice.cards.title') })
	).toBeVisible({ timeout: 30_000 });
};

interface Flow {
	name: string;
	tourId: string;
	titleKey: string;
	drive: (page: Page, run: string) => Promise<FlowRun>;
	/** Offered only where the Träger switched the feature on. */
	optional?: boolean;
	/** A topic tour: started from its "Meine Rundgänge" card, not a practice card. */
	topicTour?: boolean;
}

const ACCEPT_FLOW: Flow = {
	name: 'F1 accept an enquiry',
	tourId: ACCEPT_TOUR_ID,
	titleKey: 'tour.practiceAccept.title',
	drive: driveAcceptFlow
};

const SUPERVISION_FLOW: Flow = {
	name: 'F2 add a supervisor',
	tourId: SUPERVISION_TOUR_ID,
	titleKey: 'tour.practiceSupervision.title',
	drive: driveSupervisionFlow,
	optional: true
};

const CIRCLE_FLOW: Flow = {
	name: 'Gesprächskreis with the practice call',
	tourId: PRACTICE_GROUP_CIRCLE_TOUR_ID,
	titleKey: 'tour.groupCircle.title',
	drive: driveCircleFlow,
	optional: true,
	topicTour: true
};

/** The page is where practice started: the Help page with its practice cards. */
const expectBackOnHelp = (page: Page) =>
	expect(
		page.getByRole('heading', { name: exactText('practice.cards.title') })
	).toBeVisible({ timeout: 30_000 });

/** The guard comes off a moment after the banner goes; real traffic follows. */
const settle = (page: Page) => page.waitForTimeout(2000);

interface Walked extends FlowRun {
	/** The flow ran to its last step; false = the practice was ended half way. */
	finished: boolean;
}

/**
 * One practice run: start from the card, let `walk` act, then check the
 * traffic of the run, the storage and the real list.
 */
const provePracticeRun = async (
	page: Page,
	flow: Flow,
	walk: (run: string) => Promise<Walked>
) => {
	const config = policyConfig(flow.tourId);
	const traffic = recordTraffic(page);
	await forceSettings(page);
	await openMyTours(page);

	// The accept card is always offered: once it shows, the cards have loaded.
	await expect(practiceCard(page, ACCEPT_FLOW.titleKey)).toBeVisible({
		timeout: 30_000
	});
	const card = flow.topicTour
		? tourCard(page, flow.titleKey)
		: practiceCard(page, flow.titleKey);
	if (flow.optional) {
		test.skip(
			(await card.count()) === 0,
			`The "${flow.name}" card is not offered: the tenant has switched the feature off.`
		);
	}

	const run = Math.random().toString(36).slice(2, 8);
	const storageBefore = await snapshotStorage(page);

	// The run window starts at the click on the card: what the app sent before
	// is ordinary real-mode traffic.
	const from = traffic.mark();
	await (flow.topicTour ? tourStartButton(card) : startButton(card)).click();
	await expect(banner(page)).toBeVisible({ timeout: 30_000 });
	const walked = await walk(run);
	// The banner goes when the practice starts to close, while the guard is
	// still on: this is the last moment that belongs to the run.
	await expect(banner(page)).toBeHidden({ timeout: 30_000 });
	const to = traffic.mark();
	if (walked.withTeam !== undefined) {
		test.info().annotations.push({
			type: 'variant',
			description: walked.withTeam
				? 'with the Team-Besprechung steps (8 steps)'
				: 'without the Team-Besprechung steps (6 steps)'
		});
	}

	const ran = traffic.between(from, to);
	assertRunLeftNothing(ran, config, walked.typed);
	const statuses = progressWriteStatuses(ran.requests, config);
	if (walked.finished) {
		// The one allowed write must get through, not only everything else be blocked.
		expect(statuses, 'the completion write').toContain('completed');
	} else {
		// A practice that was ended is not a finished one, and not a skipped one.
		expect(statuses).not.toContain('completed');
		expect(statuses).not.toContain('skipped');
	}

	await expectBackOnHelp(page);
	await settle(page);
	const storageAfter = await snapshotStorage(page);
	expect(
		diffStorage(storageBefore, storageAfter),
		'browser storage changed between the start and the end of the practice'
	).toEqual([]);

	await expectRealEnquiriesFree(page);
};

test.describe('practice network guard (T2)', () => {
	test.skip(
		!storageState,
		'set ORISO_TOUR_STORAGE_STATE to an authenticated consultant storage state'
	);

	test.use({ storageState });
	// One account, one practice at a time.
	test.describe.configure({ mode: 'default' });

	for (const flow of [ACCEPT_FLOW, SUPERVISION_FLOW]) {
		test(`${flow.name}: walked to the end, nothing leaves the page and nothing stays behind`, async ({
			page
		}) => {
			test.setTimeout(300_000);

			await provePracticeRun(page, flow, async (run) => {
				const walked = await flow.drive(page, run);
				// The last step's button writes the completion and ends the practice.
				await finishButton(page).click();
				return { ...walked, finished: true };
			});
		});
	}

	test(`${ACCEPT_FLOW.name}: ended from the banner half way, nothing leaves the page and nothing stays behind`, async ({
		page
	}) => {
		test.setTimeout(300_000);

		await provePracticeRun(page, ACCEPT_FLOW, async () => {
			// Up to the open practice enquiry, then "End practice" in the banner.
			await openThePracticeEnquiry(page);
			await endFromBanner(page);
			return { typed: [], finished: false };
		});
	});

	test.describe('the Gesprächskreis practice call (FE#2545 D3)', () => {
		test(`${CIRCLE_FLOW.name}: walked to the end, the call stays local and no media stays live`, async ({
			page
		}) => {
			test.setTimeout(300_000);
			await instrumentCallPath(page);
			const sockets = recordSockets(page);
			const traffic = recordTraffic(page);
			let from = traffic.mark();

			await provePracticeRun(page, CIRCLE_FLOW, async (run) => {
				from = traffic.mark();
				const walked = await CIRCLE_FLOW.drive(page, run);
				await finishButton(page).click();
				return { ...walked, finished: true };
			});

			const ran = traffic.requests.slice(from.requests);
			expect(
				ran
					.filter(
						(request) =>
							CALL_PATH.test(request.url) ||
							(request.url.includes('/_matrix/') &&
								request.method !== 'GET')
					)
					.map(
						(request) =>
							`${request.method} ${new URL(request.url).pathname}`
					),
				'requests of the real call path'
			).toEqual([]);
			expect(
				sockets.filter((url) => CALL_PATH.test(url)),
				'LiveKit or Element Call sockets'
			).toEqual([]);
			// Carimat's voice stays on the device: no speech service is asked,
			// and every utterance used a local voice.
			expect(
				[
					...traffic.requests.map((request) => request.url),
					...sockets
				].filter((url) => TTS_HOST.test(url)),
				'requests to a speech or TTS host'
			).toEqual([]);
			await expect(page.locator('.element-call-iframe')).toHaveCount(0);
			const probe = await readCallProbe(page);
			expect(probe.getUserMedia, 'getUserMedia calls').toBe(1);
			expect(probe.notifications, 'notifications').toBe(0);
			expect(
				probe.spoken.filter((voice) => voice.localService !== true),
				'utterances with a voice that is not local'
			).toEqual([]);
			if (probe.spoken.length > 0) {
				expect(
					probe.cancels,
					'speech cancelled on leave'
				).toBeGreaterThan(0);
			}
			test.info().annotations.push({
				type: 'carimat-voices',
				description: JSON.stringify(probe.spoken.slice(0, 3))
			});
			await expectNoLiveMedia(page);
		});
	});
});
