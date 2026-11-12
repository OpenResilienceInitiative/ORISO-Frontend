// @vitest-environment oriso-jsdom
import * as React from 'react';
import {
	act,
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor
} from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vite-plus/test';
import { CallTimelineMessage, formatCallDuration } from './CallTimelineMessage';
import {
	claimKnock,
	isKnockClaimed,
	joinOrKnock,
	type CallJoinHooks
} from '../directLinkEntry/callMessageKnock';
import { apiGetOwnCallKnock } from '../../api/apiDirectLinks';
import {
	forgetPendingKnock,
	PENDING_KNOCK_EVENT,
	readPendingKnock,
	rememberPendingKnock
} from '../directLinkEntry/directLinkEntryFlow';

import type { CallLifecycleMessage } from '../../utils/callLifecycleMessage';
import {
	ActiveSessionContext,
	type ExtendedSessionInterface
} from '../../globalState';

/** The running call a knock from the card records for a reload. */
const joinCallRef = {
	callId: 'running-call',
	state: 'running' as const,
	roomRef: '!source:example',
	callRoomId: '!media:example',
	callType: 'video' as const
};

/** The interface language, switchable per test. */
const ui = vi.hoisted(() => ({ language: '' }));

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (
			key: string,
			values?: { start?: string; name?: string; duration?: string }
		) =>
			values?.start
				? `${key}: ${values.start}`
				: values?.name
					? `${key}: ${values.name}`
					: values?.duration
						? `${key}: ${values.duration}`
						: key,
		i18n: ui
	})
}));
vi.mock('lottie-react', () => ({ default: () => null }));
vi.mock('../../api/apiDirectLinks', () => ({
	apiGetOwnCallKnock: vi.fn(() => new Promise(() => {})),
	apiCancelOwnCallKnock: vi.fn(async () => undefined),
	apiStartDirectLinkConversation: vi.fn(),
	apiGetOwnCallKnockForSession: vi.fn()
}));
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
	// Only the description falls back to the label; the title is the call
	// type (and topic), no longer the state a second time (#2237).
	expect(screen.getAllByText('videoCall.timeline.video.ended')).toHaveLength(
		1
	);
	expect(screen.getByText('message.callLifecycle.type.video')).toBeTruthy();
});

it('titles the card with the call type and the conversation topic (#2237)', () => {
	const call: CallLifecycleMessage = {
		callId: 'topic-call',
		roomRef: '!source:example',
		callRoomId: '!media:example',
		callType: 'audio',
		state: 'ended',
		participants: []
	};
	render(
		<ActiveSessionContext.Provider
			value={
				{
					activeSession: { item: { topic: { name: 'Schulden' } } }
				} as never
			}
		>
			<CallTimelineMessage call={call} />
		</ActiveSessionContext.Provider>
	);
	expect(
		screen.getByText('message.callLifecycle.type.audio · Schulden')
	).toBeTruthy();
});

it('counts a running call up every second from its start (#2237)', () => {
	vi.useFakeTimers();
	vi.setSystemTime(new Date('2026-11-12T22:00:00.000Z'));
	try {
		const call: CallLifecycleMessage = {
			callId: 'live-call',
			roomRef: '!source:example',
			callRoomId: '!media:example',
			callType: 'video',
			state: 'running',
			startedAt: '2026-11-12T21:55:58.000Z',
			participants: []
		};
		render(<CallTimelineMessage call={call} />);
		const timer = screen.getByRole('timer');
		expect(timer.textContent).toContain('04:02');
		act(() => {
			vi.advanceTimersByTime(3000);
		});
		expect(timer.textContent).toContain('04:05');
	} finally {
		vi.useRealTimers();
	}
});

it('shows when a missed call rang instead of repeating "missed" (#2237)', () => {
	vi.useFakeTimers();
	vi.setSystemTime(new Date('2026-11-13T15:00:00.000Z'));
	try {
		ui.language = 'de';
		const call: CallLifecycleMessage = {
			callId: 'missed-call',
			roomRef: '!source:example',
			callRoomId: '!media:example',
			callType: 'video',
			state: 'missed',
			invitedAt: '2026-11-13T09:40:00.000Z',
			participants: []
		};
		render(<CallTimelineMessage call={call} />);
		const shown = screen.getByText(/\d{2}:40/, {
			selector: '[data-cy="call-timeline-duration"]'
		});
		expect(shown.textContent).not.toContain('2026');
	} finally {
		ui.language = '';
		vi.useRealTimers();
	}
});

it('formats call durations from one hour on with hours', () => {
	expect(formatCallDuration(65)).toBe('01:05');
	expect(formatCallDuration(3725)).toBe('1:02:05');
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

it('names both parties by the names the session list uses, not the login in their Matrix profile (#780)', () => {
	const call: CallLifecycleMessage = {
		callId: 'ended-call',
		roomRef: '!source:example',
		callRoomId: '!media:example',
		callType: 'video',
		state: 'ended',
		actorUserId: '@bart_getme_2fa:example',
		participants: [
			{
				userId: '@bart_getme_2fa:example',
				displayName: 'bart_getme_2fa'
			},
			{
				userId: '@dragonfly_kendall_4108:example',
				displayName: 'dragonfly_kendall_4108'
			}
		]
	};
	const activeSession = {
		item: {
			askerMatrixUserId: '@dragonfly_kendall_4108:example',
			consultantMatrixUserId: '@bart_getme_2fa:example'
		},
		consultant: { username: 'bart_getme_2fa', displayName: 'Bart Simpson' },
		user: { username: 'dragonfly_kendall_4108', sessionData: {} }
	} as unknown as ExtendedSessionInterface;
	render(
		<ActiveSessionContext.Provider value={{ activeSession }}>
			<CallTimelineMessage call={call} />
		</ActiveSessionContext.Provider>
	);

	expect(screen.getByText(/startedBy: Bart Simpson/)).toBeTruthy();
	expect(screen.queryByText(/bart_getme_2fa/)).toBeNull();
	const avatarNames = screen
		.getAllByRole('img')
		.map((avatar) => avatar.getAttribute('aria-label'));
	expect(avatarNames).toHaveLength(2);
	expect(avatarNames).toContain('Bart Simpson');
	expect(avatarNames.join(' ')).not.toMatch(/bart_getme/i);
});

it('names the caller in an internal group chat by the member display name, not the login (OBP 2.1 #32)', () => {
	const call: CallLifecycleMessage = {
		callId: 'missed-group-call',
		roomRef: '!group:example',
		callRoomId: '!media:example',
		callType: 'audio',
		state: 'missed',
		actorUserId: '@blinky2:example',
		participants: [{ userId: '@blinky2:example', displayName: 'blinky2' }]
	};
	const activeSession = {
		isGroup: true,
		item: { moderators: [] }
	} as unknown as ExtendedSessionInterface;
	const members = [
		{
			_id: '@blinky2:example',
			username: 'blinky2',
			displayName: 'Blinky Zwei'
		}
	];
	render(
		<ActiveSessionContext.Provider
			value={{ activeSession, avatarMembers: members }}
		>
			<CallTimelineMessage call={call} />
		</ActiveSessionContext.Provider>
	);

	expect(screen.getByText(/startedBy: Blinky Zwei/)).toBeTruthy();
	expect(screen.queryByText(/blinky2/)).toBeNull();
});

it('falls back to the profile name of a group-call caller when no display name is known', () => {
	const call: CallLifecycleMessage = {
		callId: 'missed-group-call-2',
		roomRef: '!group:example',
		callRoomId: '!media:example',
		callType: 'audio',
		state: 'missed',
		actorUserId: '@blinky2:example',
		participants: [{ userId: '@blinky2:example', displayName: 'blinky2' }]
	};
	const activeSession = {
		isGroup: true,
		item: { moderators: [] }
	} as unknown as ExtendedSessionInterface;
	render(
		<ActiveSessionContext.Provider
			value={{ activeSession, avatarMembers: [] }}
		>
			<CallTimelineMessage call={call} />
		</ActiveSessionContext.Provider>
	);

	// Pre-existing behaviour: the profile name is shown when it is all there is.
	expect(screen.getByText(/startedBy: blinky2/)).toBeTruthy();
});

it('checks camera and microphone before joining, and joins only on "Jetzt beitreten" (#2016)', async () => {
	const call: CallLifecycleMessage = {
		callId: 'running-call',
		roomRef: '!source:example',
		callRoomId: '!media:example',
		callType: 'video',
		state: 'running',
		participants: [{ userId: '@alex:example', displayName: 'Alex Test' }]
	};
	// The app's join closes the check right before joining (`beforeJoin`).
	const onJoin = vi.fn(async (hooks?: CallJoinHooks) => {
		hooks?.beforeJoin?.();
		return 'joined' as const;
	});
	render(
		<CallTimelineMessage
			call={call}
			onJoin={onJoin}
			deviceCheck={() => true}
		/>
	);

	fireEvent.click(screen.getByRole('button'));
	expect(await screen.findByTestId('knock-wait-dialog')).toBeTruthy();
	expect(onJoin).not.toHaveBeenCalled();

	await act(async () => {
		fireEvent.click(screen.getByTestId('knock-wait-join'));
	});
	expect(onJoin).toHaveBeenCalledTimes(1);
	expect(screen.queryByTestId('knock-wait-dialog')).toBeNull();
});

it('joins at once where no device check is asked for (#2016)', async () => {
	const call: CallLifecycleMessage = {
		callId: 'running-call',
		roomRef: '!source:example',
		callRoomId: '!media:example',
		callType: 'video',
		state: 'running',
		participants: [{ userId: '@alex:example', displayName: 'Alex Test' }]
	};
	const onJoin = vi.fn(async () => 'joined' as const);
	render(
		<CallTimelineMessage
			call={call}
			onJoin={onJoin}
			deviceCheck={() => false}
		/>
	);
	await act(async () => {
		fireEvent.click(screen.getByRole('button'));
	});
	expect(onJoin).toHaveBeenCalledTimes(1);
	expect(screen.queryByTestId('knock-wait-dialog')).toBeNull();
});

it('waits for the counsellor in the same window when the join knocks (#2016)', async () => {
	const call: CallLifecycleMessage = {
		callId: 'running-call',
		roomRef: '!source:example',
		callRoomId: '!media:example',
		callType: 'video',
		state: 'running',
		participants: [{ userId: '@alex:example', displayName: 'Alex Test' }]
	};
	const joinOnceAdmitted = vi.fn(async () => 'joined' as const);
	const onJoin = vi.fn(async (hooks?: CallJoinHooks) => {
		hooks?.onKnock?.(
			{
				token: 'tok',
				knockId: 31,
				sessionId: 9,
				medium: 'VIDEO',
				joinExisting: true
			},
			joinOnceAdmitted
		);
		return 'joined' as const;
	});
	render(
		<CallTimelineMessage
			call={call}
			onJoin={onJoin}
			deviceCheck={() => true}
		/>
	);
	fireEvent.click(screen.getByRole('button'));
	await act(async () => {
		fireEvent.click(await screen.findByTestId('knock-wait-join'));
	});

	// Still the one dialog, now waiting; nothing joined yet.
	expect(screen.getAllByTestId('knock-wait-dialog')).toHaveLength(1);
	expect(screen.getByTestId('knock-wait-join').textContent).toContain(
		'knockWait.ready.knocking'
	);
	expect(joinOnceAdmitted).not.toHaveBeenCalled();

	// "Nicht mehr warten": back to "Jetzt beitreten" in the same dialog.
	await act(async () => {
		fireEvent.click(screen.getByTestId('knock-wait-cancel'));
	});
	expect(screen.getByTestId('knock-wait-join').textContent).toContain(
		'knockWait.ready.join'
	);
	expect(screen.getAllByTestId('knock-wait-dialog')).toHaveLength(1);
});

it('hands a knock it still waits on back to the knock gate when it goes (#2016)', async () => {
	const call: CallLifecycleMessage = {
		callId: 'running-call',
		roomRef: '!source:example',
		callRoomId: '!media:example',
		callType: 'video',
		state: 'running',
		participants: [{ userId: '@alex:example', displayName: 'Alex Test' }]
	};
	const knock = {
		token: 'tok',
		knockId: 41,
		sessionId: 9,
		medium: 'VIDEO' as const,
		joinExisting: true
	};
	const onJoin = vi.fn(async (hooks?: CallJoinHooks) => {
		rememberPendingKnock({ ...knock, joinCall: joinCallRef });
		claimKnock(knock.knockId);
		hooks?.onKnock?.(knock, async () => 'joined' as const);
		return 'joined' as const;
	});
	const view = render(
		<CallTimelineMessage
			call={call}
			onJoin={onJoin}
			deviceCheck={() => true}
		/>
	);
	fireEvent.click(screen.getByRole('button'));
	await act(async () => {
		fireEvent.click(await screen.findByTestId('knock-wait-join'));
	});
	expect(isKnockClaimed(41)).toBe(true);

	const announced = vi.fn();
	window.addEventListener(PENDING_KNOCK_EVENT, announced);
	view.unmount();
	window.removeEventListener(PENDING_KNOCK_EVENT, announced);
	expect(isKnockClaimed(41)).toBe(false);
	expect(announced).toHaveBeenCalledTimes(1);
	expect(readPendingKnock()?.joinCall).toBeUndefined();
	forgetPendingKnock();
});

it('hands a knock that arrives after the window closed to the knock gate (#2016)', async () => {
	const call: CallLifecycleMessage = {
		callId: 'running-call',
		roomRef: '!source:example',
		callRoomId: '!media:example',
		callType: 'video',
		state: 'running',
		participants: [{ userId: '@alex:example', displayName: 'Alex Test' }]
	};
	const knock = {
		token: 'tok',
		knockId: 42,
		sessionId: 9,
		medium: 'VIDEO' as const,
		joinExisting: true
	};
	let knockSent: () => void = () => undefined;
	const sent = new Promise<void>((resolve) => {
		knockSent = resolve;
	});
	let hooksSeen: CallJoinHooks | undefined;
	const onJoin = vi.fn(async (hooks?: CallJoinHooks) => {
		hooksSeen = hooks;
		await sent;
		return 'joined' as const;
	});
	const view = render(
		<CallTimelineMessage
			call={call}
			onJoin={onJoin}
			deviceCheck={() => true}
		/>
	);
	fireEvent.click(screen.getByRole('button'));
	await act(async () => {
		fireEvent.click(await screen.findByTestId('knock-wait-join'));
	});
	// Closed while the knock is still on its way.
	view.unmount();

	const announced = vi.fn();
	window.addEventListener(PENDING_KNOCK_EVENT, announced);
	await act(async () => {
		// What `joinOrKnock` does once the server answers.
		rememberPendingKnock({ ...knock, joinCall: joinCallRef });
		claimKnock(knock.knockId);
		hooksSeen?.onKnock?.(knock, async () => 'joined' as const);
		knockSent();
	});
	window.removeEventListener(PENDING_KNOCK_EVENT, announced);
	expect(isKnockClaimed(42)).toBe(false);
	expect(announced).toHaveBeenCalledTimes(1);
	// Dismissed: once let in, the gate must not put the person into the
	// call; the card's next "Beitreten" does (#2028 review).
	expect(readPendingKnock()?.knockId).toBe(42);
	expect(readPendingKnock()?.joinCall).toBeUndefined();
	forgetPendingKnock();
});

it('starts no call when the check is dismissed while the join is looked up (#2016)', async () => {
	const call: CallLifecycleMessage = {
		callId: 'running-call',
		roomRef: '!source:example',
		callRoomId: '!media:example',
		callType: 'video',
		state: 'running',
		participants: [{ userId: '@alex:example', displayName: 'Alex Test' }]
	};
	let answer: (value: null) => void = () => undefined;
	const mine = vi.fn(
		() =>
			new Promise<null>((resolve) => {
				answer = resolve;
			})
	);
	const joinCall = vi.fn(async () => 'joined' as const);
	render(
		<CallTimelineMessage
			call={call}
			onJoin={(hooks) => joinOrKnock(9, joinCall, { ...hooks, mine })}
			deviceCheck={() => true}
		/>
	);
	fireEvent.click(screen.getByRole('button'));
	await act(async () => {
		fireEvent.click(await screen.findByTestId('knock-wait-join'));
	});
	// Dismissed while the server is still asked whether to knock.
	await act(async () => {
		fireEvent.keyDown(screen.getByTestId('knock-wait-dialog'), {
			key: 'Escape'
		});
	});
	await act(async () => answer(null));

	expect(joinCall).not.toHaveBeenCalled();
	expect(screen.queryByTestId('knock-wait-dialog')).toBeNull();
	// Not a failed join: the person chose not to.
	expect(screen.queryByText('videoCall.timeline.joinFailed')).toBeNull();
});

it('says so on the card when the call after admission cannot be joined (#2016)', async () => {
	vi.mocked(apiGetOwnCallKnock).mockResolvedValueOnce({
		status: 'ADMITTED'
	} as never);
	const call: CallLifecycleMessage = {
		callId: 'running-call',
		roomRef: '!source:example',
		callRoomId: '!media:example',
		callType: 'video',
		state: 'running',
		participants: [{ userId: '@alex:example', displayName: 'Alex Test' }]
	};
	const joinOnceAdmitted = vi.fn(async () => 'ended' as const);
	render(
		<CallTimelineMessage
			call={call}
			onJoin={async (hooks) => {
				hooks?.onKnock?.(
					{
						token: 'tok',
						knockId: 51,
						sessionId: 9,
						medium: 'VIDEO',
						joinExisting: true
					},
					joinOnceAdmitted
				);
				return 'joined';
			}}
			deviceCheck={() => true}
		/>
	);
	fireEvent.click(screen.getByRole('button'));
	await act(async () => {
		fireEvent.click(await screen.findByTestId('knock-wait-join'));
	});
	// Waiting: the ✕ would withdraw the knock, so it is not offered as "close".
	expect(screen.queryByTestId('m3-dialog-close')).toBeNull();

	await waitFor(() => expect(joinOnceAdmitted).toHaveBeenCalledTimes(1), {
		timeout: 4000
	});
	expect(
		await screen.findByText('videoCall.timeline.joinFailed')
	).toBeTruthy();
});
