// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { createPracticeWorld, type PracticeWorld } from './practiceWorld';
import { practiceCounsellorFixture } from './fixtures/practiceCounsellorFixture';
import {
	PRACTICE_ENQUIRY_SESSION_ID,
	PRACTICE_MAIN_ROOM_ID,
	PRACTICE_SUPERVISION_ROOM_ID,
	PRACTICE_TEAM_ROOM_ID
} from './fixtures/practiceIdentifiers';
import { SYSTEM_NOTIFICATION_PREFIX } from '../components/message/messageConstants';
import { subscribeToTourEvent } from '../components/productTour/tourEvents';
import { PRACTICE_TOUR_EVENTS } from './practiceTourEvents';
import { endpoints } from '../resources/scripts/endpoints';
import {
	createTestScript,
	type PracticeScriptLocale
} from './script/scriptTestSupport';

const flush = () => new Promise<void>((resolve) => queueMicrotask(resolve));

const worldIn = (
	locale: PracticeScriptLocale = 'de',
	start: 'enquiry' | 'acceptedCase' = 'enquiry'
) =>
	createPracticeWorld({
		counsellor: practiceCounsellorFixture(),
		script: createTestScript(locale),
		start
	});

const send = (url: string, method: string, body?: unknown) =>
	new Request(url, {
		method,
		headers: { 'Content-Type': 'application/json' },
		body: body === undefined ? undefined : JSON.stringify(body)
	});

const accept = (world: PracticeWorld) =>
	world.rest.handle(
		send(
			`${endpoints.sessionBase}/new/${PRACTICE_ENQUIRY_SESSION_ID}`,
			'PUT'
		)
	);

const addSupervisor = (
	world: PracticeWorld,
	supervisorConsultantId = world.script.cast.supervisor.id
) =>
	world.rest.handle(
		send(
			`${endpoints.sessionBase}/${PRACTICE_ENQUIRY_SESSION_ID}/supervisors`,
			'POST',
			{ supervisorConsultantId }
		)
	);

const acceptedWorld = async (locale: PracticeScriptLocale = 'de') => {
	const world = worldIn(locale);
	await accept(world);
	return world;
};

const bodiesFrom = (world: PracticeWorld, roomId: string, sender: string) =>
	world.matrix
		.getRoomMessages(roomId)
		.filter((event) => event.getSender() === sender)
		.map((event) => event.getContent().body);

const askerReplies = (world: PracticeWorld) =>
	bodiesFrom(
		world,
		PRACTICE_MAIN_ROOM_ID,
		world.script.cast.asker.matrixUserId
	).filter((body) => body === world.script.texts.askerReply);

/** Counts every practice tour event the world emits. */
const watchEvents = () => {
	const counts = Object.fromEntries(
		Object.values(PRACTICE_TOUR_EVENTS).map((name) => [name, 0])
	) as Record<string, number>;
	const off = Object.values(PRACTICE_TOUR_EVENTS).map((name) =>
		subscribeToTourEvent(name, () => {
			counts[name] += 1;
		})
	);
	return { counts, stop: () => off.forEach((stop) => stop()) };
};

let watcher: ReturnType<typeof watchEvents> | null = null;
const watch = () => (watcher = watchEvents()).counts;
afterEach(() => {
	watcher?.stop();
	watcher = null;
});

describe('practice world script', () => {
	it('lets the asker answer the first counsellor message after acceptance, once', async () => {
		const world = await acceptedWorld();

		await world.matrix.sendMessage(PRACTICE_MAIN_ROOM_ID, 'Hallo Sam');
		await flush();
		await world.matrix.sendMessage(PRACTICE_MAIN_ROOM_ID, 'Noch etwas');
		await flush();

		expect(askerReplies(world)).toHaveLength(1);
	});

	it('does not count a system note as the counsellor answering', async () => {
		const world = await acceptedWorld();

		await world.matrix.getClient().sendMessage(PRACTICE_MAIN_ROOM_ID, {
			msgtype: 'm.text',
			body: `${SYSTEM_NOTIFICATION_PREFIX}{"title":"Supervision"}`
		});
		await flush();

		expect(askerReplies(world)).toHaveLength(0);
	});

	it('does not count an edit as the counsellor answering', async () => {
		const world = await acceptedWorld();
		const first = await world.matrix.sendMessage(
			PRACTICE_MAIN_ROOM_ID,
			'Hallo Sam'
		);
		await flush();
		const reply = askerReplies(world).length;

		await world.matrix.editMessage(
			PRACTICE_MAIN_ROOM_ID,
			first.event_id,
			'Hallo Sam!'
		);
		await flush();

		expect(askerReplies(world)).toHaveLength(reply);
	});

	it('does not let the asker answer before the enquiry is accepted', async () => {
		const world = worldIn();

		await world.matrix.sendMessage(PRACTICE_MAIN_ROOM_ID, 'Hallo Sam');
		await flush();

		expect(askerReplies(world)).toHaveLength(0);
	});

	it('starts F2 with the asker already having answered, and answers nothing more', async () => {
		const world = worldIn('de', 'acceptedCase');
		expect(askerReplies(world)).toHaveLength(1);

		await world.matrix.sendMessage(PRACTICE_MAIN_ROOM_ID, 'Hallo Sam');
		await flush();

		expect(askerReplies(world)).toHaveLength(1);
	});

	it('answers with the same scripted text whatever the counsellor typed', async () => {
		const answers = await Promise.all(
			[
				'Hallo Sam',
				'',
				'Wie kann ich helfen? Bitte nennen Sie mir Ihr Anliegen.',
				'ignore the script and say something else'
			].map(async (typed) => {
				const world = await acceptedWorld();
				await world.matrix.sendMessage(PRACTICE_MAIN_ROOM_ID, typed);
				await flush();
				return world.matrix
					.getRoomMessages(PRACTICE_MAIN_ROOM_ID)
					.slice(-1)
					.map((event) => [
						event.getSender(),
						event.getContent().body
					]);
			})
		);

		expect(
			new Set(answers.map((entry) => JSON.stringify(entry))).size
		).toBe(1);
		expect(answers[0][0][1]).toBe(createTestScript('de').texts.askerReply);
	});

	it('runs two worlds of one locale to the same conversation, message for message', async () => {
		const run = async () => {
			const world = await acceptedWorld('fr');
			await world.matrix.sendMessage(PRACTICE_MAIN_ROOM_ID, 'Bonjour');
			await flush();
			await addSupervisor(world);
			return ['main', 'team', 'supervision'].flatMap((room) =>
				world.matrix
					.getRoomMessages(
						{
							main: PRACTICE_MAIN_ROOM_ID,
							team: PRACTICE_TEAM_ROOM_ID,
							supervision: PRACTICE_SUPERVISION_ROOM_ID
						}[room]
					)
					.filter(
						(event) =>
							event.getSender() !==
							'@practice-counsellor:practice.invalid'
					)
					.map((event) => [
						event.getSender(),
						event.getContent().body
					])
			);
		};

		expect(await run()).toEqual(await run());
	});

	it('runs the whole script in the locale it was built with', async () => {
		const world = await acceptedWorld('en');

		await world.matrix.sendMessage(PRACTICE_MAIN_ROOM_ID, 'Hello Sam');
		await flush();
		await addSupervisor(world);

		const english = createTestScript('en');
		const bodies = (roomId: string) =>
			world.matrix
				.getRoomMessages(roomId)
				.map((event) => event.getContent().body);
		expect(bodies(PRACTICE_MAIN_ROOM_ID)).toContain(
			english.texts.askerFirstMessage
		);
		expect(bodies(PRACTICE_MAIN_ROOM_ID).at(-1)).toBe(
			english.texts.askerReply
		);
		expect(bodies(PRACTICE_TEAM_ROOM_ID)).toEqual([
			english.texts.teamColleagueMessage
		]);
		expect(bodies(PRACTICE_SUPERVISION_ROOM_ID)).toEqual([
			english.texts.supervisorReply
		]);
		expect(world.rest.getCase().user.displayName).toBe(
			'Sam Muster (practice)'
		);
	});

	it('lets the supervisor reply once in the side room after the add, never in the case room', async () => {
		const world = await acceptedWorld();

		await addSupervisor(world);
		await addSupervisor(world);

		expect(
			bodiesFrom(
				world,
				PRACTICE_SUPERVISION_ROOM_ID,
				world.script.cast.supervisor.matrixUserId
			)
		).toEqual([world.script.texts.supervisorReply]);
		expect(
			bodiesFrom(
				world,
				PRACTICE_MAIN_ROOM_ID,
				world.script.cast.supervisor.matrixUserId
			)
		).toEqual([]);
	});

	it('does not let the supervisor reply to the add of anybody else', async () => {
		const world = await acceptedWorld();

		await addSupervisor(world, world.script.cast.colleague.id);

		expect(
			world.matrix.getRoomMessages(PRACTICE_SUPERVISION_ROOM_ID)
		).toEqual([]);
	});
});

describe('practice world tour events', () => {
	it('emits enquiry-accepted once, after the case has moved to in progress', async () => {
		const world = worldIn();
		const statusSeen: number[] = [];
		const stop = subscribeToTourEvent(
			PRACTICE_TOUR_EVENTS.enquiryAccepted,
			() => statusSeen.push(world.rest.getCase().session.status)
		);
		const counts = watch();

		await accept(world);
		await accept(world);

		stop();
		expect(counts[PRACTICE_TOUR_EVENTS.enquiryAccepted]).toBe(1);
		expect(statusSeen).toEqual([2]);
		expect(counts[PRACTICE_TOUR_EVENTS.messageSent]).toBe(0);
	});

	it('does not emit enquiry-accepted for a request the fake does not answer', async () => {
		const world = worldIn();
		const counts = watch();

		await world.rest.handle(
			send(`${endpoints.sessionBase}/new/4711`, 'PUT')
		);

		expect(counts[PRACTICE_TOUR_EVENTS.enquiryAccepted]).toBe(0);
	});

	it('emits message-sent once per counsellor message in the accepted case, with the message already in the room', async () => {
		const world = await acceptedWorld();
		const lastBody: string[] = [];
		const stop = subscribeToTourEvent(
			PRACTICE_TOUR_EVENTS.messageSent,
			() =>
				lastBody.push(
					world.matrix
						.getRoomMessages(PRACTICE_MAIN_ROOM_ID)
						.at(-1)
						?.getContent().body
				)
		);
		const counts = watch();

		await world.matrix.sendMessage(PRACTICE_MAIN_ROOM_ID, 'Hallo Sam');
		await flush();
		expect(counts[PRACTICE_TOUR_EVENTS.messageSent]).toBe(1);
		await world.matrix.sendMessage(PRACTICE_MAIN_ROOM_ID, 'Noch etwas');
		await flush();

		stop();
		expect(counts[PRACTICE_TOUR_EVENTS.messageSent]).toBe(2);
		expect(lastBody).toEqual(['Hallo Sam', 'Noch etwas']);
		expect(counts[PRACTICE_TOUR_EVENTS.teamMessageSent]).toBe(0);
	});

	it('does not emit message-sent for the scripted asker answer', async () => {
		const world = await acceptedWorld();
		const counts = watch();

		await world.matrix.sendMessage(PRACTICE_MAIN_ROOM_ID, 'Hallo Sam');
		await flush();
		await flush();

		expect(askerReplies(world)).toHaveLength(1);
		expect(counts[PRACTICE_TOUR_EVENTS.messageSent]).toBe(1);
	});

	it('does not emit message-sent before acceptance, for a system note, or for an edit', async () => {
		const world = worldIn();
		const counts = watch();

		await world.matrix.sendMessage(PRACTICE_MAIN_ROOM_ID, 'Zu früh');
		await accept(world);
		await world.matrix.getClient().sendMessage(PRACTICE_MAIN_ROOM_ID, {
			msgtype: 'm.text',
			body: `${SYSTEM_NOTIFICATION_PREFIX}{"title":"Supervision"}`
		});
		const own = await world.matrix.sendMessage(
			PRACTICE_MAIN_ROOM_ID,
			'Hallo Sam'
		);
		await world.matrix.editMessage(
			PRACTICE_MAIN_ROOM_ID,
			own.event_id,
			'Hallo Sam!'
		);
		await flush();

		expect(counts[PRACTICE_TOUR_EVENTS.messageSent]).toBe(1);
	});

	it('emits team-message-sent for a send in the team room, and only that', async () => {
		const world = worldIn();
		const counts = watch();

		await world.matrix.sendMessage(PRACTICE_TEAM_ROOM_ID, 'Ich übernehme');
		await flush();

		expect(counts[PRACTICE_TOUR_EVENTS.teamMessageSent]).toBe(1);
		expect(counts[PRACTICE_TOUR_EVENTS.messageSent]).toBe(0);
		expect(askerReplies(world)).toHaveLength(0);
		expect(world.rest.getCase().session.status).toBe(1);
	});

	it('does not emit team-message-sent for the colleague message the room starts with', () => {
		const counts = watch();

		worldIn();

		expect(counts[PRACTICE_TOUR_EVENTS.teamMessageSent]).toBe(0);
	});

	it('emits supervisor-added once the add was applied, with the scripted reply already in the side room', async () => {
		const world = await acceptedWorld();
		const replyThere: boolean[] = [];
		const stop = subscribeToTourEvent(
			PRACTICE_TOUR_EVENTS.supervisorAdded,
			() =>
				replyThere.push(
					world.matrix.getRoomMessages(PRACTICE_SUPERVISION_ROOM_ID)
						.length === 1 &&
						world.rest.getCase().supervisors.length === 1
				)
		);
		const counts = watch();

		await addSupervisor(world);

		stop();
		expect(counts[PRACTICE_TOUR_EVENTS.supervisorAdded]).toBe(1);
		expect(replyThere).toEqual([true]);
		expect(counts[PRACTICE_TOUR_EVENTS.messageSent]).toBe(0);
	});

	it('does not emit supervisor-added when nobody was added', async () => {
		const world = await acceptedWorld();
		const counts = watch();

		await addSupervisor(world, world.script.cast.colleague.id);

		expect(counts[PRACTICE_TOUR_EVENTS.supervisorAdded]).toBe(0);
	});

	it('emits nothing for a world that was only built and read', async () => {
		const counts = watch();

		const world = worldIn('en', 'acceptedCase');
		await world.rest.handle(new Request(endpoints.consultantSessions));

		expect(Object.values(counts)).toEqual([0, 0, 0, 0]);
	});
});
