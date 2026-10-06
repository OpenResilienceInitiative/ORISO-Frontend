// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { createPracticeWorld, type PracticeWorld } from './practiceWorld';
import { practiceCounsellorFixture } from './fixtures/practiceCounsellorFixture';
import {
	PRACTICE_ENQUIRY_SESSION_ID,
	PRACTICE_MAIN_ROOM_ID,
	PRACTICE_SUPERVISION_ROOM_ID,
	PRACTICE_TEAM_ROOM_ID
} from './fixtures/practiceIdentifiers';
import { SYSTEM_NOTIFICATION_PREFIX } from '../components/message/messageConstants';
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
