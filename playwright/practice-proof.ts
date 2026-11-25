import { expect, test, type Locator, type Page } from '@playwright/test';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
	assertNoPracticeWrites,
	recordedBodyText,
	type RecordedNetworkRequest
} from '../src/practice/assertNoPracticeWrites';
import { LIVE_CHAT_AVAILABILITY_ACK_STORAGE_KEY } from '../src/utils/liveChatAvailabilityStorage';
import { isPracticeId } from '../src/practice/practiceIds';
import {
	classifyRequest,
	redactUrl,
	type RequestPolicyConfig
} from '../src/practice/requestPolicy';

/**
 * Helpers of the T2 proof (`practice-network-guard.smoke.spec.ts`): what the
 * browser sent, what the browser stored, and the real controls a counsellor
 * uses to walk the two practice flows. Not a spec: Playwright only runs
 * `*.spec.ts`, so this file can be imported by the spec and by a dry run.
 *
 * Texts come from the i18n catalogues (de, de@informal, en), so the proof
 * follows the copy and works in whichever of these the account uses.
 */

// ---------------------------------------------------------------- texts

const CATALOGUES = ['de', 'de@informal', 'en'].map((language) =>
	JSON.parse(
		readFileSync(
			join(
				__dirname,
				'..',
				'src',
				'resources',
				'i18n',
				language,
				'common.json'
			),
			'utf8'
		)
	)
);

const lookup = (key: string): string[] => {
	const found = CATALOGUES.map((catalogue) =>
		key
			.split('.')
			.reduce((node, part) => (node as any)?.[part], catalogue as unknown)
	).filter((value): value is string => typeof value === 'string');
	if (found.length === 0) {
		throw new Error(`No catalogue text for "${key}"`);
	}
	return Array.from(new Set(found));
};

const escapeRegExp = (text: string) =>
	text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** The whole text, in any of the catalogues (accessible names, titles). */
export const exactText = (...keys: string[]): RegExp =>
	new RegExp(
		`^\\s*(?:${keys.flatMap(lookup).map(escapeRegExp).join('|')})\\s*$`
	);

/** The text anywhere inside a longer one (chat messages, list rows). */
export const partOfText = (key: string): RegExp =>
	new RegExp(lookup(key).map(escapeRegExp).join('|'));

/** Like `partOfText`, with every `{{placeholder}}` matching any name. */
export const partOfTemplate = (key: string): RegExp =>
	new RegExp(
		lookup(key)
			.map((text) =>
				text
					.split(/\{\{\s*\w+\s*\}\}/)
					.map(escapeRegExp)
					.join('.+?')
			)
			.join('|')
	);

// -------------------------------------------------------------- traffic

export interface RecordedRequest extends RecordedNetworkRequest {
	resourceType: string;
}

export interface TrafficMark {
	requests: number;
	frames: number;
}

export interface Traffic {
	requests: RecordedRequest[];
	/** Payloads of every frame the page sent on any WebSocket. */
	sentFrames: string[];
	mark: () => TrafficMark;
	between: (
		from: TrafficMark,
		to: TrafficMark
	) => { requests: RecordedRequest[]; sentFrames: string[] };
}

/** Everything the browser sends, in order; `between` cuts out one run. */
export const recordTraffic = (page: Page): Traffic => {
	const requests: RecordedRequest[] = [];
	const sentFrames: string[] = [];
	page.on('request', (request) => {
		requests.push({
			method: request.method(),
			url: request.url(),
			postData: request.postData(),
			resourceType: request.resourceType()
		});
	});
	page.on('websocket', (socket) => {
		socket.on('framesent', (frame) => {
			sentFrames.push(
				typeof frame.payload === 'string' ? frame.payload : '[binary]'
			);
		});
	});
	return {
		requests,
		sentFrames,
		mark: () => ({ requests: requests.length, frames: sentFrames.length }),
		between: (from, to) => ({
			requests: requests.slice(from.requests, to.requests),
			sentFrames: sentFrames.slice(from.frames, to.frames)
		})
	};
};

// Scripts, styles and fonts cannot carry data out; their file names may say "practice".
const ASSET_TYPES = ['script', 'stylesheet', 'font'];

/** Practice ids and the reserved practice Matrix server, in a path, query or body. */
const PRACTICE_TEXT = /practice\.invalid|practice-[a-z0-9]/i;

/** Where a request address names a practice id (a path or a query parameter name), if it does. */
const practiceInAddress = (href: string): string | null => {
	if (!/^https?:/i.test(href)) {
		return null;
	}
	const url = new URL(href);
	const isPractice = (part: string) =>
		isPracticeId(part) || PRACTICE_TEXT.test(part);
	if (url.pathname.split('/').map(decodeURIComponent).some(isPractice)) {
		return 'the path';
	}
	const parameter = Array.from(url.searchParams.entries()).find(([, value]) =>
		isPractice(value)
	);
	return parameter ? `the query parameter "${parameter[0]}"` : null;
};

/** A STOMP publish: the `SEND` command on its own line (the app only subscribes). */
const STOMP_SEND = /SEND(\\n|\n)/;

/**
 * What one practice run may have put on the network, judged from outside the
 * page. Throws on the first violated claim; messages name method, origin and
 * path, never a query or a body.
 *
 * 1. no write except the allowlisted progress PUT (and token refresh);
 * 2. no request, GET included, addresses a practice id or `practice.invalid`;
 * 3. nothing the counsellor typed (`typed`) was sent anywhere;
 * 4. the page sent no STOMP `SEND` frame and no frame naming a practice id.
 */
export const assertRunLeftNothing = (
	run: { requests: RecordedRequest[]; sentFrames: string[] },
	config: RequestPolicyConfig,
	typed: string[]
): void => {
	assertNoPracticeWrites(run.requests, config);

	const problems: string[] = [];
	run.requests.forEach((request) => {
		const allowed =
			classifyRequest(
				{
					method: request.method,
					url: request.url,
					bodyText: recordedBodyText(request, config)
				},
				config
			).verdict === 'allow';
		const label = `${request.method} ${redactUrl(request.url)}`;
		const where = ASSET_TYPES.includes(request.resourceType)
			? null
			: practiceInAddress(request.url);
		if (where) {
			problems.push(`${label}: ${where} names a practice id`);
		}
		const body = request.postData ?? '';
		if (!allowed && PRACTICE_TEXT.test(body)) {
			problems.push(`${label}: the body names a practice id`);
		}
		const everything = decodeURIComponent(request.url) + body;
		if (typed.some((text) => everything.includes(text))) {
			problems.push(`${label}: carries text typed during the practice`);
		}
	});
	run.sentFrames.forEach((frame, index) => {
		if (STOMP_SEND.test(frame) || PRACTICE_TEXT.test(frame)) {
			problems.push(
				`WebSocket frame #${index + 1}: a publish or a practice id`
			);
		}
		if (typed.some((text) => frame.includes(text))) {
			problems.push(`WebSocket frame #${index + 1}: carries typed text`);
		}
	});
	if (problems.length > 0) {
		throw new Error(
			`Practice run leaked ${problems.length} request(s) or frame(s):\n` +
				problems.map((problem) => `  ${problem}`).join('\n')
		);
	}
};

/** The status values of every tutorial-progress write in a run, in order. */
export const progressWriteStatuses = (
	requests: RecordedRequest[],
	config: RequestPolicyConfig
): string[] =>
	requests
		.filter(
			(request) =>
				request.method === 'PUT' &&
				redactUrl(request.url) === redactUrl(config.tutorialProgressUrl)
		)
		.map((request) => {
			try {
				return String(JSON.parse(request.postData ?? '{}').status);
			} catch (_error) {
				return 'unreadable';
			}
		});

// -------------------------------------------------------------- storage

export interface StorageSnapshot {
	local: Record<string, string>;
	session: Record<string, string>;
	/** Database names only: a name is all the browser lists without opening one. */
	indexedDb: string[];
}

export const snapshotStorage = (page: Page): Promise<StorageSnapshot> =>
	page.evaluate(async () => {
		const dump = (storage: Storage) =>
			Object.fromEntries(
				Array.from({ length: storage.length }, (_, index) => {
					const key = storage.key(index) as string;
					return [key, storage.getItem(key) as string];
				})
			);
		const databases = (await indexedDB.databases?.()) ?? [];
		return {
			local: dump(localStorage),
			session: dump(sessionStorage),
			indexedDb: databases.map((database) => String(database.name)).sort()
		};
	});

/**
 * localStorage keys that the allowed live-chat heartbeat may write during a
 * run: its acknowledgement time. Only added or changed is accepted; a removed
 * key would mean the availability itself changed, which stays a failure.
 */
export const HEARTBEAT_STORAGE_KEYS: readonly string[] = [
	LIVE_CHAT_AVAILABILITY_ACK_STORAGE_KEY
];

/** Added, removed and changed keys by name; values (tokens!) are never printed. */
export const diffStorage = (
	before: StorageSnapshot,
	after: StorageSnapshot
): string[] => {
	const lines: string[] = [];
	(['local', 'session'] as const).forEach((area) => {
		const name = area === 'local' ? 'localStorage' : 'sessionStorage';
		Object.keys({ ...before[area], ...after[area] }).forEach((key) => {
			const heartbeatWrite =
				area === 'local' &&
				HEARTBEAT_STORAGE_KEYS.includes(key) &&
				key in after[area];
			if (heartbeatWrite) {
				return;
			}
			if (!(key in before[area])) {
				lines.push(`${name}: added "${key}"`);
			} else if (!(key in after[area])) {
				lines.push(`${name}: removed "${key}"`);
			} else if (before[area][key] !== after[area][key]) {
				lines.push(`${name}: changed "${key}"`);
			}
		});
	});
	before.indexedDb
		.filter((database) => !after.indexedDb.includes(database))
		.forEach((database) => lines.push(`IndexedDB: removed "${database}"`));
	after.indexedDb
		.filter((database) => !before.indexedDb.includes(database))
		.forEach((database) => lines.push(`IndexedDB: added "${database}"`));
	return lines;
};

// ------------------------------------------------------ the real controls

const STEP_TIMEOUT = 30_000;

const target = (page: Page, name: string): Locator =>
	page.locator(`[data-tour-target="${name}"]`);

const tooltip = (page: Page) => page.locator('.productTourTooltip');

export const banner = (page: Page): Locator =>
	page.getByTestId('practice-banner');

const bannerCovers = (page: Page, name: string): Promise<boolean> =>
	page.evaluate((anchorName) => {
		const element = document.querySelector(
			`[data-tour-target="${anchorName}"]`
		);
		const box = element?.getBoundingClientRect();
		const top = box
			? document.elementFromPoint(
					box.x + box.width / 2,
					box.y + box.height / 2
				)
			: null;
		return !!top?.closest('[data-testid="practice-banner"]');
	}, name);

/**
 * Clicks a tour anchor as a counsellor would. The practice banner rests at the
 * bottom left of the list column and must never cover an anchor; if it does,
 * the run fails instead of working around it.
 */
const clickTarget = async (page: Page, name: string) => {
	await expect(target(page, name)).toBeVisible();
	expect(
		await bannerCovers(page, name),
		`the practice banner covers the "${name}" anchor at ${page.viewportSize()?.width}px width`
	).toBe(false);
	await target(page, name).click();
};

/** The practice card of a flow on the Help page (title = its tour title key). */
export const practiceCard = (page: Page, titleKey: string): Locator =>
	page.locator('li.practiceCards__card', {
		has: page.getByRole('heading', { name: exactText(titleKey) })
	});

export const startButton = (card: Locator): Locator =>
	card.getByRole('button', {
		name: exactText(
			'practice.cards.action.start',
			'practice.cards.action.restart'
		)
	});

/**
 * The tooltip shows this step (by its title and "Step n of N"); returns N.
 * `total` pins N once it is known from step 1.
 */
export const expectStep = async (
	page: Page,
	titleKey: string,
	current: number,
	total?: number
): Promise<number> => {
	await expect(
		tooltip(page).locator('.productTourTooltip__title')
	).toHaveText(exactText(titleKey), { timeout: STEP_TIMEOUT });
	const progress = tooltip(page).locator('.productTourTooltip__progress');
	await expect(progress).toHaveText(
		new RegExp(`^\\D*${current}\\D+${total ?? '\\d+'}\\s*$`)
	);
	const match = /(\d+)\D+(\d+)\s*$/.exec((await progress.innerText()) ?? '');
	return Number(match?.[2]);
};

const pressNext = (page: Page) =>
	tooltip(page)
		.getByRole('button', { name: exactText('walkthrough.step.next') })
		.click();

/** The last step's button: it writes the completion and ends the practice. */
export const finishButton = (page: Page): Locator =>
	tooltip(page).getByRole('button', {
		name: exactText('walkthrough.step.done')
	});

const SEND_BUTTON = 'enquiry.write.input.button.title';

/** Types through the real editor and presses its real send button. */
const typeAndSend = async (scope: Locator, text: string) => {
	const editor = scope
		.locator('.ProseMirror[contenteditable="true"]')
		.first();
	await editor.click();
	await editor.pressSequentially(text, { delay: 10 });
	const send = scope.getByRole('button', { name: exactText(SEND_BUTTON) });
	await expect(send).toBeEnabled();
	await send.click();
};

const mainPane = (page: Page) => page.locator('.chatStage__mainPane');

/** A text only this run could have typed, so a leak is traceable to it. */
export const typedText = (run: string, what: string) =>
	`Übungstext ${what} ${run}`;

export interface FlowRun {
	/** Everything typed into the practice: none of it may be sent. */
	typed: string[];
	/** Flow F1 only: whether the Träger's Team-Besprechung steps were present. */
	withTeam?: boolean;
}

const ACCEPT_STEP = 'tour.practiceAccept.step';

/**
 * Flow F1, steps 1 and 2: the Anfragen link in the navigation, then the
 * practice enquiry in the real list. Returns the step count: eight with the
 * Träger's Team-Besprechung steps, six without.
 */
export const openThePracticeEnquiry = async (page: Page): Promise<number> => {
	const total = await expectStep(
		page,
		`${ACCEPT_STEP}.navEnquiries.title`,
		1
	);
	expect([6, 8]).toContain(total);
	await clickTarget(page, 'nav-enquiries');
	await pressNext(page);

	await expectStep(page, `${ACCEPT_STEP}.openEnquiry.title`, 2, total);
	// Only the practice enquiry: no real row is mixed in.
	const rows = page.locator('[data-cy="session-list-item"]');
	await expect(rows).toHaveCount(1);
	await expect(rows.first()).toContainText(
		partOfText('practiceScript.cast.asker')
	);
	await clickTarget(page, 'enquiry-list-item');
	return total;
};

/** "End practice" in the banner. */
export const endFromBanner = (page: Page) =>
	banner(page)
		.getByRole('button', { name: exactText('practice.banner.end') })
		.click();

/**
 * Flow F1 from the first tooltip to the last (spec 3.3), with the real
 * controls. The variant is the tenant's, so it is read from the step count and
 * reported.
 */
export const driveAcceptFlow = async (
	page: Page,
	run: string
): Promise<FlowRun> => {
	const typed: string[] = [];
	const total = await openThePracticeEnquiry(page);
	const withTeam = total === 8;

	if (withTeam) {
		await expectStep(page, `${ACCEPT_STEP}.openTeam.title`, 3, total);
		await clickTarget(page, 'enquiry-team-button');
		await expectStep(page, `${ACCEPT_STEP}.teamReply.title`, 4, total);
		const panel = target(page, 'team-discussion-panel');
		await expect(panel).toContainText(
			partOfText('practiceScript.colleague.teamMessage')
		);
		const note = typedText(run, 'team');
		typed.push(note);
		await typeAndSend(panel, note);
	}

	const accept = withTeam ? 5 : 3;
	await expectStep(page, `${ACCEPT_STEP}.accept.title`, accept, total);
	await clickTarget(page, 'enquiry-accept-button');

	await expectStep(
		page,
		`${ACCEPT_STEP}.firstAnswer.title`,
		accept + 1,
		total
	);
	await expect(mainPane(page)).toContainText(
		partOfText('practiceScript.asker.firstMessage'),
		{ timeout: STEP_TIMEOUT }
	);
	await pressNext(page);

	await expectStep(page, `${ACCEPT_STEP}.reply.title`, accept + 2, total);
	const reply = typedText(run, 'reply');
	typed.push(reply);
	await expect(target(page, 'session-composer')).toBeVisible();
	await typeAndSend(mainPane(page), reply);
	await expect(mainPane(page)).toContainText(
		partOfText('practiceScript.asker.reply'),
		{ timeout: STEP_TIMEOUT }
	);

	await expectStep(page, `${ACCEPT_STEP}.done.title`, accept + 3, total);
	return { typed, withTeam };
};

/** Flow F2 from the first tooltip to the last (spec 3.4): four steps. */
export const driveSupervisionFlow = async (
	page: Page,
	run: string
): Promise<FlowRun> => {
	const typed: string[] = [];
	const step = 'tour.practiceSupervision.step';

	const total = await expectStep(page, `${step}.addSupervisor.title`, 1);
	expect(total).toBe(4);
	await expect(mainPane(page)).toContainText(
		partOfText('practiceScript.counsellor.acceptedCaseMessage'),
		{ timeout: STEP_TIMEOUT }
	);
	// The real "+": pick the supervisor, give the reason, confirm.
	await clickTarget(page, 'session-supervisor-add');
	await page.getByRole('combobox').click();
	await page
		.getByRole('option', {
			name: partOfText('practiceScript.cast.supervisor')
		})
		.click();
	const reason = typedText(run, 'reason');
	typed.push(reason);
	await page
		.getByPlaceholder(
			partOfText('sessionHeader.supervisor.modal.reasonPlaceholder')
		)
		.fill(reason);
	await page
		.getByRole('button', {
			name: exactText('sessionHeader.supervisor.modal.addButton')
		})
		.click();

	await expectStep(page, `${step}.supervisorReply.title`, 2, total);
	const panel = target(page, 'supervision-panel');
	await expect(panel).toContainText(
		partOfText('practiceScript.supervisor.reply'),
		{
			timeout: STEP_TIMEOUT
		}
	);
	await expect(mainPane(page)).not.toContainText(
		partOfText('practiceScript.supervisor.reply')
	);
	await pressNext(page);

	await expectStep(page, `${step}.standingAssignment.title`, 3, total);
	await pressNext(page);

	await expectStep(page, `${step}.done.title`, 4, total);
	return { typed };
};

/**
 * After the practice: the real Anfragen list, opened through the real
 * navigation, carries no practice id, no practice row and no practice name.
 */
export const expectRealEnquiriesFree = async (page: Page): Promise<void> => {
	await clickTarget(page, 'nav-enquiries');
	await expect(target(page, 'nav-enquiries')).toHaveClass(
		/navigation__item--active/
	);
	// The list loads from the real backend; there is no single "loaded" signal.
	await page
		.waitForLoadState('networkidle', { timeout: 15_000 })
		.catch(() => {});
	await page.waitForTimeout(3000);

	const found = await page.evaluate(() => {
		const hits: string[] = [];
		document
			.querySelectorAll('[data-group-id], a[href]')
			.forEach((element) => {
				const id = element.getAttribute('data-group-id') ?? '';
				const href = element.getAttribute('href') ?? '';
				const parts = [id, ...href.split('/')].map((part) => {
					try {
						return decodeURIComponent(part.split('?')[0]);
					} catch (_error) {
						return part;
					}
				});
				if (
					parts.some(
						(part) =>
							/^-[1-9]\d*$/.test(part) ||
							/practice\.invalid|^[!$@#]?practice-/i.test(part)
					)
				) {
					hits.push(
						`${element.tagName.toLowerCase()} with a practice id`
					);
				}
			});
		return hits;
	});
	expect(found, 'the real list holds practice ids').toEqual([]);
	await expect(page.locator('body')).not.toContainText(
		partOfText('practiceScript.cast.asker')
	);
};

// ------------------------------------------- the Gesprächskreis and its call

/** A topic tour's card in "Meine Rundgänge" (the circle tour has no practice card). */
export const tourCard = (page: Page, titleKey: string): Locator =>
	page.locator('li.tourOverview__card', {
		has: page.getByRole('heading', { name: exactText(titleKey) })
	});

export const tourStartButton = (card: Locator): Locator =>
	card.getByRole('button', {
		name: exactText(
			'walkthrough.overview.action.start',
			'walkthrough.overview.action.continue',
			'walkthrough.overview.action.restart'
		)
	});

/** The tooltip shows this step; the circle flow's count depends on the tenant. */
const expectTitle = (page: Page, titleKey: string) =>
	expect(tooltip(page).locator('.productTourTooltip__title')).toHaveText(
		exactText(titleKey),
		{ timeout: STEP_TIMEOUT }
	);

const titleIs = async (page: Page, titleKey: string): Promise<boolean> =>
	exactText(titleKey).test(
		(await tooltip(page)
			.locator('.productTourTooltip__title')
			.innerText()
			.catch(() => '')) ?? ''
	);

/**
 * Instruments the page before the app loads: every getUserMedia call and the
 * tracks it handed out, every AudioContext, every Notification, and the
 * voice of every `speechSynthesis.speak` (name, lang, localService) and
 * every `cancel`. Only names and states are read back; no media leaves the
 * page.
 */
export const instrumentCallPath = (page: Page) =>
	page.addInitScript(() => {
		const probe = {
			getUserMedia: 0,
			tracks: [] as MediaStreamTrack[],
			audio: [] as AudioContext[],
			notifications: 0,
			spoken: [] as Array<{
				name: string | null;
				lang: string | null;
				localService: boolean | null;
			}>,
			cancels: 0
		};
		(
			window as unknown as { __practiceCallProbe: typeof probe }
		).__practiceCallProbe = probe;
		const devices = navigator.mediaDevices;
		if (devices?.getUserMedia) {
			const original = devices.getUserMedia.bind(devices);
			devices.getUserMedia = async (constraints) => {
				probe.getUserMedia += 1;
				const stream = await original(constraints);
				probe.tracks.push(...stream.getTracks());
				return stream;
			};
		}
		const NativeAudioContext = window.AudioContext;
		if (NativeAudioContext) {
			window.AudioContext = class extends NativeAudioContext {
				constructor(options?: AudioContextOptions) {
					super(options);
					probe.audio.push(this);
				}
			};
		}
		const synth = window.speechSynthesis;
		if (synth) {
			const speak = synth.speak.bind(synth);
			const cancel = synth.cancel.bind(synth);
			synth.speak = (utterance) => {
				probe.spoken.push({
					name: utterance.voice?.name ?? null,
					lang: utterance.voice?.lang ?? null,
					localService: utterance.voice?.localService ?? null
				});
				speak(utterance);
			};
			synth.cancel = () => {
				probe.cancels += 1;
				cancel();
			};
		}
		const NativeNotification = window.Notification;
		if (NativeNotification) {
			const Counted = function (
				this: Notification,
				title: string,
				options?: NotificationOptions
			) {
				probe.notifications += 1;
				return new NativeNotification(title, options);
			} as unknown as typeof Notification;
			Object.setPrototypeOf(Counted, NativeNotification);
			window.Notification = Counted;
		}
	});

export interface CallProbe {
	getUserMedia: number;
	tracks: Array<{ kind: string; readyState: string }>;
	audio: string[];
	notifications: number;
	/** The voice of every utterance Carimat spoke. */
	spoken: Array<{
		name: string | null;
		lang: string | null;
		localService: boolean | null;
	}>;
	cancels: number;
}

export const readCallProbe = (page: Page): Promise<CallProbe> =>
	page.evaluate(() => {
		const probe = (
			window as unknown as {
				__practiceCallProbe: {
					getUserMedia: number;
					tracks: MediaStreamTrack[];
					audio: AudioContext[];
					notifications: number;
					spoken: CallProbe['spoken'];
					cancels: number;
				};
			}
		).__practiceCallProbe;
		return {
			getUserMedia: probe.getUserMedia,
			tracks: probe.tracks.map((track) => ({
				kind: track.kind,
				readyState: track.readyState
			})),
			audio: probe.audio.map((context) => context.state),
			notifications: probe.notifications,
			spoken: probe.spoken,
			cancels: probe.cancels
		};
	});

/** Every track handed out has ended and every AudioContext is closed. */
export const expectNoLiveMedia = async (page: Page) => {
	await expect
		.poll(async () => {
			const probe = await readCallProbe(page);
			return [
				...probe.tracks.map(
					(track) => `${track.kind}:${track.readyState}`
				),
				...probe.audio.map((state) => `audio:${state}`)
			].filter((state) => !/:(ended|closed)$/.test(state));
		})
		.toEqual([]);
};

/** WebSockets the page opens; a LiveKit or Element Call socket is a failure. */
export const recordSockets = (page: Page): string[] => {
	const urls: string[] = [];
	page.on('websocket', (socket) => urls.push(socket.url()));
	return urls;
};

/** A socket or request of the real call path (LiveKit, Element Call, Matrix RTC). */
export const CALL_PATH =
	/livekit|element-call|\/service\/matrix\/calls|\/rtc\b|org\.matrix\.msc3401|sfu/i;

/** A speech or text-to-speech service: Carimat's voice must stay on the device. */
export const TTS_HOST =
	/texttospeech|speech\.googleapis|translate_tts|\/tts\b|polly\.|cognitiveservices|speech\.microsoft|speech-to-text|elevenlabs/i;

const CIRCLE_STEP = 'tour.groupCircle.step';

/**
 * The Gesprächskreis practice flow (FE#2545): the real create flow, the
 * waiting room's start, then the practice call with Chromium's fake camera
 * and microphone: mute, camera off, minimise into the dock, expand, leave.
 * Ends on the last step (its button still to press).
 */
export const driveCircleFlow = async (page: Page): Promise<FlowRun> => {
	await expectTitle(page, `${CIRCLE_STEP}.intro.title`);
	await pressNext(page);

	await expectTitle(page, `${CIRCLE_STEP}.create.title`);
	await clickTarget(page, 'groupchat-create-button');

	// Format card and topic picker only where the tenant offers formats.
	await expect(
		tooltip(page).locator('.productTourTooltip__title')
	).not.toHaveText(exactText(`${CIRCLE_STEP}.create.title`), {
		timeout: STEP_TIMEOUT
	});
	if (await titleIs(page, `${CIRCLE_STEP}.format.title`)) {
		await pressNext(page);
	}
	const pickTopic = async (scope: Locator) => {
		await scope
			.getByRole('button', {
				name: exactText('groupChat.circle.topicLabel')
			})
			.click();
		await page
			.getByRole('option', {
				name: exactText('practiceScript.names.topic')
			})
			.click();
	};
	if (await titleIs(page, `${CIRCLE_STEP}.topic.title`)) {
		const picker = target(page, 'groupchat-topic-picker');
		await pickTopic(picker);
		await picker
			.getByRole('button', {
				name: exactText('practiceScript.names.topic')
			})
			.click();
	}

	// The settings card: topic where still unset, a Beratungsstelle where
	// none is preselected; then Next.
	await expectTitle(page, `${CIRCLE_STEP}.practiceConfigure.title`);
	const card = target(page, 'groupchat-circle-settings');
	const topicButton = card.getByRole('button', {
		name: exactText('groupChat.circle.topicLabel')
	});
	if (await topicButton.isVisible().catch(() => false)) {
		await pickTopic(card);
	}
	const create = target(page, 'groupchat-circle-create');
	if (await create.isDisabled()) {
		await card.getByRole('combobox').first().click();
		await page.getByRole('option').first().click();
	}
	await pressNext(page);

	await expectTitle(page, `${CIRCLE_STEP}.practiceSettings.title`);
	await expect(create).toBeEnabled();
	await clickTarget(page, 'groupchat-circle-create');

	await expectTitle(page, `${CIRCLE_STEP}.practiceOpen.title`);
	await clickTarget(page, 'groupchat-list-item');

	// The real "Video-Call starten": the circle starts in memory and the
	// practice call opens in the same click.
	await expectTitle(page, `${CIRCLE_STEP}.practiceStart.title`);
	await target(page, 'groupchat-start-button')
		.getByRole('button', {
			name: exactText('videoCall.button.startVideoCall')
		})
		.or(page.locator('button[data-tour-target="groupchat-start-button"]'))
		.first()
		.click();

	await expectTitle(page, `${CIRCLE_STEP}.practiceStage.title`);
	await expect(target(page, 'practice-call-stage')).toBeVisible();
	// Chromium's fake camera: the own preview plays.
	await expect(page.getByTestId('practice-call-own-video')).toBeVisible({
		timeout: STEP_TIMEOUT
	});
	await expect(page.getByTestId('practice-call-robot-tile')).toContainText(
		partOfTemplate('practice.callStage.robotName')
	);
	await expect(page.getByTestId('practice-call-caption')).toContainText(
		partOfTemplate('practice.callStage.line1'),
		{ timeout: STEP_TIMEOUT }
	);
	await expect(page.locator('.element-call-iframe')).toHaveCount(0);
	await pressNext(page);

	await expectTitle(page, `${CIRCLE_STEP}.practiceMute.title`);
	await clickTarget(page, 'practice-call-mute');
	await expect(target(page, 'practice-call-mute')).toHaveAttribute(
		'aria-pressed',
		'true'
	);

	await expectTitle(page, `${CIRCLE_STEP}.practiceCamera.title`);
	await clickTarget(page, 'practice-call-camera');
	await expect(page.getByTestId('practice-call-own-video')).toHaveCount(0);

	await expectTitle(page, `${CIRCLE_STEP}.practiceMinimise.title`);
	await clickTarget(page, 'practice-call-minimise');

	await expectTitle(page, `${CIRCLE_STEP}.practiceExpand.title`);
	await expect(target(page, 'practice-call-dock')).toBeVisible();
	await expect(target(page, 'practice-call-stage')).toHaveCount(0);
	await clickTarget(page, 'practice-call-expand');

	await expectTitle(page, `${CIRCLE_STEP}.practiceLeave.title`);
	await clickTarget(page, 'practice-call-leave');

	await expectTitle(page, `${CIRCLE_STEP}.done.title`);
	await expect(target(page, 'practice-call-stage')).toHaveCount(0);
	await expect(target(page, 'practice-call-dock')).toHaveCount(0);
	await expectNoLiveMedia(page);
	return { typed: [] };
};
