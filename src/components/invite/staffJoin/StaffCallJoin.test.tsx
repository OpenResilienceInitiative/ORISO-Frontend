// @vitest-environment oriso-jsdom

import * as React from 'react';
import {
	act,
	cleanup,
	fireEvent,
	render,
	screen
} from '@testing-library/react';
import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	vi
} from 'vite-plus/test';
import type { StaffJoin } from '../../../api/apiStaffJoin';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string) => key })
}));
vi.mock('../../anonymousChat/entryRoom/EntryRoomShell', () => ({
	EntryRoomShell: ({ children }: { children: React.ReactNode }) => (
		<main>{children}</main>
	)
}));
vi.mock('../../waitingRoom/WaitingRoomBar', () => ({
	WaitingRoomBar: ({ children }: any) => <footer>{children}</footer>
}));
vi.mock('../../app/registrationLoader/HandoverGateButton', () => ({
	HandoverGateButton: (props: any) => (
		<button
			data-testid={props.testId}
			disabled={props.state !== 'ready'}
			onClick={props.onEnter}
		>
			{props.label}
		</button>
	)
}));
vi.mock('../../app/appChunks', () => ({
	loadAuthenticatedApp: () => new Promise(() => undefined)
}));
const callManager = vi.hoisted(() => ({
	joinSharedCall: vi.fn(),
	getCurrentCall: vi.fn(() => null),
	leaveCall: vi.fn(),
	subscribe: vi.fn(() => () => undefined)
}));
vi.mock('../../../services/CallManager', () => ({ callManager }));

const {
	StaffCallJoin,
	StaffCallSeat,
	STAFF_JOIN_POLL_MS,
	STAFF_JOIN_NOT_STARTED_POLL_MS
} = await import('./StaffCallJoin');

const SEAT = {
	medium: 'VIDEO' as const,
	sourceRoomId: '!source:m.test',
	callId: 'call-1',
	callRoomId: '!call:m.test',
	guestMatrixUserId: '@c:m.test'
};

const setup = (...answers: Array<StaffJoin | Error>) => {
	const join = vi.fn();
	answers.forEach((a) =>
		a instanceof Error
			? join.mockRejectedValueOnce(a)
			: join.mockResolvedValueOnce(a)
	);
	const deps = {
		join,
		leave: vi.fn(() => Promise.resolve()),
		navigate: vi.fn(),
		renderCall: vi.fn((_seat: unknown, onEnded: () => void) => (
			<button data-testid="call" onClick={onEnded}>
				call
			</button>
		))
	};
	const view = render(
		<StaffCallJoin token="tok" medium="VIDEO" deps={deps} />
	);
	return { deps, view };
};

const phase = () =>
	screen.getByTestId('staff-join-room').getAttribute('data-phase');

const flush = () => act(async () => undefined);

const clickJoin = async () => {
	fireEvent.click(screen.getByTestId('staff-join-button'));
	await flush();
};

describe('StaffCallJoin (#2356)', () => {
	beforeEach(() => vi.useFakeTimers());
	afterEach(() => {
		cleanup();
		vi.useRealTimers();
	});

	it('offers the join first and asks nothing before the click', () => {
		const { deps } = setup();
		expect(phase()).toBe('offer');
		expect(deps.join).not.toHaveBeenCalled();
	});

	it('knocks, waits, and enters the call room once let in', async () => {
		const { deps } = setup(
			{ outcome: 'WAITING', knockId: 9 },
			{ outcome: 'SEATED', seat: SEAT }
		);
		await clickJoin();
		expect(deps.join).toHaveBeenCalledWith('tok', undefined);
		expect(phase()).toBe('waiting');

		await act(async () => {
			vi.advanceTimersByTime(STAFF_JOIN_POLL_MS);
		});
		expect(deps.join).toHaveBeenLastCalledWith('tok', 9);
		expect(screen.getByTestId('call')).toBeTruthy();
		expect(deps.renderCall).toHaveBeenCalledWith(
			SEAT,
			expect.any(Function),
			expect.any(Function)
		);
	});

	it('shows the end of the call once the seated call is over', async () => {
		setup({ outcome: 'SEATED', seat: SEAT });
		await clickJoin();
		fireEvent.click(screen.getByTestId('call'));
		expect(phase()).toBe('ended');
	});

	it('takes a counsellor of the conversation into the conversation', async () => {
		const { deps } = setup({ outcome: 'MEMBER', sessionId: 42 });
		await clickJoin();
		expect(deps.navigate).toHaveBeenCalledWith(
			'/sessions/consultant/sessionView/session/42'
		);
	});

	it('asks again by itself while the call has not started', async () => {
		const { deps } = setup(
			{ outcome: 'CALL_NOT_RUNNING' },
			{ outcome: 'WAITING', knockId: 3 }
		);
		await clickJoin();
		expect(phase()).toBe('notStarted');
		await act(async () => {
			vi.advanceTimersByTime(STAFF_JOIN_NOT_STARTED_POLL_MS);
		});
		expect(deps.join).toHaveBeenCalledTimes(2);
		expect(phase()).toBe('waiting');
	});

	it('says so when not let in', async () => {
		setup({ outcome: 'WAITING', knockId: 9 }, { outcome: 'REFUSED' });
		await clickJoin();
		await act(async () => {
			vi.advanceTimersByTime(STAFF_JOIN_POLL_MS);
		});
		expect(phase()).toBe('refused');
		expect(screen.getByTestId('staff-join-own-sessions')).toBeTruthy();
	});

	it.each([
		[{ outcome: 'NO_SHARED_CALL' } as StaffJoin, 'forbidden'],
		[new Response('', { status: 403 }), 'forbidden'],
		[new Response('', { status: 410 }), 'forbidden']
	])('cannot join on %o', async (answer, expected) => {
		const join = vi.fn(() =>
			answer instanceof Response
				? Promise.reject(answer)
				: Promise.resolve(answer)
		);
		render(<StaffCallJoin token="tok" medium="VIDEO" deps={{ join }} />);
		await clickJoin();
		expect(phase()).toBe(expected);
	});

	it('offers a retry after a failure that may pass', async () => {
		const { deps } = setup(new Error('network'), {
			outcome: 'WAITING',
			knockId: 1
		});
		await clickJoin();
		expect(phase()).toBe('error');
		await clickJoin();
		expect(deps.join).toHaveBeenCalledTimes(2);
		expect(phase()).toBe('waiting');
	});

	it('ignores an answer that arrives after "Abbrechen"', async () => {
		let answer: (value: StaffJoin) => void = () => undefined;
		const join = vi
			.fn()
			.mockResolvedValueOnce({ outcome: 'WAITING', knockId: 9 })
			.mockImplementationOnce(
				() => new Promise<StaffJoin>((resolve) => (answer = resolve))
			);
		const renderCall = vi.fn(() => <div data-testid="call" />);
		render(
			<StaffCallJoin
				token="tok"
				medium="VIDEO"
				deps={{ join, renderCall, leave: () => Promise.resolve() }}
			/>
		);
		await clickJoin();
		await act(async () => {
			vi.advanceTimersByTime(STAFF_JOIN_POLL_MS);
		});
		expect(join).toHaveBeenCalledTimes(2);

		fireEvent.click(screen.getByTestId('staff-join-cancel'));
		await act(async () => answer({ outcome: 'SEATED', seat: SEAT }));

		expect(phase()).toBe('offer');
		expect(renderCall).not.toHaveBeenCalled();
	});

	it('offers a retry, not the end of the call, when entering the call failed', async () => {
		const join = vi.fn(() =>
			Promise.resolve<StaffJoin>({ outcome: 'SEATED', seat: SEAT })
		);
		const renderCall = vi.fn(
			(_seat: unknown, _ended: () => void, failed: () => void) => (
				<button data-testid="call-failed" onClick={failed}>
					call
				</button>
			)
		);
		render(
			<StaffCallJoin
				token="tok"
				medium="VIDEO"
				deps={{ join, renderCall }}
			/>
		);
		await clickJoin();
		fireEvent.click(screen.getByTestId('call-failed'));

		expect(phase()).toBe('error');
		await clickJoin();
		expect(join).toHaveBeenCalledTimes(2);
	});

	it.each([
		['busy', () => Promise.resolve('busy')],
		['unavailable', () => Promise.resolve('unavailable')],
		['a rejected entry', () => Promise.reject(new Error('down'))]
	])(
		'StaffCallSeat reports %s as a failed entry, never as an end',
		async (_, outcome) => {
			callManager.joinSharedCall.mockImplementationOnce(outcome);
			const onEnded = vi.fn();
			const onFailed = vi.fn();
			render(
				<StaffCallSeat
					seat={SEAT}
					onEnded={onEnded}
					onFailed={onFailed}
				/>
			);
			await flush();
			await flush();

			expect(onFailed).toHaveBeenCalledTimes(1);
			expect(onEnded).not.toHaveBeenCalled();
		}
	);

	it('withdraws the knock on cancel and when the page closes', async () => {
		const { deps, view } = setup(
			{ outcome: 'WAITING', knockId: 9 },
			{ outcome: 'WAITING', knockId: 10 }
		);
		await clickJoin();
		fireEvent.click(screen.getByTestId('staff-join-cancel'));
		expect(deps.leave).toHaveBeenCalledWith('tok');
		expect(phase()).toBe('offer');

		await clickJoin();
		deps.leave.mockClear();
		view.unmount();
		expect(deps.leave).toHaveBeenCalledWith('tok');
	});
});
