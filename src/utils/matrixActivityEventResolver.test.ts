// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { chatTransportService } from '../services/chatTransportService';
import { resolveLocalMatrixActivityEvent } from './matrixActivityEventResolver';

const matrixEvent = (eventId: string, type = 'm.room.message') => ({
	getId: () => eventId,
	getType: () => type,
	getContent: () => ({ body: `body for ${eventId}` })
});

describe('resolveLocalMatrixActivityEvent', () => {
	afterEach(() => vi.restoreAllMocks());

	it('resolves three activity events in one room to their exact local Matrix events', () => {
		const events = ['$first', '$second', '$third'].map((id) =>
			matrixEvent(id)
		);
		vi.spyOn(chatTransportService, 'getMatrixRoom').mockReturnValue({
			findEventById: (eventId: string) =>
				events.find((event) => event.getId() === eventId)
		} as any);

		const resolutions = events.map((event) =>
			resolveLocalMatrixActivityEvent('!room:oriso', event.getId())
		);

		expect(resolutions).toEqual(
			events.map((event) => ({ status: 'resolved', event }))
		);
	});

	it('reports pending decryption for the exact encrypted event', () => {
		const event = matrixEvent('$encrypted', 'm.room.encrypted');
		vi.spyOn(chatTransportService, 'getMatrixRoom').mockReturnValue({
			findEventById: () => event
		} as any);

		expect(
			resolveLocalMatrixActivityEvent('!room:oriso', '$encrypted')
		).toEqual({ status: 'pending-decryption', event });
	});

	it('distinguishes an unavailable room from an unavailable event', () => {
		vi.spyOn(chatTransportService, 'getMatrixRoom')
			.mockReturnValueOnce(null)
			.mockReturnValueOnce({ findEventById: () => undefined } as any);

		expect(
			resolveLocalMatrixActivityEvent('!missing:oriso', '$event')
		).toEqual({ status: 'room-unavailable' });
		expect(
			resolveLocalMatrixActivityEvent('!room:oriso', '$missing')
		).toEqual({ status: 'event-unavailable' });
	});
});
