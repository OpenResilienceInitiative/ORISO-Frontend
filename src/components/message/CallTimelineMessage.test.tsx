// @vitest-environment jsdom
import * as React from 'react';
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { CallTimelineMessage } from './CallTimelineMessage';
import type { CallLifecycleMessage } from '../../utils/callLifecycleMessage';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string) => key })
}));
vi.mock('lottie-react', () => ({ default: () => null }));
vi.mock('lottie-web', () => ({ default: { loadAnimation: () => ({}) } }));
afterEach(cleanup);

it('retries a failed ended-card read and restores the persisted participants', async () => {
	vi.useFakeTimers();
	try {
		const call: CallLifecycleMessage = {
			callId: 'ended-call',
			roomRef: '!source:example',
			callRoomId: '!media:example',
			callType: 'video',
			state: 'ended',
			participants: [],
			durationSeconds: 1
		};
		const loadState = vi
			.fn()
			.mockRejectedValueOnce(new Error('temporarily offline'))
			.mockResolvedValue({
				...call,
				durationSeconds: 125,
				participants: [
					{ userId: '@sam:example', displayName: 'Sam Test' }
				]
			});
		render(<CallTimelineMessage call={call} loadState={loadState} />);
		await act(async () => {
			await vi.advanceTimersByTimeAsync(15000);
		});
		expect(screen.queryByText('Sam Test')).toBeTruthy();
		expect(screen.queryByRole('button')).toBeNull();
		await act(async () => {
			await vi.advanceTimersByTimeAsync(30000);
		});
		expect(loadState).toHaveBeenCalledTimes(2);
	} finally {
		cleanup();
		vi.useRealTimers();
	}
});

it('retries an unconfirmed missed card until the stored completion is available', async () => {
	vi.useFakeTimers();
	try {
		const call: CallLifecycleMessage = {
			callId: 'stable-call',
			roomRef: '!source:example',
			callRoomId: '!media:example',
			callType: 'video',
			state: 'missed',
			participants: []
		};
		const loadState = vi
			.fn()
			.mockResolvedValueOnce(null)
			.mockResolvedValue({
				...call,
				state: 'ended',
				durationSeconds: 125
			});
		render(<CallTimelineMessage call={call} loadState={loadState} />);
		await act(async () => {
			await vi.advanceTimersByTimeAsync(15000);
		});
		expect(
			screen.queryByText('videoCall.timeline.video.ended')
		).toBeTruthy();
	} finally {
		cleanup();
		vi.useRealTimers();
	}
});

it('replaces a provisional missed label with the confirmed completed call', async () => {
	const call: CallLifecycleMessage = {
		callId: 'stable-call',
		roomRef: '!source:example',
		callRoomId: '!media:example',
		callType: 'video',
		state: 'missed',
		participants: []
	};
	render(
		<CallTimelineMessage
			call={call}
			loadState={async () => ({
				...call,
				state: 'ended',
				durationSeconds: 125
			})}
		/>
	);
	expect(
		await screen.findByText('videoCall.timeline.video.ended')
	).toBeTruthy();
	expect(screen.queryByText('videoCall.timeline.video.missed')).toBeNull();
});

it('ignores an old response after the card changes to a different call', async () => {
	const oldCall: CallLifecycleMessage = {
		callId: 'old-call',
		roomRef: '!source:example',
		callRoomId: '!old-media:example',
		callType: 'video',
		state: 'running',
		participants: []
	};
	let resolveOld: (value: CallLifecycleMessage) => void = () => {
		throw new Error('not initialized');
	};
	const oldResponse = new Promise<CallLifecycleMessage>((resolve) => {
		resolveOld = resolve;
	});
	const loadState = vi
		.fn()
		.mockReturnValueOnce(oldResponse)
		.mockResolvedValue(null);
	const view = render(
		<CallTimelineMessage call={oldCall} loadState={loadState} />
	);
	view.rerender(
		<CallTimelineMessage
			call={{
				...oldCall,
				callId: 'new-call',
				callRoomId: '!new-media:example'
			}}
			loadState={loadState}
		/>
	);
	await act(async () => {
		resolveOld({ ...oldCall, state: 'ended' });
		await oldResponse;
	});
	expect(screen.queryByText('videoCall.timeline.video.ended')).toBeNull();
	expect(screen.queryByText('videoCall.timeline.video.running')).toBeTruthy();
});

it('keeps the observed terminal state when the same stale room card is supplied again', async () => {
	const call: CallLifecycleMessage = {
		callId: 'stable-call',
		roomRef: '!source:example',
		callRoomId: '!media:example',
		callType: 'video',
		state: 'running',
		participants: []
	};
	const loadState = vi
		.fn()
		.mockResolvedValueOnce({
			...call,
			state: 'ended',
			durationSeconds: 125
		})
		.mockResolvedValue(null);
	const view = render(
		<CallTimelineMessage call={call} loadState={loadState} />
	);
	await screen.findByText('videoCall.timeline.video.ended');
	view.rerender(
		<CallTimelineMessage call={{ ...call }} loadState={loadState} />
	);
	expect(screen.queryByText('videoCall.timeline.video.ended')).toBeTruthy();
	expect(screen.queryByText('videoCall.timeline.video.running')).toBeNull();
});

it('shows the stored ended state after reopening a stale running card', async () => {
	const call: CallLifecycleMessage = {
		callId: 'stable-call',
		roomRef: '!source:example',
		callRoomId: '!media:example',
		callType: 'video',
		state: 'running',
		participants: []
	};
	render(
		<CallTimelineMessage
			call={call}
			onJoin={async () => 'joined'}
			loadState={async () => ({
				...call,
				state: 'ended',
				durationSeconds: 125
			})}
		/>
	);
	expect(
		await screen.findByText('videoCall.timeline.video.ended')
	).toBeTruthy();
	expect(screen.queryByRole('button')).toBeNull();
});
