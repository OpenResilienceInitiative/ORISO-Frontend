// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { endpoints } from '../../resources/scripts/endpoints';
import { createFakeRestBackend } from './FakeRestBackend';
import { practiceCounsellorFixture } from '../fixtures/practiceCounsellorFixture';
import {
	PRACTICE_AGENCY_ID,
	PRACTICE_ENQUIRY_SESSION_ID,
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
