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
	FETCH_ERRORS: { CATCH_ALL: 'CATCH_ALL' }
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

it('corrects a provisional missed card when the server confirms attendance and completion', async () => {
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
	expect(await apiCallState({ ...original, state: 'missed' })).toMatchObject({
		state: 'ended',
		durationSeconds: 125
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
