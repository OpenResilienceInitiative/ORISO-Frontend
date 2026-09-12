import { describe, expect, it } from 'vitest';
import { roomIdForActiveSession } from './supervisionRoomLookup';

describe('roomIdForActiveSession', () => {
	it('never exposes a side room resolved for a previous session', () => {
		expect(
			roomIdForActiveSession(
				{ sessionId: 73, roomId: '!supervision-73:oriso.invalid' },
				74
			)
		).toBeUndefined();
	});

	it('exposes the side room only for the session that was looked up', () => {
		expect(
			roomIdForActiveSession(
				{ sessionId: 74, roomId: '!supervision-74:oriso.invalid' },
				74
			)
		).toBe('!supervision-74:oriso.invalid');
	});
});
