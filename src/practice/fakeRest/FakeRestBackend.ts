import type { UserDataInterface } from '../../globalState/interfaces';
import {
	STATUS_ACTIVE,
	STATUS_ENQUIRY,
	type GroupChatItemInterface
} from '../../globalState/interfaces/SessionsDataInterface';
import {
	counsellorAsSessionConsultant,
	createPracticeScenario,
	createPracticeTopic,
	type PracticeCaseState,
	type PracticeStart
} from '../fixtures/practiceScenario';
import {
	PRACTICE_COUNSELLOR_MATRIX_USER_ID,
	type PracticePerson
} from '../fixtures/practiceCast';
import {
	isPracticeId,
	isPracticeRoomId,
	PRACTICE_AGENCY_ID,
	PRACTICE_CIRCLE_CHAT_ID,
	PRACTICE_CIRCLE_ROOM_ID,
	PRACTICE_NUMERIC_ID_PATTERN,
	PRACTICE_SUPERVISION_ROOM_ID,
	PRACTICE_TEAM_ROOM_ID
} from '../practiceIds';
import type { ScriptEngine } from '../script/ScriptEngine';
import { isPracticeDraftScope } from '../practiceDraftScopes';
import { REMOTE_DRAFT_INDEX_SCOPE } from '../../services/draftStore';
import { endpoints } from '../../resources/scripts/endpoints';
import type { TeamDiscussion } from '../../api/apiTeamDiscussion';
import type { EventNotificationFeedResponse } from '../../api/apiEventNotifications';
import type {
	IUserDraftFeedResponse,
	IUserDraftItem
} from '../../api/apiUserDrafts';
import type { groupChatSettings } from '../../api/apiGroupChatSettings';
import { GROUP_CHAT_API } from '../../api/apiPutGroupChat';
import type { InternalChatColleague } from '../../components/conversationCreate/internal/loadInternalChatColleagues';
import { PracticeBlockedRequestError } from '../networkGuard';
import { redactUrl } from '../requestPolicy';

export interface FakeRestHooks {
	onEnquiryAccepted?: (sessionId: number) => void;
	onSupervisorAdded?: (
		supervisor: UserService.Schemas.SessionSupervisorResponseDTO
	) => void;
	/** The practice Gesprächskreis was created (FE#2545). */
	onCircleCreated?: (chatId: number) => void;
	/** Its moderator started it (FE#2545). */
	onCircleStarted?: (chatId: number) => void;
}

export interface FakeRestBackendOptions {
	counsellor: UserDataInterface;
	/** Names and texts of the run; the REST side shows only the cast. */
	script: ScriptEngine;
	start?: PracticeStart;
	now?: () => number;
	hooks?: FakeRestHooks;
}

export interface HandleOptions {
	/** Answer only requests addressed to a practice id or room. */
	practiceAddressedOnly?: boolean;
}

export interface ServedRequest {
	method: string;
	url: string;
	status: number;
}

export interface FakeRestBackend {
	/** `null` means "not a practice endpoint": the caller passes it on. */
	handle(
		input: RequestInfo | URL,
		init?: RequestInit,
		options?: HandleOptions
	): Promise<Response | null>;
	getCase(): Readonly<PracticeCaseState>;
	/** Requests answered from memory, newest last. */
	readonly served: ReadonlyArray<ServedRequest>;
	reset(): void;
}

interface ParsedRequest {
	method: string;
	url: URL;
	body: () => Promise<any>;
}

type Route = {
	method: string;
	path: RegExp;
	/**
	 * Not tied to a practice id (lists, drafts, feed): answered only while the
	 * practice view is mounted, except explicitly scoped cleanup.
	 */
	viewWide?: true;
	/** Practice drafts and their shared index may finish during teardown. */
	duringDrain?: (request: ParsedRequest) => boolean;
	/**
	 * A write only practice makes, with no practice id in its URL. What the
	 * fake does not answer (while draining, or `null` from `handle`) is
	 * blocked, never passed on to the real backend.
	 */
	practiceOnlyWrite?: true;
	handle: (
		request: ParsedRequest,
		match: RegExpMatchArray
	) => Promise<Response | null> | Response | null;
};

const isIsolatedDraftRequest = ({ url }: ParsedRequest): boolean => {
	const scope = url.searchParams.get('scopeKey') || '';
	return scope === REMOTE_DRAFT_INDEX_SCOPE || isPracticeDraftScope(scope);
};

const ok = (body: unknown) =>
	new Response(JSON.stringify(body), {
		status: 200,
		headers: { 'Content-Type': 'application/json' }
	});
const noContent = () => new Response(null, { status: 204 });

/** Practice ids are negative; a positive id is never answered from memory. */
const PRACTICE_ID_SEGMENT = `(${PRACTICE_NUMERIC_ID_PATTERN})`;

const escapeRegExp = (value: string) =>
	value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** The path of an `endpoints` entry: a moved endpoint moves the fake too. */
const pathOf = (endpoint: string) =>
	new URL(endpoint, window.location.href).pathname;

/** Exactly this endpoint's path, plus an optional regex suffix. */
const at = (endpoint: string, suffix = '') =>
	new RegExp(`^${escapeRegExp(pathOf(endpoint))}${suffix}$`);

/** An endpoint that takes a session id, which must be a practice id. */
const atSession = (endpoint: (sessionId: number) => string) => {
	const marker = String(Number.MAX_SAFE_INTEGER);
	const [before, after] = pathOf(endpoint(Number.MAX_SAFE_INTEGER)).split(
		marker
	);
	return new RegExp(
		`^${escapeRegExp(before)}${PRACTICE_ID_SEGMENT}${escapeRegExp(after)}$`
	);
};

const parseRequest = (
	input: RequestInfo | URL,
	init?: RequestInit
): ParsedRequest => {
	const request = input instanceof Request ? input : null;
	const rawUrl = request ? request.url : String(input);
	const method = (init?.method || request?.method || 'GET').toUpperCase();
	const body = async () => {
		const text = request
			? await request.clone().text()
			: typeof init?.body === 'string'
				? init.body
				: '';
		try {
			return text ? JSON.parse(text) : null;
		} catch {
			return null;
		}
	};
	return { method, url: new URL(rawUrl, window.location.href), body };
};

/**
 * Stateful in-memory stand-in for the endpoints the practice view calls.
 * Answers are 2xx only: a 401 would log the real user out, any other non-2xx
 * sends `fetchData` to the error page when the caller passes no
 * `responseHandling`. Requests it returns `null` for are the sandbox's to
 * answer (`PracticeSandbox`). Mutations change this memory only.
 */
export const createFakeRestBackend = ({
	counsellor,
	script,
	start = 'enquiry',
	now = Date.now,
	hooks = {}
}: FakeRestBackendOptions): FakeRestBackend => {
	let practiceCase: PracticeCaseState;
	let drafts: Map<string, IUserDraftItem>;
	let supervisorSeq: number;
	/** The Gesprächskreis the counsellor created in this run (FE#2545). */
	let circle: GroupChatItemInterface | null;
	/** The colleagues picked as its co-moderators: practice cast only. */
	let coModerators: PracticePerson[];
	const served: ServedRequest[] = [];

	const reset = () => {
		practiceCase = createPracticeScenario({
			counsellor,
			script,
			start,
			now: now()
		}).practiceCase;
		drafts = new Map();
		supervisorSeq = 0;
		circle = null;
		coModerators = [];
		served.length = 0;
	};
	reset();

	const listItem = (): UserService.Schemas.ConsultantSessionResponseDTO => ({
		session: practiceCase.session,
		user: practiceCase.user,
		consultant: practiceCase.consultant,
		latestMessage: new Date(practiceCase.latestMessage)
	});

	const isLiveChat = () =>
		practiceCase.session.registrationType === 'ANONYMOUS';

	const caseListed = (status: number, anonymous: boolean) =>
		practiceCase.session.status === status &&
		// Waiting live chats come from their own queue endpoint.
		(status !== STATUS_ENQUIRY || isLiveChat() === anonymous);

	/**
	 * A created circle sits in the counsellor's own sessions (FE#2545); the
	 * list shows a not-yet-joined circle only to its owner.
	 */
	const circleItem = () => ({
		chat: circle!,
		consultant: counsellorAsSessionConsultant(counsellor)
	});

	const sessionList = (status: number, anonymous = false) => {
		const sessions: unknown[] = [
			...(caseListed(status, anonymous) ? [listItem()] : []),
			...(status === STATUS_ACTIVE && circle ? [circleItem()] : [])
		];
		// SAFETY: a practice fixture; the list renderer reads only the fields
		// set here, and the items come from listItem() / circleItem().
		return sessions.length
			? ok({
					sessions,
					offset: 0,
					count: sessions.length,
					total: sessions.length
				} as UserService.Schemas.ConsultantSessionListResponseDTO)
			: noContent();
	};

	/** Who the create screen offers as co-moderators. */
	const practiceColleagues = (): PracticePerson[] => [script.cast.colleague];

	const isCircle = (id: string) =>
		!!circle && Number(id) === circle.id && isPracticeId(id);

	/**
	 * "Erstellen" in the circle settings: the circle exists in memory only. It
	 * keeps what the counsellor set, except the medium: the practice circle
	 * meets by video, so the flow can show the moderator's video start. No
	 * invite token: the share dialog would offer a link that leads nowhere.
	 */
	const createCircle = (settings: Partial<groupChatSettings> | null) => {
		coModerators = practiceColleagues().filter((person) =>
			(settings?.consultantIds ?? []).includes(person.id)
		);
		const topic = createPracticeTopic(script.names.topic);
		const createdAt = new Date(now()).toISOString();
		// SAFETY: an in-memory practice circle; every field the circle views
		// read is set below, the rest stays at the DTO's optional default.
		circle = {
			id: PRACTICE_CIRCLE_CHAT_ID,
			matrixRoomId: PRACTICE_CIRCLE_ROOM_ID,
			conversationType: 'SELF_HELP',
			topic: settings?.topic || topic.name,
			startDate: settings?.startDate || createdAt.slice(0, 10),
			startTime: settings?.startTime || createdAt.slice(11, 16),
			duration: settings?.duration ?? 60,
			repetitive: settings?.repetitive ?? true,
			repeatCount: settings?.repeatCount ?? 1,
			chatInterval: settings?.chatInterval ?? 'WEEKLY',
			modality: 'VIDEO',
			timezone: settings?.timezone,
			hintMessage: settings?.hintMessage ?? '',
			sourceLanguage: settings?.sourceLanguage,
			hintMessageTranslations: settings?.hintMessageTranslations,
			groupChatRulesTranslations: settings?.groupChatRulesTranslations,
			consultingType: practiceCase.session.consultingType,
			assignedAgencies: [
				// SAFETY: the practice agency; it carries every field the circle
				// settings and the agency chip read.
				{
					id: PRACTICE_AGENCY_ID,
					name: script.names.agency,
					postcode: '00000',
					city: '',
					description: '',
					teamAgency: true,
					offline: false,
					consultingType: practiceCase.session.consultingType
				} as AgencyService.Schemas.AgencyResponseDTO
			],
			active: false,
			subscribed: false,
			messagesRead: true,
			messageDate: Math.floor(now() / 1000),
			lastMessage: '',
			createdAt,
			moderators: [
				PRACTICE_COUNSELLOR_MATRIX_USER_ID,
				...coModerators.map((person) => person.matrixUserId)
			]
		} as GroupChatItemInterface;
		hooks.onCircleCreated?.(circle.id);
		return ok({ matrixRoomId: circle.matrixRoomId });
	};

	const roomList = () =>
		({
			sessions: [listItem()]
		}) satisfies UserService.Schemas.GroupSessionListResponseDTO;

	const isCase = (id: string) =>
		Number(id) === practiceCase.session.id && isPracticeId(id);

	/** Registered (F1) or live chat (FE#2545): the same accept, in memory. */
	const accept = (id: string) => {
		if (!isCase(id)) return null;
		if (practiceCase.session.status === STATUS_ENQUIRY) {
			practiceCase = {
				...practiceCase,
				session: {
					...practiceCase.session,
					status: STATUS_ACTIVE,
					consultantMatrixUserId: PRACTICE_COUNSELLOR_MATRIX_USER_ID
				},
				consultant: counsellorAsSessionConsultant(counsellor),
				// The team discussion closes at accept (ADR-016).
				teamDiscussion: practiceCase.teamDiscussion && {
					...practiceCase.teamDiscussion,
					status: 'ARCHIVED'
				}
			};
			hooks.onEnquiryAccepted?.(practiceCase.session.id);
		}
		return noContent();
	};

	const routes: Route[] = [
		{
			method: 'GET',
			path: at(endpoints.consultantEnquiriesBase, 'registered'),
			viewWide: true,
			handle: () => sessionList(STATUS_ENQUIRY)
		},
		{
			method: 'GET',
			path: at(endpoints.consultantEnquiriesBase, 'anonymous'),
			viewWide: true,
			handle: () => sessionList(STATUS_ENQUIRY, true)
		},
		{
			method: 'GET',
			path: at(endpoints.consultantSessions),
			viewWide: true,
			handle: () => sessionList(STATUS_ACTIVE)
		},
		{
			method: 'GET',
			path: at(endpoints.myMessagesBase, 'archive'),
			viewWide: true,
			handle: () => noContent()
		},
		{
			method: 'GET',
			path: at(endpoints.sessionRooms, `/${PRACTICE_ID_SEGMENT}`),
			handle: (_request, [, id]) => (isCase(id) ? ok(roomList()) : null)
		},
		{
			method: 'GET',
			path: at(endpoints.sessionRooms),
			handle: ({ url }) => {
				const roomIds = (url.searchParams.get('roomIds[]') || '')
					.split(',')
					.filter(Boolean);
				if (!roomIds.length || !roomIds.every(isPracticeRoomId)) {
					return null;
				}
				const sessions = [
					...(roomIds.includes(practiceCase.session.matrixRoomId)
						? roomList().sessions
						: []),
					...(circle && roomIds.includes(circle.matrixRoomId)
						? [circleItem()]
						: [])
				];
				return sessions.length ? ok({ sessions }) : noContent();
			}
		},
		// The Gesprächskreis flow (FE#2545): topics and co-moderators of the
		// create screen, the create itself, and the circle's own reads.
		{
			method: 'GET',
			path: at(endpoints.agencyTopics),
			viewWide: true,
			handle: () => {
				const topic = createPracticeTopic(script.names.topic);
				return ok([
					{ id: topic.id, name: topic.name }
				] satisfies AgencyService.Schemas.AgencyTopicsDTO[]);
			}
		},
		{
			method: 'GET',
			path: at(endpoints.chatSeriesBase, 'consultants'),
			viewWide: true,
			handle: () =>
				ok(
					practiceColleagues().map((person) => ({
						consultantId: person.id,
						firstName: person.firstName,
						lastName: person.lastName,
						displayName: person.displayName,
						username: person.username
					}))
				)
		},
		{
			// The create screen's colleague picker: practice colleagues only.
			method: 'GET',
			path: at(endpoints.internalSubsetChat, '/recipients'),
			viewWide: true,
			handle: () =>
				ok(
					practiceColleagues().map((person) => ({
						consultantId: person.id,
						displayName: person.displayName,
						agencies: [
							{
								id: PRACTICE_AGENCY_ID,
								name: script.names.agency
							}
						]
					})) satisfies InternalChatColleague[]
				)
		},
		{
			method: 'POST',
			path: at(
				endpoints.groupChatBase,
				`(?:${escapeRegExp(GROUP_CHAT_API.CREATEV2)}|${escapeRegExp(GROUP_CHAT_API.CREATE)})`
			),
			viewWide: true,
			practiceOnlyWrite: true,
			// The circle room is seeded only for the Gesprächskreis start.
			handle: async ({ body }) =>
				start === 'groupCircle' ? createCircle(await body()) : null
		},
		{
			method: 'GET',
			path: at(endpoints.chatRoom, `/${PRACTICE_ID_SEGMENT}`),
			handle: (_request, [, id]) =>
				isCircle(id) ? ok({ sessions: [circleItem()] }) : null
		},
		{
			method: 'GET',
			path: at(endpoints.groupChatBase, PRACTICE_ID_SEGMENT),
			handle: (_request, [, id]) =>
				isCircle(id)
					? ok({
							id: circle!.id,
							active: circle!.active,
							matrixRoomId: circle!.matrixRoomId,
							bannedUsers: []
						})
					: null
		},
		{
			// The circle's moderator, read by its card and waiting room.
			method: 'GET',
			path: at(endpoints.groupChatBase, `${PRACTICE_ID_SEGMENT}/members`),
			handle: (_request, [, id]) =>
				isCircle(id)
					? ok({
							members: [
								{
									userId: counsellor.userId,
									username: counsellor.userName,
									displayName:
										counsellorAsSessionConsultant(
											counsellor
										).displayName,
									role: 'CONSULTANT' as const
								},
								...coModerators.map((person) => ({
									userId: person.id,
									username: person.username,
									displayName: person.displayName,
									role: 'CONSULTANT' as const
								}))
							]
						} satisfies UserService.Schemas.ChatMembersResponseDTO)
					: null
		},
		{
			// A single meeting: no series dates.
			method: 'GET',
			path: at(
				endpoints.chatSeriesBase,
				`${PRACTICE_ID_SEGMENT}/occurrences`
			),
			handle: (_request, [, id]) => (isCircle(id) ? ok([]) : null)
		},
		{
			// "Video-Call starten" in the waiting room: the circle opens and
			// its moderator is in. No call starts; the flow only shows its button.
			method: 'PUT',
			path: at(
				endpoints.groupChatBase,
				`${PRACTICE_ID_SEGMENT}${escapeRegExp(GROUP_CHAT_API.START)}`
			),
			handle: (_request, [, id]) => {
				if (!isCircle(id)) return null;
				if (!circle!.active) {
					circle = { ...circle!, active: true, subscribed: true };
					hooks.onCircleStarted?.(circle.id);
				}
				return noContent();
			}
		},
		{
			method: 'PUT',
			path: at(endpoints.sessionBase, `/new/${PRACTICE_ID_SEGMENT}`),
			handle: (_request, [, id]) => accept(id)
		},
		{
			// Live chats take their own assignment path (#774).
			method: 'PUT',
			path: atSession(endpoints.acceptAnonymousEnquiry),
			handle: (_request, [, id]) => accept(id)
		},
		{
			// The queue position poll of a waiting live chat.
			method: 'GET',
			path: atSession(endpoints.anonymousEnquiryDetails),
			handle: (_request, [, id]) =>
				isCase(id)
					? ok({
							numAvailableConsultants: 1,
							peopleAhead: 0,
							status:
								practiceCase.session.status === STATUS_ENQUIRY
									? 'NEW'
									: 'IN_PROGRESS'
						})
					: null
		},
		{
			method: 'GET',
			path: atSession(endpoints.teamDiscussion),
			handle: (_request, [, id]) =>
				isCase(id)
					? practiceCase.teamDiscussion
						? ok(
								practiceCase.teamDiscussion satisfies TeamDiscussion
							)
						: noContent()
					: null
		},
		{
			method: 'POST',
			path: atSession(endpoints.teamDiscussion),
			handle: (_request, [, id]) => {
				if (!isCase(id)) return null;
				const teamDiscussion: TeamDiscussion =
					practiceCase.teamDiscussion ?? {
						matrixRoomId: PRACTICE_TEAM_ROOM_ID,
						status:
							practiceCase.session.status === STATUS_ENQUIRY
								? 'OPEN'
								: 'ARCHIVED'
					};
				practiceCase = { ...practiceCase, teamDiscussion };
				return ok(teamDiscussion);
			}
		},
		{
			// FE#2491: read-only join of a CLOSED/ARCHIVED discussion.
			method: 'POST',
			path: atSession(
				(sessionId) => `${endpoints.teamDiscussion(sessionId)}/join`
			),
			handle: (_request, [, id]) =>
				isCase(id)
					? practiceCase.teamDiscussion
						? ok(
								practiceCase.teamDiscussion satisfies TeamDiscussion
							)
						: noContent()
					: null
		},
		{
			method: 'GET',
			path: at(
				endpoints.sessionBase,
				`/${PRACTICE_ID_SEGMENT}/supervisors`
			),
			handle: (_request, [, id]) =>
				isCase(id)
					? ok(
							practiceCase.supervisors satisfies UserService.Schemas.SessionSupervisorResponseDTO[]
						)
					: isCircle(id)
						? ok([])
						: null
		},
		{
			method: 'POST',
			path: at(
				endpoints.sessionBase,
				`/${PRACTICE_ID_SEGMENT}/supervisors`
			),
			handle: async (request, [, id]) => {
				if (!isCase(id)) return null;
				const body = await request.body();
				if (
					body?.supervisorConsultantId !== script.cast.supervisor.id
				) {
					// Only the practice supervisor exists here; nothing else is added.
					return noContent();
				}
				const supervisor: UserService.Schemas.SessionSupervisorResponseDTO =
					{
						id: -++supervisorSeq,
						sessionId: practiceCase.session.id,
						supervisorConsultantId: script.cast.supervisor.id,
						supervisorUsername: script.cast.supervisor.username,
						supervisorMatrixUserId:
							script.cast.supervisor.matrixUserId,
						addedByConsultantId: counsellor.userId,
						addedDate: new Date(now()).toISOString(),
						matrixRoomId: PRACTICE_SUPERVISION_ROOM_ID,
						notes:
							typeof body.notes === 'string' ? body.notes : null
					};
				practiceCase = {
					...practiceCase,
					supervisors: [...practiceCase.supervisors, supervisor]
				};
				hooks.onSupervisorAdded?.(supervisor);
				return ok(supervisor);
			}
		},
		{
			method: 'GET',
			path: at(endpoints.agencyConsultants),
			handle: ({ url }) =>
				Number(url.searchParams.get('agencyId')) === PRACTICE_AGENCY_ID
					? ok(
							[script.cast.colleague, script.cast.supervisor].map(
								(person) => ({
									consultantId: person.id,
									firstName: person.firstName,
									lastName: person.lastName,
									displayName: person.displayName,
									username: person.username,
									isSupervisor:
										person.id === script.cast.supervisor.id
								})
							) satisfies UserService.Schemas.ConsultantResponseDTO[]
						)
					: null
		},
		{
			method: 'GET',
			path: at(endpoints.agencyServiceBase, `/${PRACTICE_ID_SEGMENT}`),
			handle: (_request, [, id]) =>
				Number(id) === PRACTICE_AGENCY_ID
					? ok([
							{
								id: PRACTICE_AGENCY_ID,
								name: script.names.agency,
								postcode: '00000',
								city: '',
								description: '',
								teamAgency: true,
								offline: false,
								consultingType:
									practiceCase.session.consultingType
							} satisfies AgencyService.Schemas.AgencyResponseDTO
						])
					: null
		},
		// Drafts: every scope (including the shared index row) lives in memory
		// while practising, so real drafts are neither shown nor rewritten.
		{
			method: 'GET',
			path: at(endpoints.userDrafts, '/single'),
			viewWide: true,
			duringDrain: isIsolatedDraftRequest,
			handle: ({ url }) => {
				const draft = drafts.get(
					url.searchParams.get('scopeKey') || ''
				);
				return draft ? ok(draft) : noContent();
			}
		},
		{
			method: 'GET',
			path: at(endpoints.userDrafts),
			viewWide: true,
			handle: ({ url }) =>
				ok({
					items: [...drafts.values()],
					page: Number(url.searchParams.get('page') || 0),
					perPage: Number(url.searchParams.get('perPage') || 200)
				} satisfies IUserDraftFeedResponse)
		},
		{
			method: 'PATCH',
			path: at(endpoints.userDrafts),
			viewWide: true,
			duringDrain: isIsolatedDraftRequest,
			handle: async ({ url, body }) => {
				const scopeKey = url.searchParams.get('scopeKey') || '';
				drafts.set(scopeKey, { ...(await body()), scopeKey });
				return noContent();
			}
		},
		{
			method: 'DELETE',
			path: at(endpoints.userDrafts),
			viewWide: true,
			duringDrain: isIsolatedDraftRequest,
			handle: ({ url }) => {
				drafts.delete(url.searchParams.get('scopeKey') || '');
				return noContent();
			}
		},
		{
			method: 'GET',
			path: at(endpoints.eventNotifications),
			viewWide: true,
			handle: ({ url }) =>
				ok({
					items: [],
					unreadCount: 0,
					page: Number(url.searchParams.get('page') || 0),
					perPage: Number(url.searchParams.get('perPage') || 20)
				} satisfies EventNotificationFeedResponse)
		},
		{
			method: 'GET',
			path: at(endpoints.eventNotifications, '/unread-count'),
			viewWide: true,
			handle: () =>
				ok({ unreadCount: 0 } satisfies Pick<
					EventNotificationFeedResponse,
					'unreadCount'
				>)
		},
		{
			method: 'PATCH',
			path: at(endpoints.eventNotifications, '/active-view'),
			handle: async ({ body }) =>
				isPracticeRoomId((await body())?.roomId) ? noContent() : null
		},
		{
			method: 'POST',
			path: at(endpoints.eventNotifications, '/message-events'),
			handle: async ({ body }) =>
				isPracticeRoomId((await body())?.roomId) ? noContent() : null
		},
		{
			method: 'POST',
			path: atSession(endpoints.matrixSyncRegister),
			handle: (_request, [, id]) =>
				isPracticeId(id) ? noContent() : null
		},
		// Crash reports from the practice view may quote practice content.
		{
			method: 'POST',
			path: at(endpoints.error),
			viewWide: true,
			handle: () => noContent()
		},
		// Erstantwort "add e-mail": accepted and discarded, never persisted.
		{
			method: 'PUT',
			path: at(endpoints.email),
			viewWide: true,
			handle: () => noContent()
		}
	];

	return {
		async handle(input, init, options = {}) {
			const request = parseRequest(input, init);
			const block = (): never => {
				throw new PracticeBlockedRequestError({
					method: request.method,
					url: redactUrl(request.url.href),
					channel: 'fetch',
					reason: 'default-deny'
				});
			};
			for (const route of routes) {
				if (route.method !== request.method) continue;
				const match = request.url.pathname.match(route.path);
				if (!match) continue;
				if (
					route.viewWide &&
					options.practiceAddressedOnly &&
					!route.duringDrain?.(request)
				) {
					if (route.practiceOnlyWrite) block();
					continue;
				}
				const response = await route.handle(request, match);
				if (!response && route.practiceOnlyWrite) block();
				if (response) {
					served.push({
						method: request.method,
						url: request.url.href,
						status: response.status
					});
				}
				return response;
			}
			return null;
		},
		getCase: () => practiceCase,
		served,
		reset
	};
};
