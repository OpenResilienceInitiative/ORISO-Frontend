import type { UserDataInterface } from '../../globalState/interfaces';
import {
	STATUS_ACTIVE,
	STATUS_ENQUIRY
} from '../../globalState/interfaces/SessionsDataInterface';
import {
	counsellorAsSessionConsultant,
	createPracticeScenario,
	type PracticeCaseState,
	type PracticeStart
} from '../fixtures/practiceScenario';
import { PRACTICE_COUNSELLOR_MATRIX_USER_ID } from '../fixtures/practiceCast';
import {
	isPracticeId,
	isPracticeRoomId,
	PRACTICE_AGENCY_ID,
	PRACTICE_NUMERIC_ID_PATTERN,
	PRACTICE_SUPERVISION_ROOM_ID,
	PRACTICE_TEAM_ROOM_ID
} from '../practiceIds';
import type { ScriptEngine } from '../script/ScriptEngine';

export interface FakeRestHooks {
	onEnquiryAccepted?: (sessionId: number) => void;
	onSupervisorAdded?: (
		supervisor: UserService.Schemas.SessionSupervisorResponseDTO
	) => void;
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
	 * practice view is mounted, never during its teardown.
	 */
	viewWide?: true;
	handle: (
		request: ParsedRequest,
		match: RegExpMatchArray
	) => Promise<Response | null> | Response | null;
};

const ok = (body: unknown) =>
	new Response(JSON.stringify(body), {
		status: 200,
		headers: { 'Content-Type': 'application/json' }
	});
const noContent = () => new Response(null, { status: 204 });

/** Practice ids are negative; a positive id is never answered from memory. */
const PRACTICE_ID_SEGMENT = `(${PRACTICE_NUMERIC_ID_PATTERN})`;

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
	let drafts: Map<string, unknown>;
	let supervisorSeq: number;
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
		served.length = 0;
	};
	reset();

	const listItem = (): UserService.Schemas.ConsultantSessionResponseDTO => ({
		session: practiceCase.session,
		user: practiceCase.user,
		consultant: practiceCase.consultant,
		latestMessage: new Date(practiceCase.latestMessage)
	});

	const sessionList = (status: number) =>
		practiceCase.session.status === status
			? ok({
					sessions: [listItem()],
					offset: 0,
					count: 1,
					total: 1
				} satisfies UserService.Schemas.ConsultantSessionListResponseDTO)
			: noContent();

	const isCase = (id: string) =>
		Number(id) === practiceCase.session.id && isPracticeId(id);

	const routes: Route[] = [
		{
			method: 'GET',
			path: /\/service\/conversations\/consultants\/enquiries\/registered$/,
			viewWide: true,
			handle: () => sessionList(STATUS_ENQUIRY)
		},
		{
			method: 'GET',
			path: /\/service\/conversations\/consultants\/enquiries\/anonymous$/,
			viewWide: true,
			handle: () => noContent()
		},
		{
			method: 'GET',
			path: /\/service\/users\/sessions\/consultants$/,
			viewWide: true,
			handle: () => sessionList(STATUS_ACTIVE)
		},
		{
			method: 'GET',
			path: /\/service\/conversations\/consultants\/mymessages\/archive$/,
			viewWide: true,
			handle: () => noContent()
		},
		{
			method: 'GET',
			path: new RegExp(
				`/service/users/sessions/room/${PRACTICE_ID_SEGMENT}$`
			),
			handle: (_request, [, id]) =>
				isCase(id) ? ok({ sessions: [listItem()] }) : null
		},
		{
			method: 'GET',
			path: /\/service\/users\/sessions\/room$/,
			handle: ({ url }) => {
				const roomIds = (url.searchParams.get('roomIds[]') || '')
					.split(',')
					.filter(Boolean);
				if (!roomIds.length || !roomIds.every(isPracticeRoomId)) {
					return null;
				}
				return roomIds.includes(practiceCase.session.matrixRoomId)
					? ok({ sessions: [listItem()] })
					: noContent();
			}
		},
		{
			method: 'PUT',
			path: new RegExp(
				`/service/users/sessions/new/${PRACTICE_ID_SEGMENT}$`
			),
			handle: (_request, [, id]) => {
				if (!isCase(id)) return null;
				if (practiceCase.session.status === STATUS_ENQUIRY) {
					practiceCase = {
						...practiceCase,
						session: {
							...practiceCase.session,
							status: STATUS_ACTIVE,
							consultantMatrixUserId:
								PRACTICE_COUNSELLOR_MATRIX_USER_ID
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
			}
		},
		{
			method: 'GET',
			path: new RegExp(
				`/service/users/sessions/${PRACTICE_ID_SEGMENT}/team-discussion$`
			),
			handle: (_request, [, id]) =>
				isCase(id)
					? practiceCase.teamDiscussion
						? ok(practiceCase.teamDiscussion)
						: noContent()
					: null
		},
		{
			method: 'POST',
			path: new RegExp(
				`/service/users/sessions/${PRACTICE_ID_SEGMENT}/team-discussion$`
			),
			handle: (_request, [, id]) => {
				if (!isCase(id)) return null;
				if (!practiceCase.teamDiscussion) {
					practiceCase = {
						...practiceCase,
						teamDiscussion: {
							matrixRoomId: PRACTICE_TEAM_ROOM_ID,
							status:
								practiceCase.session.status === STATUS_ENQUIRY
									? 'OPEN'
									: 'ARCHIVED'
						}
					};
				}
				return ok(practiceCase.teamDiscussion);
			}
		},
		{
			method: 'GET',
			path: new RegExp(
				`/service/users/sessions/${PRACTICE_ID_SEGMENT}/supervisors$`
			),
			handle: (_request, [, id]) =>
				isCase(id) ? ok(practiceCase.supervisors) : null
		},
		{
			method: 'POST',
			path: new RegExp(
				`/service/users/sessions/${PRACTICE_ID_SEGMENT}/supervisors$`
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
			path: /\/service\/users\/consultants$/,
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
							)
						)
					: null
		},
		{
			method: 'GET',
			path: new RegExp(`/service/agencies/${PRACTICE_ID_SEGMENT}$`),
			handle: (_request, [, id]) =>
				Number(id) === PRACTICE_AGENCY_ID
					? ok({
							id: PRACTICE_AGENCY_ID,
							name: script.names.agency,
							postcode: '00000',
							city: '',
							description: '',
							teamAgency: true,
							offline: false,
							consultingType: practiceCase.session.consultingType
						} satisfies AgencyService.Schemas.AgencyResponseDTO)
					: null
		},
		// Drafts: every scope (including the shared index row) lives in memory
		// while practising, so real drafts are neither shown nor rewritten.
		{
			method: 'GET',
			path: /\/service\/users\/drafts\/single$/,
			viewWide: true,
			handle: ({ url }) => {
				const draft = drafts.get(
					url.searchParams.get('scopeKey') || ''
				);
				return draft ? ok(draft) : noContent();
			}
		},
		{
			method: 'GET',
			path: /\/service\/users\/drafts$/,
			viewWide: true,
			handle: () => ok([...drafts.values()])
		},
		{
			method: 'PATCH',
			path: /\/service\/users\/drafts$/,
			viewWide: true,
			handle: async ({ url, body }) => {
				const scopeKey = url.searchParams.get('scopeKey') || '';
				drafts.set(scopeKey, { ...(await body()), scopeKey });
				return noContent();
			}
		},
		{
			method: 'DELETE',
			path: /\/service\/users\/drafts$/,
			viewWide: true,
			handle: ({ url }) => {
				drafts.delete(url.searchParams.get('scopeKey') || '');
				return noContent();
			}
		},
		{
			method: 'GET',
			path: /\/service\/users\/event-notifications$/,
			viewWide: true,
			handle: ({ url }) =>
				ok({
					items: [],
					unreadCount: 0,
					page: Number(url.searchParams.get('page') || 0),
					perPage: Number(url.searchParams.get('perPage') || 20)
				})
		},
		{
			method: 'GET',
			path: /\/service\/users\/event-notifications\/unread-count$/,
			viewWide: true,
			handle: () => ok({ unreadCount: 0 })
		},
		{
			method: 'PATCH',
			path: /\/service\/users\/event-notifications\/active-view$/,
			handle: async ({ body }) =>
				isPracticeRoomId((await body())?.roomId) ? noContent() : null
		},
		{
			method: 'POST',
			path: /\/service\/users\/event-notifications\/message-events$/,
			handle: async ({ body }) =>
				isPracticeRoomId((await body())?.roomId) ? noContent() : null
		},
		{
			method: 'POST',
			path: new RegExp(
				`/service/matrix/sync/register/${PRACTICE_ID_SEGMENT}$`
			),
			handle: (_request, [, id]) =>
				isPracticeId(id) ? noContent() : null
		},
		// Crash reports from the practice view may quote practice content.
		{
			method: 'POST',
			path: /\/service\/error-reports$/,
			viewWide: true,
			handle: () => noContent()
		},
		// Erstantwort "add e-mail": accepted and discarded, never persisted.
		{
			method: 'PUT',
			path: /\/service\/users\/email$/,
			viewWide: true,
			handle: () => noContent()
		}
	];

	return {
		async handle(input, init, options = {}) {
			const request = parseRequest(input, init);
			for (const route of routes) {
				if (route.method !== request.method) continue;
				if (route.viewWide && options.practiceAddressedOnly) continue;
				const match = request.url.pathname.match(route.path);
				if (!match) continue;
				const response = await route.handle(request, match);
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
