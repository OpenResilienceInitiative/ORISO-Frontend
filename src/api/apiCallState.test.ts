// @vitest-environment jsdom
import { expect, it, vi } from 'vitest';
import { apiCallState } from './apiCallState';
import type { CallLifecycleMessage } from '../utils/callLifecycleMessage';

const { fetchDataMock, getMemberMock } = vi.hoisted(() => ({
	fetchDataMock: vi.fn(),
	getMemberMock: vi.fn()
}));
vi.mock('../services/matrixClientRegistry', () => ({
	getMatrixClientService: () => ({
		getClient: () => ({ getRoom: () => ({ getMember: getMemberMock }) })
	})
}));
vi.mock('./fetchData', () => ({
	fetchData: (args: unknown) => fetchDataMock(args),
	FETCH_METHODS: { GET: 'GET' },
	FETCH_ERRORS: { CATCH_ALL: 'CATCH_ALL', NO_MATCH: 'NO_MATCH' }
}));

const original: CallLifecycleMessage = {
	callId: 'stable-call',
	roomRef: '!source:example',
	callRoomId: '!media:example',
	callType: 'video',
	state: 'running',
	participants: []
};

it('restores persisted attendees when the room card has no participant names yet', async () => {
	getMemberMock.mockImplementation((id: string) => ({
		name: id === '@caller:example' ? 'Alex Test' : 'Sam Test'
	}));
	fetchDataMock.mockResolvedValue({
		sourceRoomId: '!source:example',
		callId: 'stable-call',
		callRoomId: '!media:example',
		callType: 'video',
		state: 'ended',
		invitedAt: 1000,
		startedAt: 2000,
		endedAt: 127000,
		durationSeconds: 125,
		participantMatrixIds: ['@caller:example', '@receiver:example']
	});
	expect((await apiCallState(original))?.participants).toEqual([
		{ userId: '@caller:example', displayName: 'Alex Test' },
		{ userId: '@receiver:example', displayName: 'Sam Test' }
	]);
});

const endedResponse = (
	participantMatrixIds?: string[]
): Record<string, unknown> => ({
	sourceRoomId: '!source:example',
	callId: 'stable-call',
	callRoomId: '!media:example',
	callType: 'video',
	state: 'ended',
	invitedAt: 1000,
	startedAt: 2000,
	endedAt: 127000,
	durationSeconds: 125,
	...(participantMatrixIds === undefined ? {} : { participantMatrixIds })
});

it('corrects a provisional missed card when somebody else is shown to have attended', async () => {
	getMemberMock.mockImplementation(() => ({ name: 'Sam Test' }));
	fetchDataMock.mockResolvedValue(
		endedResponse(['@caller:example', '@receiver:example'])
	);
	expect(
		await apiCallState({
			...original,
			state: 'missed',
			actorUserId: '@caller:example'
		})
	).toMatchObject({ state: 'ended', durationSeconds: 125 });
});

it('leaves a missed call missed when the only attendee is the caller', async () => {
	/*
	 * The whole reason this guard exists. UserService "defines attendance as
	 * any observed Matrix membership; it does not prove two-person media"
	 * (docs/agent-tasks/2026-09-14-calls/README.md), and the caller's own
	 * membership is published while the phone is merely ringing — so an
	 * unanswered outgoing call comes back as `ended` with the ringing time as
	 * its duration. Accepting that would re-import, from the server, exactly
	 * the mistake `callLifecycleTracker` was fixed to stop making here.
	 */
	fetchDataMock.mockResolvedValue(endedResponse(['@caller:example']));
	expect(
		await apiCallState({
			...original,
			state: 'missed',
			actorUserId: '@caller:example'
		})
	).toBeNull();
});

it('leaves a missed call missed when the server offers no attendance at all', async () => {
	// No ids is no evidence, and a terminal answer would stop the retries
	// that could ever correct it.
	fetchDataMock.mockResolvedValue(endedResponse());
	expect(
		await apiCallState({
			...original,
			state: 'missed',
			actorUserId: '@caller:example'
		})
	).toBeNull();
});

it('still corrects a missed card that never recorded an actor', async () => {
	// An older card, or a client that could not name itself: any attendance
	// counts, which is the same fallback the tracker uses.
	getMemberMock.mockImplementation(() => ({ name: 'Sam Test' }));
	fetchDataMock.mockResolvedValue(endedResponse(['@someone:example']));
	expect(await apiCallState({ ...original, state: 'missed' })).toMatchObject({
		state: 'ended'
	});
});

it.each([
	{ callId: 'other-call' },
	{ sourceRoomId: '!other:example' },
	{ callRoomId: '!other-media:example' },
	{ callType: 'audio' },
	{ durationSeconds: 126 },
	{ endedAt: 1000 },
	{ startedAt: '2000' },
	{ invitedAt: -1 },
	{ endedAt: Number.POSITIVE_INFINITY }
])('rejects mismatched or malformed stored call data: %j', async (override) => {
	fetchDataMock.mockResolvedValue({
		sourceRoomId: '!source:example',
		callId: 'stable-call',
		callRoomId: '!media:example',
		callType: 'video',
		state: 'ended',
		invitedAt: 1000,
		startedAt: 2000,
		endedAt: 127000,
		durationSeconds: 125,
		...override
	});
	expect(await apiCallState(original)).toBeNull();
});

it('restores the stored terminal state and duration for the same call', async () => {
	fetchDataMock.mockResolvedValue({
		sourceRoomId: '!source:example',
		callId: 'stable-call',
		callRoomId: '!media:example',
		callType: 'video',
		state: 'ended',
		invitedAt: 1000,
		startedAt: 2000,
		endedAt: 127000,
		durationSeconds: 125
	});
	expect(await apiCallState(original)).toMatchObject({
		callId: 'stable-call',
		roomRef: '!source:example',
		state: 'ended',
		startedAt: '1970-01-01T00:00:02.000Z',
		endedAt: '1970-01-01T00:02:07.000Z',
		durationSeconds: 125
	});
});

it('settles a call nobody here ever answered as missed, on caller-only attendance', async () => {
	/*
	 * The road around the `missed` guard: an unanswered call whose terminal
	 * edit exhausted its retries — or a reload before that edit syncs —
	 * leaves the card `running`, and the server reports `ended` because
	 * attendance is "any observed Matrix membership" and the caller's is
	 * published while the phone is merely ringing. Accepting that records an
	 * unanswered call as answered, with the ringing time as its duration, and
	 * permanently: a terminal answer stops the retries.
	 *
	 * `startedAt` absent on a `running` card is this client saying nobody but
	 * the actor ever arrived. And `null` is no answer either: with the
	 * caller's tab gone no terminal edit follows, so the card would poll on
	 * "running" for good. It is over, and it was missed.
	 */
	const ringing: CallLifecycleMessage = {
		...original,
		actorUserId: '@caller:example'
	};
	fetchDataMock.mockResolvedValue({
		sourceRoomId: original.roomRef,
		callId: original.callId,
		callRoomId: original.callRoomId,
		callType: 'video',
		state: 'ended',
		invitedAt: 1000,
		startedAt: 2000,
		endedAt: 14000,
		durationSeconds: 12,
		participantMatrixIds: ['@caller:example']
	});

	expect(await apiCallState(ringing)).toMatchObject({
		state: 'missed',
		startedAt: undefined,
		endedAt: '1970-01-01T00:00:14.000Z',
		durationSeconds: undefined
	});
});

it('ends it once somebody other than the caller is on the roll', async () => {
	// The other side, so the guard cannot be satisfied by refusing
	// everything: real attendance still corrects the card.
	const ringing: CallLifecycleMessage = {
		...original,
		actorUserId: '@caller:example'
	};
	fetchDataMock.mockResolvedValue({
		sourceRoomId: original.roomRef,
		callId: original.callId,
		callRoomId: original.callRoomId,
		callType: 'video',
		state: 'ended',
		invitedAt: 1000,
		startedAt: 2000,
		endedAt: 14000,
		durationSeconds: 12,
		participantMatrixIds: ['@caller:example', '@callee:example']
	});

	expect(await apiCallState(ringing)).toMatchObject({
		state: 'ended',
		durationSeconds: 12
	});
});

it('accepts a server-confirmed missed state over a provisional ended room card', async () => {
	fetchDataMock.mockResolvedValue({
		sourceRoomId: original.roomRef,
		callId: original.callId,
		callRoomId: original.callRoomId,
		callType: original.callType,
		state: 'missed',
		invitedAt: 1000,
		startedAt: null,
		endedAt: 2000,
		durationSeconds: 0,
		participantMatrixIds: []
	});
	expect(await apiCallState({ ...original, state: 'ended' })).toMatchObject({
		state: 'missed',
		participants: [],
		durationSeconds: undefined
	});
});

it('treats "no such call" as an answer and everything else as a failed question', async () => {
	/*
	 * Both used to come back the same way — the request rejected, the caller
	 * caught it, kept the durable card and asked again in fifteen seconds,
	 * for as long as the card was on screen. A 404 is the server saying it
	 * has no record; asking again will not change that.
	 */
	fetchDataMock.mockRejectedValueOnce(new Error('NO_MATCH'));
	await expect(apiCallState(original)).resolves.toBeNull();

	fetchDataMock.mockRejectedValueOnce(new Error('CATCH_ALL'));
	await expect(apiCallState(original)).rejects.toThrow('CATCH_ALL');

	// And the 404 has to be asked for, or `fetchData` folds it into CATCH_ALL.
	expect(fetchDataMock.mock.calls[0][0].responseHandling).toContain(
		'NO_MATCH'
	);
});
