// @vitest-environment oriso-jsdom
import * as React from 'react';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import type { CallKnock } from './callKnockModel';
import type { WaitingConversation } from './waitingGuests';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string) => key })
}));
vi.mock('../../../services/CallManager', () => ({
	callManager: {
		hasActiveCall: () => false,
		getWaitingCall: () => null,
		subscribe: () => () => undefined
	}
}));
vi.mock('../startRoomCall', () => ({ startRoomCall: vi.fn() }));
vi.mock('../callRoomName', () => ({ directLinkCallName: () => undefined }));

const { WaitingGuestNotice } = await import('./WaitingGuestNoticeHost');
const { createFakeCallKnockTransport } = await import(
	'./fakeCallKnockTransport'
);

afterEach(cleanup);

const knock = (id: number, sessionId: number, name: string): CallKnock => ({
	id,
	sessionId,
	displayName: name,
	status: 'PENDING',
	medium: 'VIDEO',
	requestedAt: '2026-11-25T13:00:00Z'
});

const conversation = (sessionId: number): WaitingConversation => ({
	sessionId,
	roomId: `!room${sessionId}:oriso`,
	isVideo: true,
	path: `/sessions/consultant/sessionView/!room${sessionId}:oriso/${sessionId}`
});

const setup = (
	knocks: CallKnock[],
	conversations: WaitingConversation[],
	callStarts = true
) => {
	const transport = createFakeCallKnockTransport(knocks);
	const onEnterCall = vi.fn(async (_: WaitingConversation) => callStarts);
	render(
		<WaitingGuestNotice
			conversations={conversations}
			onEnterCall={onEnterCall}
			transport={transport}
			playSound={vi.fn()}
		/>
	);
	return { transport, onEnterCall };
};

describe('WaitingGuestNotice (nobody is in a call yet)', () => {
	it('shows who waits, in the corner of the page', async () => {
		setup([knock(86, 294, 'giraffe_alva_3914')], [conversation(294)]);
		const notice = await screen.findByTestId('call-knock-notice');
		expect(notice.getAttribute('data-placement')).toBe('page');
		expect(screen.getByTestId('call-knock-name').textContent).toContain(
			'giraffe_alva_3914'
		);
		// The button says what it does here: it starts the call too.
		expect(screen.getByTestId('call-knock-admit').textContent).toContain(
			'calls.knock.startAndAdmit'
		);
	});

	it('starts the call of that conversation and lets the person in with one click', async () => {
		const { transport, onEnterCall } = setup(
			[knock(86, 294, 'giraffe_alva_3914')],
			[conversation(294)]
		);
		await userEvent.click(await screen.findByTestId('call-knock-admit'));
		expect(onEnterCall).toHaveBeenCalledWith(conversation(294));
		await waitFor(() => expect(transport.decisions).toEqual(['admit:86']));
		expect(screen.queryByTestId('call-knock-notice')).toBeNull();
	});

	it('turns the person down without starting a call', async () => {
		const { transport, onEnterCall } = setup(
			[knock(86, 294, 'giraffe_alva_3914')],
			[conversation(294)]
		);
		await userEvent.click(await screen.findByTestId('call-knock-decline'));
		await waitFor(() =>
			expect(transport.decisions).toEqual(['decline:86'])
		);
		expect(onEnterCall).not.toHaveBeenCalled();
	});

	it('shows nothing when the knock was answered or withdrawn meanwhile', async () => {
		// The entry is still in the feed; the server lists nobody waiting.
		setup([], [conversation(294)]);
		await act(async () => undefined);
		expect(screen.queryByTestId('call-knock-notice')).toBeNull();
	});

	it('shows one conversation at a time, the one waiting longest, then the next', async () => {
		const { onEnterCall } = setup(
			[knock(86, 294, 'giraffe'), knock(87, 295, 'koala')],
			[conversation(294), conversation(295)]
		);
		await screen.findByTestId('call-knock-notice');
		expect(screen.getAllByTestId('call-knock-notice')).toHaveLength(1);
		expect(screen.getByTestId('call-knock-name').textContent).toContain(
			'giraffe'
		);
		await userEvent.click(screen.getByTestId('call-knock-decline'));
		await waitFor(() =>
			expect(screen.getByTestId('call-knock-name').textContent).toContain(
				'koala'
			)
		);
		await userEvent.click(screen.getByTestId('call-knock-admit'));
		expect(onEnterCall).toHaveBeenCalledWith(conversation(295));
	});

	it('lets nobody in when the call does not start: the person stays in the notice', async () => {
		// No camera or microphone, no room: the counsellor gets a message
		// and must be able to try again.
		const { transport, onEnterCall } = setup(
			[knock(86, 294, 'giraffe_alva_3914')],
			[conversation(294)],
			false
		);
		await userEvent.click(await screen.findByTestId('call-knock-admit'));
		await waitFor(() => expect(onEnterCall).toHaveBeenCalledTimes(1));
		await act(async () => undefined);
		expect(transport.decisions).toEqual([]);
		expect(screen.getByTestId('call-knock-name').textContent).toContain(
			'giraffe_alva_3914'
		);
	});

	it('finds the person who still waits among conversations that were answered', async () => {
		// Six conversations knocked today; only the oldest still waits.
		const all = [1, 2, 3, 4, 5, 6].map(conversation);
		setup([knock(90, 1, 'lamm')], all);
		expect(
			(await screen.findByTestId('call-knock-name')).textContent
		).toContain('lamm');
	});
});
