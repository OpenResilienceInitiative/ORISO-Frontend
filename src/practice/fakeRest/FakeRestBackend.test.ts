// @vitest-environment oriso-jsdom
import { describe, expect, it, vi } from 'vite-plus/test';
import { endpoints } from '../../resources/scripts/endpoints';
import { createFakeRestBackend } from './FakeRestBackend';
import { practiceCounsellorFixture } from '../fixtures/practiceCounsellorFixture';
import {
	PRACTICE_AGENCY_ID,
	PRACTICE_CIRCLE_CHAT_ID,
	PRACTICE_COLLEAGUE_ROOM_ID,
	PRACTICE_COLLEAGUE_SESSION_ID,
	PRACTICE_CIRCLE_ROOM_ID,
	PRACTICE_ENQUIRY_SESSION_ID,
	PRACTICE_TOPIC_ID,
	PRACTICE_MAIN_ROOM_ID,
	PRACTICE_SUPERVISION_ROOM_ID,
	PRACTICE_TEAM_ROOM_ID
} from '../practiceIds';
import { createTestScript } from '../script/scriptTestSupport';
import { CASE_HANDOVER_REASON_CODES } from '../../components/caseHandover/caseHandoverReasons';

const ID = PRACTICE_ENQUIRY_SESSION_ID;
const script = createTestScript('de');
const registeredFeed = `${endpoints.consultantEnquiriesBase}registered?count=15&filter=all&offset=0`;
const mySessions = `${endpoints.consultantSessions}count=15&filter=all&offset=0`;

const json = async (response: Response | null) => {
	expect(response).not.toBeNull();
	expect(response!.status).toBe(200);
	return response!.json();
};
const send = (url: string, method: string, body?: unknown) =>
	new Request(url, {
		method,
		headers: { 'Content-Type': 'application/json' },
		body: body === undefined ? undefined : JSON.stringify(body)
	});
const backendFor = (
	options: Partial<Parameters<typeof createFakeRestBackend>[0]> = {}
) =>
	createFakeRestBackend({
		counsellor: practiceCounsellorFixture(),
		script,
		...options
	});

describe('FakeRestBackend', () => {
	it('returns the public agency list contract for the reserved practice agency', async () => {
		const backend = backendFor();
		const response = await json(
			await backend.handle(
				new Request(
					`${endpoints.agencyServiceBase}/${PRACTICE_AGENCY_ID}`
				)
			)
		);
		expect(response).toEqual([
			expect.objectContaining({ id: PRACTICE_AGENCY_ID })
		]);
	});

	it('serves only the practice enquiry in the registered enquiry feed', async () => {
		const backend = backendFor();

		const body: UserService.Schemas.ConsultantSessionListResponseDTO =
			await json(await backend.handle(new Request(registeredFeed)));

		expect(body.sessions).toHaveLength(1);
		expect(body.sessions[0].session).toMatchObject({
			id: PRACTICE_ENQUIRY_SESSION_ID,
			status: 1,
			matrixRoomId: PRACTICE_MAIN_ROOM_ID
		});
		expect(body.sessions[0].user?.displayName).toBe(
			script.cast.asker.displayName
		);
	});

	it('passes real ids and unknown endpoints on instead of answering them', async () => {
		const backend = backendFor();

		for (const request of [
			new Request(`${endpoints.sessionRooms}/4711`),
			send(`${endpoints.sessionBase}/new/4711`, 'PUT'),
			send(endpoints.teamDiscussion(4711), 'POST'),
			new Request(`${endpoints.agencyConsultants}?agencyId=4711`),
			new Request(`${endpoints.sessionRooms}?roomIds[]=!real:matrix.org`),
			send(`${endpoints.eventNotifications}/active-view`, 'PATCH', {
				roomId: '!real:matrix.org',
				active: true
			}),
			new Request(endpoints.userData),
			send(endpoints.tutorialProgress, 'PUT', { tourId: 'x' })
		]) {
			expect(await backend.handle(request), request.url).toBeNull();
		}
		expect(backend.served).toHaveLength(0);
	});

	it.each(['-01', '-1.0', '-0'])(
		'does not take the non-canonical id %j for the practice case',
		async (id) => {
			const backend = backendFor();

			expect(
				await backend.handle(
					new Request(`${endpoints.sessionRooms}/${id}`)
				)
			).toBeNull();
			expect(
				await backend.handle(
					send(`${endpoints.sessionBase}/new/${id}`, 'PUT')
				)
			).toBeNull();
			expect(backend.getCase().session.status).toBe(1);
		}
	);

	it('accepts the enquiry in memory: the case moves from the enquiry feed to the counsellor sessions', async () => {
		const onEnquiryAccepted = vi.fn();
		const counsellor = practiceCounsellorFixture();
		const backend = backendFor({
			counsellor,
			hooks: { onEnquiryAccepted }
		});

		const accepted = await backend.handle(
			send(`${endpoints.sessionBase}/new/${ID}`, 'PUT')
		);

		expect(accepted?.status).toBe(204);
		expect(onEnquiryAccepted).toHaveBeenCalledWith(ID);
		expect(
			(await backend.handle(new Request(registeredFeed)))?.status
		).toBe(204);
		const sessions: UserService.Schemas.ConsultantSessionListResponseDTO =
			await json(await backend.handle(new Request(mySessions)));
		expect(sessions.sessions[0].session?.status).toBe(2);
		expect(sessions.sessions[0].consultant?.id).toBe(counsellor.userId);
		const room = await json(
			await backend.handle(new Request(`${endpoints.sessionRooms}/${ID}`))
		);
		expect(room.sessions[0].session.status).toBe(2);
	});

	it('opens the team discussion on the enquiry and archives it at accept', async () => {
		const backend = backendFor();
		const teamUrl = endpoints.teamDiscussion(ID);

		expect((await backend.handle(new Request(teamUrl)))?.status).toBe(204);
		expect(await json(await backend.handle(send(teamUrl, 'POST')))).toEqual(
			{ matrixRoomId: PRACTICE_TEAM_ROOM_ID, status: 'OPEN' }
		);
		await backend.handle(send(`${endpoints.sessionBase}/new/${ID}`, 'PUT'));

		expect(await json(await backend.handle(new Request(teamUrl)))).toEqual({
			matrixRoomId: PRACTICE_TEAM_ROOM_ID,
			status: 'ARCHIVED'
		});
	});

	it('lists the practice supervisor in the picker and adds it with the supervision side room', async () => {
		const onSupervisorAdded = vi.fn();
		const backend = backendFor({
			start: 'acceptedCase',
			hooks: { onSupervisorAdded }
		});
		const supervisorsUrl = `${endpoints.sessionBase}/${ID}/supervisors`;

		const picker = await json(
			await backend.handle(
				new Request(
					`${endpoints.agencyConsultants}?agencyId=${PRACTICE_AGENCY_ID}`
				)
			)
		);
		expect(
			picker.filter((consultant: any) => consultant.isSupervisor)
		).toEqual([
			expect.objectContaining({
				consultantId: script.cast.supervisor.id,
				displayName: script.cast.supervisor.displayName
			})
		]);
		expect(
			await json(await backend.handle(new Request(supervisorsUrl)))
		).toEqual([]);

		await json(
			await backend.handle(
				send(supervisorsUrl, 'POST', {
					supervisorConsultantId: script.cast.supervisor.id,
					notes: 'Bitte mitlesen'
				})
			)
		);

		const supervisors = await json(
			await backend.handle(new Request(supervisorsUrl))
		);
		expect(supervisors).toEqual([
			expect.objectContaining({
				supervisorConsultantId: script.cast.supervisor.id,
				matrixRoomId: PRACTICE_SUPERVISION_ROOM_ID
			})
		]);
		expect(supervisors[0].id).toBeLessThan(0);
		expect(onSupervisorAdded).toHaveBeenCalledWith(supervisors[0]);
	});

	it('starts the supervision flow from an already accepted case', async () => {
		const backend = backendFor({ start: 'acceptedCase' });

		const sessions = await json(
			await backend.handle(new Request(mySessions))
		);

		expect(sessions.sessions[0].session.status).toBe(2);
		expect(
			(await backend.handle(new Request(registeredFeed)))?.status
		).toBe(204);
	});

	it('keeps drafts in memory and discards the Erstantwort e-mail', async () => {
		const backend = backendFor();
		const scope = encodeURIComponent(
			`scope:${PRACTICE_MAIN_ROOM_ID}|thread:main`
		);

		await backend.handle(
			send(`${endpoints.userDrafts}?scopeKey=${scope}`, 'PATCH', {
				text: 'Entwurf'
			})
		);
		expect(
			await json(
				await backend.handle(
					new Request(
						`${endpoints.userDrafts}/single?scopeKey=${scope}`
					)
				)
			)
		).toMatchObject({ text: 'Entwurf' });
		// The drafts list and the timeline read `items` (IUserDraftFeedResponse).
		expect(
			await json(
				await backend.handle(
					new Request(`${endpoints.userDrafts}?page=0&perPage=200`)
				)
			)
		).toMatchObject({
			items: [expect.objectContaining({ text: 'Entwurf' })],
			page: 0,
			perPage: 200
		});
		expect(
			(
				await backend.handle(
					send(endpoints.email, 'PUT', { email: 'real@example.org' })
				)
			)?.status
		).toBe(204);
		expect(JSON.stringify(backend.getCase())).not.toContain(
			'real@example.org'
		);
	});

	it('lets a newly mounted real view read its own drafts while practice cleanup drains', async () => {
		const backend = backendFor();
		for (const url of [
			`${endpoints.userDrafts}/single?scopeKey=${encodeURIComponent('scope:!real:matrix.org|thread:main')}`,
			`${endpoints.userDrafts}/single?scopeKey=${encodeURIComponent('scope:4711|thread:main')}`,
			`${endpoints.userDrafts}?page=0&perPage=200`
		]) {
			expect(
				await backend.handle(new Request(url), undefined, {
					practiceAddressedOnly: true
				})
			).toBeNull();
		}
	});

	it('answers every practice request with 2xx and restarts from fresh fixtures', async () => {
		const backend = backendFor();
		await backend.handle(send(`${endpoints.sessionBase}/new/${ID}`, 'PUT'));
		await backend.handle(
			new Request(`${endpoints.eventNotifications}?page=0`)
		);
		await backend.handle(
			send(`${endpoints.eventNotifications}/message-events`, 'POST', {
				roomId: PRACTICE_MAIN_ROOM_ID
			})
		);
		await backend.handle(send(endpoints.error, 'POST', { error: {} }));

		expect(backend.served.length).toBeGreaterThan(0);
		expect(
			backend.served.every(({ status }) => status >= 200 && status < 300)
		).toBe(true);

		backend.reset();

		expect(backend.getCase().session.status).toBe(1);
		expect(backend.served).toHaveLength(0);
	});
});

describe('FakeRestBackend: the practice Gesprächskreis (FE#2545)', () => {
	const circlePayload = {
		topic: 'Übung',
		startDate: '2026-11-25',
		startTime: '10:00',
		duration: 60,
		agencyId: 4711,
		hintMessage: 'Willkommen',
		repetitive: true,
		repeatCount: 1,
		chatInterval: 'WEEKLY',
		modality: 'TEXT',
		timezone: 'Europe/Berlin',
		consultantIds: []
	};
	const roomsOf = (roomId: string) =>
		`${endpoints.sessionRooms}?${new URLSearchParams({
			'roomIds[]': roomId
		})}`;
	const create = (backend: ReturnType<typeof backendFor>, v2 = true) =>
		backend.handle(
			send(
				`${endpoints.groupChatBase}${v2 ? 'v2/new' : 'new'}`,
				'POST',
				circlePayload
			)
		);

	it('offers only the practice topic and the practice colleagues', async () => {
		const backend = backendFor({ start: 'groupCircle' });

		const topics = await json(
			await backend.handle(new Request(endpoints.agencyTopics))
		);
		expect(topics).toEqual([
			expect.objectContaining({
				id: PRACTICE_TOPIC_ID,
				name: script.names.topic
			})
		]);
		const consultants = await json(
			await backend.handle(
				new Request(`${endpoints.chatSeriesBase}consultants`)
			)
		);
		expect(
			consultants.map((c: { consultantId: string }) => c.consultantId)
		).toEqual([script.cast.colleague.id]);
	});

	it.each([true, false])(
		'creates the circle in memory (v2 %s) and lists it in the counsellor sessions',
		async (v2) => {
			const onCircleCreated = vi.fn();
			const backend = backendFor({
				start: 'groupCircle',
				hooks: { onCircleCreated }
			});
			expect(
				(await backend.handle(new Request(mySessions)))?.status
			).toBe(204);

			const created = await json(await create(backend, v2));

			expect(created).toEqual({ matrixRoomId: PRACTICE_CIRCLE_ROOM_ID });
			expect(onCircleCreated).toHaveBeenCalledWith(
				PRACTICE_CIRCLE_CHAT_ID
			);
			const list = await json(
				await backend.handle(new Request(mySessions))
			);
			expect(list.sessions).toHaveLength(1);
			expect(list.sessions[0].chat).toMatchObject({
				id: PRACTICE_CIRCLE_CHAT_ID,
				matrixRoomId: PRACTICE_CIRCLE_ROOM_ID,
				topic: 'Übung',
				active: false,
				subscribed: false,
				// The practice circle meets by video: its start is a video start.
				modality: 'VIDEO'
			});
		}
	);

	it('lists the circle as the counsellor own, so the list shows it before anyone joined', async () => {
		const backend = backendFor({ start: 'groupCircle' });
		await create(backend);

		const list = await json(await backend.handle(new Request(mySessions)));

		expect(list.sessions[0].consultant?.id).toBe(
			practiceCounsellorFixture().userId
		);
	});

	it('offers only the practice colleague to the create screen picker', async () => {
		const backend = backendFor({ start: 'groupCircle' });

		const recipients = await json(
			await backend.handle(
				new Request(
					`${endpoints.internalSubsetChat}/recipients?agencyId=4711`
				)
			)
		);

		expect(recipients).toEqual([
			expect.objectContaining({
				consultantId: script.cast.colleague.id,
				agencies: [expect.objectContaining({ id: PRACTICE_AGENCY_ID })]
			})
		]);
	});

	it('answers the circle card and waiting-room reads: members, no dates, no supervisors', async () => {
		const backend = backendFor({ start: 'groupCircle' });
		await create(backend);

		const members = await json(
			await backend.handle(
				new Request(
					`${endpoints.groupChatBase}${PRACTICE_CIRCLE_CHAT_ID}/members`
				)
			)
		);
		expect(members.members).toEqual([
			expect.objectContaining({
				userId: practiceCounsellorFixture().userId,
				role: 'CONSULTANT'
			})
		]);
		expect(
			await json(
				await backend.handle(
					new Request(
						`${endpoints.chatSeriesBase}${PRACTICE_CIRCLE_CHAT_ID}/occurrences?limit=1`
					)
				)
			)
		).toEqual([]);
		expect(
			await json(
				await backend.handle(
					new Request(
						`${endpoints.sessionBase}/${PRACTICE_CIRCLE_CHAT_ID}/supervisors`
					)
				)
			)
		).toEqual([]);
	});

	it('reads the created circle by room, by chat id and as group info, without an invite token', async () => {
		const backend = backendFor({ start: 'groupCircle' });
		await create(backend);

		const byRoom = await json(
			await backend.handle(new Request(roomsOf(PRACTICE_CIRCLE_ROOM_ID)))
		);
		expect(byRoom.sessions[0].chat.id).toBe(PRACTICE_CIRCLE_CHAT_ID);
		// No token, no share dialog: the create flow leaves for the list.
		expect(byRoom.sessions[0].chat).not.toHaveProperty('inviteToken');
		const byId = await json(
			await backend.handle(
				new Request(`${endpoints.chatRoom}/${PRACTICE_CIRCLE_CHAT_ID}`)
			)
		);
		expect(byId.sessions[0].chat.matrixRoomId).toBe(
			PRACTICE_CIRCLE_ROOM_ID
		);
		const info = await json(
			await backend.handle(
				new Request(
					`${endpoints.groupChatBase}${PRACTICE_CIRCLE_CHAT_ID}`
				)
			)
		);
		expect(info).toEqual({
			id: PRACTICE_CIRCLE_CHAT_ID,
			active: false,
			matrixRoomId: PRACTICE_CIRCLE_ROOM_ID,
			bannedUsers: []
		});
	});

	it('starts the circle in memory: active, and the counsellor is in its room', async () => {
		const onCircleStarted = vi.fn();
		const backend = backendFor({
			start: 'groupCircle',
			hooks: { onCircleStarted }
		});
		await create(backend);

		const started = await backend.handle(
			send(
				`${endpoints.groupChatBase}${PRACTICE_CIRCLE_CHAT_ID}/start`,
				'PUT'
			)
		);

		expect(started?.status).toBe(204);
		expect(onCircleStarted).toHaveBeenCalledWith(PRACTICE_CIRCLE_CHAT_ID);
		const byRoom = await json(
			await backend.handle(new Request(roomsOf(PRACTICE_CIRCLE_ROOM_ID)))
		);
		expect(byRoom.sessions[0].chat).toMatchObject({
			active: true,
			subscribed: true
		});
	});

	it('knows no circle before it was created, and none after a reset', async () => {
		const backend = backendFor({ start: 'groupCircle' });
		const missing = async () => {
			expect(
				await backend.handle(
					send(
						`${endpoints.groupChatBase}${PRACTICE_CIRCLE_CHAT_ID}/start`,
						'PUT'
					)
				)
			).toBeNull();
			expect(
				(
					await backend.handle(
						new Request(roomsOf(PRACTICE_CIRCLE_ROOM_ID))
					)
				)?.status
			).toBe(204);
		};
		await missing();
		await create(backend);
		backend.reset();
		await missing();
	});

	it('passes real group chats on', async () => {
		const backend = backendFor({ start: 'groupCircle' });
		await create(backend);
		expect(
			await backend.handle(
				send(`${endpoints.groupChatBase}4711/start`, 'PUT')
			)
		).toBeNull();
		expect(
			await backend.handle(new Request(`${endpoints.groupChatBase}4711`))
		).toBeNull();
		expect(
			await backend.handle(new Request(`${endpoints.chatRoom}/4711`))
		).toBeNull();
	});
});

describe('FakeRestBackend: the practice calendar (FE#2545)', () => {
	const calendar = endpoints.calendarBase;
	const appointments = endpoints.sessionAppointments(ID);
	const slot = {
		startTime: '2026-11-26T09:00:00.000Z',
		endTime: '2026-11-26T10:00:00.000Z',
		kind: 'VIDEO'
	};
	const week = `from=${encodeURIComponent('2026-11-23T00:00:00.000Z')}&to=${encodeURIComponent('2026-11-30T00:00:00.000Z')}`;
	const accepted = (hooks = {}) =>
		backendFor({ start: 'acceptedCase', hooks });

	it('answers every read of the calendar page from memory, never with real data', async () => {
		const backend = accepted();
		const read = (url: string) =>
			backend.handle(new Request(url)).then(json);

		expect(await read(`${calendar}/entries?${week}`)).toEqual([]);
		expect(await read(`${calendar}/colleagues`)).toMatchObject({
			colleagues: []
		});
		expect(await read(`${calendar}/auto-accept`)).toEqual({
			colleagueIds: []
		});
		expect(await read(`${calendar}/sync`)).toEqual({
			feedUrl: '',
			importConfigured: false
		});
		expect(await read(`${calendar}/consultation-hours`)).toMatchObject({
			autoAccept: false
		});
		expect(await read(`${calendar}/consultation-hours/once`)).toEqual([]);
		expect((await read(`${calendar}/working-hours`)).windows).toHaveLength(
			5
		);
		expect(await read(`${calendar}/proposals`)).toEqual({
			sent: [],
			received: []
		});
		expect(await read(endpoints.directLinks)).toEqual([]);
		expect(await read(endpoints.upcomingAppointments)).toEqual([]);
	});

	it('enters, moves and cancels an appointment of the practice conversation, and tells the run', async () => {
		const onAppointmentCreated = vi.fn();
		const onAppointmentCancelled = vi.fn();
		const backend = accepted({
			onAppointmentCreated,
			onAppointmentCancelled
		});

		const created = await json(
			await backend.handle(send(appointments, 'POST', slot))
		);
		expect(created).toMatchObject({
			sessionId: ID,
			startTime: slot.startTime,
			status: 'SCHEDULED',
			kind: 'VIDEO'
		});
		expect(created.id).toMatch(/^practice-appointment-/);
		expect(onAppointmentCreated).toHaveBeenCalledWith(created.id);

		const [entry] = await json(
			await backend.handle(new Request(`${calendar}/entries?${week}`))
		);
		expect(entry).toMatchObject({
			id: created.id,
			type: 'APPOINTMENT',
			sessionId: ID,
			title: script.cast.asker.username
		});
		// Outside the range: not listed.
		expect(
			await json(
				await backend.handle(
					new Request(
						`${calendar}/entries?from=${encodeURIComponent('2026-12-01T00:00:00.000Z')}&to=${encodeURIComponent('2026-12-08T00:00:00.000Z')}`
					)
				)
			)
		).toEqual([]);

		const moved = await json(
			await backend.handle(
				send(`${appointments}/${created.id}`, 'PUT', {
					startTime: '2026-11-27T09:00:00.000Z',
					endTime: '2026-11-27T10:00:00.000Z'
				})
			)
		);
		expect(moved.startTime).toBe('2026-11-27T09:00:00.000Z');

		await json(
			await backend.handle(
				send(`${appointments}/${created.id}/cancel`, 'POST')
			)
		);
		expect(onAppointmentCancelled).toHaveBeenCalledWith(created.id);
		expect(
			await json(
				await backend.handle(new Request(`${calendar}/entries?${week}`))
			)
		).toEqual([]);
	});

	it('makes a Terminlink for a practice appointment that leads nowhere', async () => {
		const onInvitationCreated = vi.fn();
		const backend = accepted({ onInvitationCreated });
		const { id } = await json(
			await backend.handle(send(appointments, 'POST', slot))
		);

		const link = await json(
			await backend.handle(
				send(endpoints.sessionDirectInvitations(ID), 'POST', {
					appointmentId: id,
					medium: 'VIDEO',
					validityAfterEndMinutes: 60,
					accessMode: 'GUESTS_ONLY',
					knock: true
				})
			)
		);
		expect(link).toMatchObject({
			medium: 'VIDEO',
			sessionId: ID,
			accessMode: 'GUESTS_ONLY',
			appointment: { id, startTime: slot.startTime }
		});
		expect(new URL(link.url).hostname).toBe('practice.invalid');
		expect(onInvitationCreated).toHaveBeenCalledWith(id);

		// Not for an appointment it does not hold.
		const none = await backend.handle(
			send(endpoints.sessionDirectInvitations(ID), 'POST', {
				appointmentId: 'practice-appointment-99'
			})
		);
		expect(none?.status).toBe(204);
		expect(onInvitationCreated).toHaveBeenCalledTimes(1);
	});

	it('enters and removes a Sperrzeit in memory', async () => {
		const onBlockerCreated = vi.fn();
		const backend = accepted({ onBlockerCreated });
		const [blocker] = await json(
			await backend.handle(
				send(`${calendar}/blockers`, 'POST', {
					start: '2026-11-26T12:00:00.000Z',
					end: '2026-11-26T13:00:00.000Z'
				})
			)
		);
		expect(blocker).toMatchObject({ type: 'BLOCKER', allDay: false });
		expect(blocker.id).toMatch(/^practice-blocker-/);
		expect(onBlockerCreated).toHaveBeenCalledWith(blocker.id);

		const removed = await backend.handle(
			send(`${calendar}/blockers/${blocker.id}`, 'DELETE')
		);
		expect(removed?.status).toBe(204);
		expect(
			await json(
				await backend.handle(new Request(`${calendar}/entries?${week}`))
			)
		).toEqual([]);
	});

	it('tells the run once automatic confirmation is switched on in the Sprechstunden', async () => {
		const onAutoAcceptOn = vi.fn();
		const backend = accepted({ onAutoAcceptOn });
		const hours = {
			windows: [{ weekday: 2, start: '10:00', end: '12:00' }],
			noticeDays: 1,
			slotMinutes: 60
		};

		await backend.handle(
			send(`${calendar}/consultation-hours`, 'PUT', {
				...hours,
				autoAccept: false
			})
		);
		expect(onAutoAcceptOn).not.toHaveBeenCalled();
		const saved = await json(
			await backend.handle(
				send(`${calendar}/consultation-hours`, 'PUT', {
					...hours,
					autoAccept: true
				})
			)
		);
		expect(saved.autoAccept).toBe(true);
		expect(onAutoAcceptOn).toHaveBeenCalledTimes(1);
		expect(
			await json(
				await backend.handle(
					new Request(`${calendar}/consultation-hours`)
				)
			)
		).toMatchObject({ autoAccept: true });
	});

	it('passes real ids on: a real conversation, blocker or appointment is never answered', async () => {
		const backend = accepted();
		for (const request of [
			send(endpoints.sessionAppointments(4711), 'POST', slot),
			send(`${appointments}/a-real-one/cancel`, 'POST'),
			send(`${calendar}/blockers/4711`, 'DELETE'),
			send(endpoints.sessionDirectInvitations(4711), 'POST', {})
		]) {
			expect(await backend.handle(request)).toBeNull();
		}
	});

	it('starts empty again on reset', async () => {
		const backend = accepted();
		await backend.handle(send(appointments, 'POST', slot));
		backend.reset();
		expect(
			await json(
				await backend.handle(new Request(`${calendar}/entries?${week}`))
			)
		).toEqual([]);
	});
});

describe('FakeRestBackend: "Fälle übergeben" (FE#2545)', () => {
	const sessionBase = endpoints.sessionBase;
	const own = `${sessionBase}/${ID}/case-handover`;
	const colleagueCase = `${sessionBase}/${PRACTICE_COLLEAGUE_SESSION_ID}/case-handover`;
	const search = (query: string) =>
		`${endpoints.caseHandoverCandidates}?query=${encodeURIComponent(query)}&offset=0&count=15`;
	const reason = CASE_HANDOVER_REASON_CODES[0];
	const toAlex = () => ({
		targetConsultantId: script.cast.colleague.id,
		reasonCode: reason
	});
	const accepted = (hooks = {}) =>
		backendFor({ start: 'acceptedCase', hooks });

	it('answers the case-handover search and the reasons in memory: real colleagues never show while practising', async () => {
		const onColleagueCaseFound = vi.fn();
		const backend = accepted({ onColleagueCaseFound });

		const roster = await json(
			await backend.handle(new Request(search('')))
		);
		expect(roster.sessions).toHaveLength(1);
		expect(onColleagueCaseFound).not.toHaveBeenCalled();

		const found = await json(
			await backend.handle(new Request(search('Alex')))
		);
		expect(found.sessions).toEqual([
			expect.objectContaining({
				session: expect.objectContaining({
					id: PRACTICE_COLLEAGUE_SESSION_ID,
					matrixRoomId: PRACTICE_COLLEAGUE_ROOM_ID
				}),
				consultant: expect.objectContaining({
					id: script.cast.colleague.id
				}),
				caseHandoverStatus: {
					status: 'NOT_REQUESTED',
					canViewContent: false,
					hasRequest: false
				}
			})
		]);
		expect(onColleagueCaseFound).toHaveBeenCalledOnce();

		expect(
			(await json(await backend.handle(new Request(search('Zorro')))))
				.sessions
		).toEqual([]);
		expect(
			(
				await json(
					await backend.handle(
						new Request(`${search('Alex')}&archived=true`)
					)
				)
			).sessions
		).toEqual([]);

		const reasons = await json(
			await backend.handle(new Request(endpoints.caseHandoverReasons))
		);
		expect(reasons.map((r: { code: string }) => r.code)).toEqual([
			...CASE_HANDOVER_REASON_CODES
		]);
		expect(
			reasons.every(
				(r: { clientConsentRequired: boolean }) =>
					!r.clientConsentRequired
			)
		).toBe(true);
	});

	it('offers the own case to Alex only, and withdraws the offer in memory', async () => {
		const onCaseHandoverOffered = vi.fn();
		const backend = accepted({ onCaseHandoverOffered });

		expect(
			await json(await backend.handle(new Request(`${own}/recipients`)))
		).toEqual([
			{
				consultantId: script.cast.colleague.id,
				displayName: script.cast.colleague.displayName
			}
		]);
		expect(
			(
				await backend.handle(
					send(`${own}/offers`, 'POST', {
						targetConsultantId: 'a-real-colleague',
						reasonCode: reason
					})
				)
			)?.status
		).toBe(204);
		expect(onCaseHandoverOffered).not.toHaveBeenCalled();

		const offer = await json(
			await backend.handle(send(`${own}/offers`, 'POST', toAlex()))
		);
		expect(offer).toMatchObject({
			status: 'PENDING_RECIPIENT_ACCEPTANCE',
			direction: 'PUSH',
			canViewContent: true
		});
		expect(offer.requestId).toBeLessThan(0);
		expect(onCaseHandoverOffered).toHaveBeenCalledWith(offer.requestId);
		expect(
			(await json(await backend.handle(new Request(own)))).openOffer
		).toEqual(offer);
		expect(
			await json(
				await backend.handle(new Request(`${own}/${offer.requestId}`))
			)
		).toEqual(offer);

		expect(
			await json(
				await backend.handle(
					send(`${own}/${offer.requestId}/withdraw`, 'POST')
				)
			)
		).toMatchObject({ status: 'WITHDRAWN' });
		expect(
			(await json(await backend.handle(new Request(own)))).openOffer
		).toBeNull();
	});

	it('requests access to the colleague case once, with a reason and a text', async () => {
		const onCaseHandoverRequested = vi.fn();
		const backend = accepted({ onCaseHandoverRequested });

		expect(
			await json(await backend.handle(new Request(colleagueCase)))
		).toMatchObject({ status: 'NOT_REQUESTED', canViewContent: false });
		expect(
			(
				await backend.handle(
					send(colleagueCase, 'POST', {
						reasonCode: reason,
						explanation: '  '
					})
				)
			)?.status
		).toBe(204);

		const body = { reasonCode: reason, explanation: 'Ich vertrete Alex.' };
		const request = await json(
			await backend.handle(send(colleagueCase, 'POST', body))
		);
		expect(request).toMatchObject({
			status: 'PENDING',
			direction: 'PULL',
			canViewContent: false
		});
		await backend.handle(send(colleagueCase, 'POST', body));
		expect(onCaseHandoverRequested).toHaveBeenCalledOnce();
		expect(
			await json(await backend.handle(new Request(colleagueCase)))
		).toEqual(request);
		expect(
			(await json(await backend.handle(new Request(search('Alex')))))
				.sessions[0].caseHandoverStatus
		).toEqual({
			status: 'PENDING',
			canViewContent: false,
			hasRequest: true
		});

		// The own case cannot be "requested", the colleague case not offered.
		expect(await backend.handle(send(own, 'POST', body))).toBeNull();
		expect(
			await backend.handle(
				send(`${colleagueCase}/offers`, 'POST', toAlex())
			)
		).toBeNull();
	});

	it('opens the colleague case by its id and its room, without joining the own list', async () => {
		const backend = accepted();
		const mine = await json(await backend.handle(new Request(mySessions)));
		expect(
			mine.sessions.map((s: { session: { id: number } }) => s.session.id)
		).not.toContain(PRACTICE_COLLEAGUE_SESSION_ID);
		const byRoom = await json(
			await backend.handle(
				new Request(
					`${endpoints.sessionRooms}?roomIds[]=${encodeURIComponent(PRACTICE_COLLEAGUE_ROOM_ID)}`
				)
			)
		);
		const byId = await json(
			await backend.handle(
				new Request(
					`${endpoints.sessionRooms}/${PRACTICE_COLLEAGUE_SESSION_ID}`
				)
			)
		);
		[byRoom, byId].forEach((list) =>
			expect(list.sessions[0].session.id).toBe(
				PRACTICE_COLLEAGUE_SESSION_ID
			)
		);
	});

	it('forgets the offer and the request on reset', async () => {
		const backend = accepted();
		await backend.handle(send(`${own}/offers`, 'POST', toAlex()));
		await backend.handle(
			send(colleagueCase, 'POST', {
				reasonCode: reason,
				explanation: 'Ich vertrete Alex.'
			})
		);
		backend.reset();
		expect(
			(await json(await backend.handle(new Request(own)))).openOffer
		).toBeFalsy();
		expect(
			await json(await backend.handle(new Request(colleagueCase)))
		).toMatchObject({ status: 'NOT_REQUESTED' });
	});

	it('passes real case-handover requests on', async () => {
		const backend = accepted();
		expect(
			await backend.handle(
				new Request(`${sessionBase}/4711/case-handover`)
			)
		).toBeNull();
		expect(
			await backend.handle(
				send(`${sessionBase}/4711/case-handover/offers`, 'POST', {})
			)
		).toBeNull();
	});
});
