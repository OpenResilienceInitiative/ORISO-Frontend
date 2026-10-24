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

/** The interface language, switchable per test. */
const ui = vi.hoisted(() => ({ language: '' }));

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string, values?: { start?: string }) =>
			values?.start ? `${key}: ${values.start}` : key,
		i18n: ui
	})
}));
vi.mock('lottie-react', () => ({ default: () => null }));
vi.mock('lottie-web', () => ({ default: { loadAnimation: () => ({}) } }));
afterEach(() => {
	cleanup();
	ui.language = '';
});

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

it('says who started the call, by the name the room knows them under', () => {
	const call: CallLifecycleMessage = {
		callId: 'running-call',
		roomRef: '!source:example',
		callRoomId: '!media:example',
		callType: 'video',
		state: 'running',
		actorUserId: '@alex:example',
		participants: [{ userId: '@alex:example', displayName: 'Alex Test' }],
		present: [{ userId: '@alex:example', displayName: 'Alex Test' }]
	};
	render(<CallTimelineMessage call={call} />);

	expect(screen.getByText(/message\.callLifecycle\.startedBy/)).toBeTruthy();
});

it('says nothing about who started it when it has no name for them', () => {
	// A raw Matrix id on a card is worse than silence, and on a counselling
	// platform it is the identifier the pseudonym exists to keep out of sight.
	const call: CallLifecycleMessage = {
		callId: 'running-call',
		roomRef: '!source:example',
		callRoomId: '!media:example',
		callType: 'video',
		state: 'running',
		actorUserId: '@nobody-we-know:example',
		participants: [{ userId: '@alex:example', displayName: 'Alex Test' }]
	};
	render(<CallTimelineMessage call={call} />);

	expect(screen.queryByText(/startedBy/)).toBeNull();
	expect(screen.queryByText(/@nobody-we-know/)).toBeNull();
});

it('says nothing when the only name it has for them is their id', () => {
	/*
	 * The commoner case than an actor missing from the lists, and the one the
	 * existing test above did not reach: both producers fall back to
	 * `displayName: userId` when the room has no display name yet, so the
	 * entry IS there and its name is the identifier the pseudonym exists to
	 * keep out of sight.
	 */
	const call: CallLifecycleMessage = {
		callId: 'running-call',
		roomRef: '!source:example',
		callRoomId: '!media:example',
		callType: 'video',
		state: 'running',
		actorUserId: '@alex:example',
		participants: [
			{ userId: '@alex:example', displayName: '@alex:example' }
		],
		present: [{ userId: '@alex:example', displayName: '@alex:example' }]
	};
	render(<CallTimelineMessage call={call} />);

	expect(screen.queryByText(/startedBy/)).toBeNull();
	expect(screen.queryByText(/@alex:example/)).toBeNull();
});

it('keeps the id out of the avatars a screen reader reads', () => {
	/*
	 * The worse half of the actor-label case, and the one its test could not
	 * see because it only checked visible text.
	 *
	 * The participant mapping handed the id to `UserAvatar` as both the
	 * display name and the username, and `formatMessagePersonName` turns
	 * `@alex:example` into an accessible name of `alex` — so the identifier
	 * the visible card had just been taught to hide was still being read out.
	 * The avatar keeps `userId`, because its colour and letters are derived
	 * from it and that reveals nothing; what goes is the claim that the id is
	 * a name.
	 */
	const call: CallLifecycleMessage = {
		callId: 'running-call',
		roomRef: '!source:example',
		callRoomId: '!media:example',
		callType: 'video',
		state: 'running',
		participants: [
			{ userId: '@alex:example', displayName: '@alex:example' }
		],
		present: [{ userId: '@alex:example', displayName: '@alex:example' }]
	};
	const { container } = render(<CallTimelineMessage call={call} />);

	const spoken = [...container.querySelectorAll('*')]
		.map((node) => node.getAttribute('aria-label') ?? '')
		.join(' ');
	expect(spoken).not.toMatch(/alex/i);
	expect(container.textContent ?? '').not.toMatch(/alex/i);
});

const STARTED_AT = '2026-10-16T08:00:00.000Z';
const formatIn = (locale?: string) =>
	new Intl.DateTimeFormat(locale, {
		dateStyle: 'medium',
		timeStyle: 'short'
	}).format(new Date(STARTED_AT));
const literal = (text: string) =>
	new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));

it.each([
	['de', 'de'],
	['de@informal', 'de'],
	['en-GB', 'en-GB']
])(
	'formats the start time in the interface language, not the browser one (%s)',
	(language, tag) => {
		/*
		 * `Intl.DateTimeFormat(undefined, …)` takes the BROWSER locale, so a
		 * German interface in an English browser read "Gestartet am Oct 16,
		 * 2026, 10:00 AM". `de@informal` is our own variant rather than a
		 * BCP 47 tag and `Intl` throws on it, so the suffix has to come off
		 * before `Intl` sees it; that is why it is in the table.
		 *
		 * The expected text is built with `Intl` rather than written out,
		 * because what is under test is WHICH locale the component asks for,
		 * not how ICU renders it — and spelling a date out here would pin the
		 * test to one time zone and one ICU version.
		 */
		ui.language = language;
		const call: CallLifecycleMessage = {
			callId: 'started-call',
			roomRef: '!source:example',
			callRoomId: '!media:example',
			callType: 'video',
			state: 'ended',
			participants: [],
			startedAt: STARTED_AT,
			durationSeconds: 60
		};
		render(<CallTimelineMessage call={call} />);

		expect(screen.getByText(literal(formatIn(tag)))).toBeDefined();
		// And not the browser's own idea of it, which is what the bug showed.
		if (formatIn(undefined) !== formatIn(tag))
			expect(screen.queryByText(literal(formatIn(undefined)))).toBeNull();
	}
);

// #780: the walkthrough's missed card said "Attended · 1" about the caller.
it('lists nobody as attended on a missed call and still names the caller', () => {
	const call: CallLifecycleMessage = {
		callId: 'missed-call',
		roomRef: '!source:example',
		callRoomId: '!media:example',
		callType: 'video',
		state: 'missed',
		actorUserId: '@alex:example',
		participants: [{ userId: '@alex:example', displayName: 'Alex Test' }]
	};
	render(<CallTimelineMessage call={call} />);

	expect(screen.queryByText(/participants\.attended/)).toBeNull();
	expect(screen.queryAllByTestId('user-avatar')).toHaveLength(0);
	expect(screen.getByText(/message\.callLifecycle\.startedBy/)).toBeTruthy();
});
