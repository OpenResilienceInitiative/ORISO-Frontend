// @vitest-environment oriso-jsdom
import { describe, expect, it, vi } from 'vite-plus/test';
import { endpoints } from '../../resources/scripts/endpoints';
import { createFakeRestBackend } from './FakeRestBackend';
import { practiceCounsellorFixture } from '../fixtures/practiceCounsellorFixture';
import {
	PRACTICE_AGENCY_ID,
	PRACTICE_CIRCLE_CHAT_ID,
	PRACTICE_CIRCLE_ROOM_ID,
	PRACTICE_ENQUIRY_SESSION_ID,
	PRACTICE_TOPIC_ID,
	PRACTICE_MAIN_ROOM_ID,
	PRACTICE_SUPERVISION_ROOM_ID,
	PRACTICE_TEAM_ROOM_ID
} from '../practiceIds';
import { createTestScript } from '../script/scriptTestSupport';

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
