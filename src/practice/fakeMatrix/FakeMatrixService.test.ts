// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MatrixEvent } from 'matrix-js-sdk';
import { createFakeMatrixService } from './FakeMatrixService';
import { createPracticeScenario } from '../fixtures/practiceScenario';
import { practiceCounsellorFixture } from '../fixtures/practiceCounsellorFixture';
import { PRACTICE_COUNSELLOR_MATRIX_USER_ID } from '../fixtures/practiceCast';
import { createTestScript } from '../script/scriptTestSupport';
import { PRACTICE_MAIN_ROOM_ID } from '../fixtures/practiceIdentifiers';
import { feedbackMailIntentQueue } from '../../services/feedbackMailIntentQueue';
import { chatTransportService } from '../../services/chatTransportService';
import { setMatrixClientServiceRef } from '../../services/matrixClientRegistry';

const script = createTestScript('de');
const scenario = () =>
	createPracticeScenario({
		counsellor: practiceCounsellorFixture(),
		script
	});

afterEach(() => {
	setMatrixClientServiceRef(null);
	vi.restoreAllMocks();
});

describe('FakeMatrixService', () => {
	it('exposes the seeded practice room as real Matrix events with member names', () => {
		const service = createFakeMatrixService({ rooms: scenario().rooms });

		const room = service.getClient().getRoom(PRACTICE_MAIN_ROOM_ID);

		expect(
			room.timeline.every((event) => event instanceof MatrixEvent)
		).toBe(true);
		const enquiry = room.timeline.find(
			(event) =>
				event.getContent().body === script.texts.askerFirstMessage
		);
		expect(enquiry?.getSender()).toBe(script.cast.asker.matrixUserId);
		expect(room.getMember(script.cast.asker.matrixUserId)?.name).toBe(
			script.cast.asker.displayName
		);
		expect(service.getClient().getUserId()).toBe(
			PRACTICE_COUNSELLOR_MATRIX_USER_ID
		);
	});

	it('appends a counsellor message to the fake room, announces it on the timeline and tells the script', async () => {
		const onCounsellorMessage = vi.fn();
		const service = createFakeMatrixService({
			rooms: scenario().rooms,
			onCounsellorMessage
		});
		const timeline = vi.fn();
		service.getClient().on('Room.timeline', timeline);

		const response = await service.sendMessage(
			PRACTICE_MAIN_ROOM_ID,
			'Hallo Sam'
		);

		const room = service.getRoom(PRACTICE_MAIN_ROOM_ID)!;
		const sent = room.timeline[room.timeline.length - 1];
		expect(sent.getId()).toBe(response.event_id);
		expect(sent.getSender()).toBe(PRACTICE_COUNSELLOR_MATRIX_USER_ID);
		expect(sent.getContent().body).toBe('Hallo Sam');
		expect(timeline).toHaveBeenCalledWith(
			sent,
			room,
			false,
			false,
			expect.objectContaining({ liveEvent: true })
		);
		expect(onCounsellorMessage).toHaveBeenCalledWith(
			PRACTICE_MAIN_ROOM_ID,
			'Hallo Sam'
		);
	});

	it('appends scripted messages from the cast and drops listeners on removal', () => {
		const service = createFakeMatrixService({ rooms: scenario().rooms });
		const timeline = vi.fn();
		const client = service.getClient();
		client.on('Room.timeline', timeline);
		client.removeListener('Room.timeline', timeline);

		const event = service.appendMessage(
			PRACTICE_MAIN_ROOM_ID,
			script.cast.asker.matrixUserId,
			script.texts.askerReply
		);

		expect(event.getSender()).toBe(script.cast.asker.matrixUserId);
		expect(
			service.getRoomMessages(PRACTICE_MAIN_ROOM_ID).at(-1)?.getId()
		).toBe(event.getId());
		expect(timeline).not.toHaveBeenCalled();
	});

	it('keeps a practice send out of the persistent feedback-mail retry queue', async () => {
		const service = createFakeMatrixService({ rooms: scenario().rooms });
		const setItem = vi.spyOn(Storage.prototype, 'setItem');
		const start = vi.spyOn(feedbackMailIntentQueue, 'start');
		setMatrixClientServiceRef(service as any);

		const { event_id } = await service.sendMessage(
			PRACTICE_MAIN_ROOM_ID,
			'Rückmeldung'
		);
		await feedbackMailIntentQueue.enqueue(service.getClient().getUserId(), {
			roomId: PRACTICE_MAIN_ROOM_ID,
			matrixEventId: event_id
		});

		expect(setItem).not.toHaveBeenCalled();
		expect(start).not.toHaveBeenCalled();
	});

	it('serves the chat transport read path and swallows read receipts locally', async () => {
		const service = createFakeMatrixService({ rooms: scenario().rooms });
		setMatrixClientServiceRef(service as any);

		const messages = chatTransportService.getMatrixRoomMessages(
			PRACTICE_MAIN_ROOM_ID,
			100
		);
		await chatTransportService.markRoomAsRead(PRACTICE_MAIN_ROOM_ID);

		expect(messages.map((event) => event.getContent().body)).toContain(
			script.texts.askerFirstMessage
		);
		expect(service.sentReadReceipts).toEqual([
			messages[messages.length - 1].getId()
		]);
	});

	it('refuses attachments and room creation in practice', async () => {
		const service = createFakeMatrixService({ rooms: scenario().rooms });

		await expect(
			service.sendFileMessage(PRACTICE_MAIN_ROOM_ID, new File([], 'x'))
		).rejects.toThrow(/practice/);
		await expect(service.createDirectMessageRoom('@a:b')).rejects.toThrow(
			/practice/
		);
	});
});
