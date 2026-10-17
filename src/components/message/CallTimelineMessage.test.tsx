// @vitest-environment jsdom
import * as React from 'react';
import {
	act,
	cleanup,
	fireEvent,
	render,
	screen
} from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { CallTimelineMessage } from './CallTimelineMessage';
import type { CallLifecycleMessage } from '../../utils/callLifecycleMessage';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string, values?: { start?: string }) =>
			values?.start ? `${key}: ${values.start}` : key
	})
}));
vi.mock('lottie-react', () => ({ default: () => null }));
vi.mock('lottie-web', () => ({ default: { loadAnimation: () => ({}) } }));
afterEach(cleanup);

it('renders the actual running call through the shared card with named participant avatars', () => {
	const call: CallLifecycleMessage = {
		callId: 'running-call',
		roomRef: '!source:example',
		callRoomId: '!media:example',
		callType: 'video',
		state: 'running',
		participants: [
			{ userId: '@alex:example', displayName: 'Alex Test' },
			{ userId: '@sam:example', displayName: 'Sam Test' }
		]
	};
	const view = render(
		<CallTimelineMessage call={call} onJoin={async () => 'joined'} />
	);

	expect(
		view.container.querySelector('[data-cy="chat-system-message"]')
	).toBeTruthy();
	expect(screen.getAllByTestId('user-avatar')).toHaveLength(2);
	expect(screen.getByRole('img', { name: 'Alex Test' })).toBeTruthy();
	expect(screen.getByRole('img', { name: 'Sam Test' })).toBeTruthy();
	expect(screen.getByText(/participants\.attended.*2/)).toBeTruthy();
});

it('labels the full attendance history after one participant leaves a running call', async () => {
	const initial: CallLifecycleMessage = {
		callId: 'partially-departed-call',
		roomRef: '!source:example',
		callRoomId: '!media:example',
		callType: 'video',
		state: 'running',
		participants: [
			{ userId: '@alex:example', displayName: 'Alex Test' },
			{ userId: '@bea:example', displayName: 'Bea Test' },
			{ userId: '@chris:example', displayName: 'Chris Test' }
		]
	};
	const loadState = vi.fn(async () => ({ ...initial }));
	render(
		<CallTimelineMessage
			call={initial}
			onJoin={async () => 'joined'}
			loadState={loadState}
		/>
	);

	expect(screen.getByText(/participants\.attended.*3/)).toBeTruthy();
	expect(screen.queryByText(/participants\.current/)).toBeNull();
	await act(async () => {});
	expect(loadState).toHaveBeenCalledWith(initial);
	expect(screen.getByText(/participants\.attended.*3/)).toBeTruthy();
	expect(screen.queryByText(/participants\.current/)).toBeNull();
});

it('guards the running call action against rapid repeated activation', async () => {
	let resolveJoin: (result: 'joined') => void = () => {
		throw new Error('not initialized');
	};
	const pendingJoin = new Promise<'joined'>((resolve) => {
		resolveJoin = resolve;
	});
	const onJoin = vi.fn(() => pendingJoin);
	const call: CallLifecycleMessage = {
		callId: 'running-call',
		roomRef: '!source:example',
		callRoomId: '!media:example',
		callType: 'video',
		state: 'running',
		participants: []
	};
	render(<CallTimelineMessage call={call} onJoin={onJoin} />);

	const join = screen.getByRole('button');
	fireEvent.click(join);
	fireEvent.click(join);
	expect(onJoin).toHaveBeenCalledTimes(1);
	expect((join as HTMLButtonElement).disabled).toBe(true);

	await act(async () => resolveJoin('joined'));
});

it.each(['busy', 'ended', 'unavailable'] as const)(
	'shows the existing join failure after the %s outcome',
	async (outcome) => {
		const call: CallLifecycleMessage = {
			callId: `running-${outcome}`,
			roomRef: '!source:example',
			callRoomId: '!media:example',
			callType: 'audio',
			state: 'running',
			participants: []
		};
		render(
			<CallTimelineMessage call={call} onJoin={async () => outcome} />
		);

		fireEvent.click(screen.getByRole('button'));
		expect(
			await screen.findByText('videoCall.timeline.joinFailed')
		).toBeTruthy();
	}
);

it('shows the existing join failure when the supplied join rejects', async () => {
	const call: CallLifecycleMessage = {
		callId: 'running-rejected',
		roomRef: '!source:example',
		callRoomId: '!media:example',
		callType: 'audio',
		state: 'running',
		participants: []
	};
	render(
		<CallTimelineMessage
			call={call}
			onJoin={async () => {
				throw new Error('rejected');
			}}
		/>
	);

	fireEvent.click(screen.getByRole('button'));
	expect(
		await screen.findByText('videoCall.timeline.joinFailed')
	).toBeTruthy();
});

it('renders no action without an authorized join callback and no zero duration when missing', () => {
	const call: CallLifecycleMessage = {
		callId: 'running-without-action',
		roomRef: '!source:example',
		callRoomId: '!media:example',
		callType: 'video',
		state: 'running',
		participants: []
	};
	render(<CallTimelineMessage call={call} />);

	expect(screen.queryByRole('button')).toBeNull();
	expect(screen.queryByText(/00:00/)).toBeNull();
});

it('does not describe an invitation timestamp as the call start', () => {
	const call: CallLifecycleMessage = {
		callId: 'invited-only',
		roomRef: '!source:example',
		callRoomId: '!media:example',
		callType: 'video',
		state: 'ended',
		participants: [],
		invitedAt: '2026-09-12T10:00:00.000Z'
	};
	render(<CallTimelineMessage call={call} />);

	expect(
		screen.queryByText(/message\.callLifecycle\.description\.ended:/)
	).toBeNull();
	expect(screen.getAllByText('videoCall.timeline.video.ended')).toHaveLength(
		2
	);
});

it('says who is in the call now, not who has ever been', () => {
	// The whole reason `present` exists. Sam joined, said something and left;
	// an attendance roll would still offer them as company.
	const call: CallLifecycleMessage = {
		callId: 'running-call',
		roomRef: '!source:example',
		callRoomId: '!media:example',
		callType: 'video',
		state: 'running',
		participants: [
			{ userId: '@alex:example', displayName: 'Alex Test' },
			{ userId: '@sam:example', displayName: 'Sam Test' }
		],
		present: [{ userId: '@alex:example', displayName: 'Alex Test' }]
	};
	render(<CallTimelineMessage call={call} onJoin={async () => 'joined'} />);

	// The label is rendered as "<label> · <count>", so the group's own
	// accessible name is the stable thing to read.
	expect(
		screen.getByRole('group', {
			name: 'message.callLifecycle.participants.current'
		})
	).toBeTruthy();
	expect(screen.queryByLabelText('Sam Test')).toBeNull();
	expect(screen.getByLabelText('Alex Test')).toBeTruthy();
});

it('shows an empty room as empty rather than as everyone who passed through', () => {
	const call: CallLifecycleMessage = {
		callId: 'running-call',
		roomRef: '!source:example',
		callRoomId: '!media:example',
		callType: 'audio',
		state: 'running',
		participants: [{ userId: '@sam:example', displayName: 'Sam Test' }],
		present: []
	};
	render(<CallTimelineMessage call={call} />);

	expect(screen.queryByLabelText('Sam Test')).toBeNull();
});

it('falls back to attendance on a card written before presence existed', () => {
	// Cards already in rooms carry no `present`. They must stay readable, and
	// for them the old cumulative list is the only answer there is.
	const call: CallLifecycleMessage = {
		callId: 'old-call',
		roomRef: '!source:example',
		callRoomId: '!media:example',
		callType: 'audio',
		state: 'running',
		participants: [{ userId: '@sam:example', displayName: 'Sam Test' }]
	};
	render(<CallTimelineMessage call={call} />);

	expect(screen.getByLabelText('Sam Test')).toBeTruthy();
	expect(
		screen.getByRole('group', {
			name: 'message.callLifecycle.participants.attended'
		})
	).toBeTruthy();
});

it('shows attendance once the call has ended, presence being meaningless then', () => {
	const call: CallLifecycleMessage = {
		callId: 'ended-call',
		roomRef: '!source:example',
		callRoomId: '!media:example',
		callType: 'video',
		state: 'ended',
		startedAt: new Date('2026-10-16T10:00:00Z').toISOString(),
		endedAt: new Date('2026-10-16T10:05:00Z').toISOString(),
		durationSeconds: 300,
		participants: [
			{ userId: '@alex:example', displayName: 'Alex Test' },
			{ userId: '@sam:example', displayName: 'Sam Test' }
		],
		present: []
	};
	render(<CallTimelineMessage call={call} />);

	expect(
		screen.getByRole('group', {
			name: 'message.callLifecycle.participants.attended'
		})
	).toBeTruthy();
	expect(screen.getByLabelText('Alex Test')).toBeTruthy();
	expect(screen.getByLabelText('Sam Test')).toBeTruthy();
});
