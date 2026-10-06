// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { createPracticeWorld } from './practiceWorld';
import { practiceCounsellorFixture } from './fixtures/practiceCounsellorFixture';
import { PRACTICE_CAST, PRACTICE_SCRIPT } from './fixtures/practiceCast';
import {
	PRACTICE_ENQUIRY_SESSION_ID,
	PRACTICE_MAIN_ROOM_ID
} from './fixtures/practiceIdentifiers';
import { SYSTEM_NOTIFICATION_PREFIX } from '../components/message/messageConstants';
import { endpoints } from '../resources/scripts/endpoints';

const flush = () => new Promise<void>((resolve) => queueMicrotask(resolve));

const acceptedWorld = async () => {
	const world = createPracticeWorld({
		counsellor: practiceCounsellorFixture()
	});
	await world.rest.handle(
		new Request(
			`${endpoints.sessionBase}/new/${PRACTICE_ENQUIRY_SESSION_ID}`,
			{
				method: 'PUT'
			}
		)
	);
	return world;
};

const askerReplies = (world: Awaited<ReturnType<typeof acceptedWorld>>) =>
	world.matrix
		.getRoomMessages(PRACTICE_MAIN_ROOM_ID)
		.filter(
			(event) =>
				event.getSender() === PRACTICE_CAST.asker.matrixUserId &&
				event.getContent().body === PRACTICE_SCRIPT.askerReply
		);

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
});
