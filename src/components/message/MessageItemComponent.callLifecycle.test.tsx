// @vitest-environment jsdom
import * as React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MessageItemComponent } from './MessageItemComponent';
import { MessageContextShell } from './messageStoryShell';
import {
	mockActiveSession1on1,
	mockActiveSessionGroup,
	mockMessageItemComponentProps
} from './MessageItemComponent.mocks';
import { STATUS_ARCHIVED } from '../../globalState/interfaces';

const callManagerSpies = vi.hoisted(() => ({
	joinExistingCall: vi.fn(async () => 'joined' as const),
	startCall: vi.fn()
}));

vi.mock('../../services/CallManager', () => ({
	callManager: callManagerSpies
}));
vi.mock('../../api/apiCallState', () => ({
	apiCallState: vi.fn(() => new Promise(() => {}))
}));
vi.mock('lottie-react', () => ({ default: () => null }));
vi.mock('lottie-web', () => ({ default: { loadAnimation: () => ({}) } }));
vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string, fallback?: string) => fallback ?? key
	}),
	Trans: ({ children }: { children?: React.ReactNode }) => <>{children}</>
}));

HTMLCanvasElement.prototype.getContext = (() => ({
	fillStyle: '',
	fillRect: () => {},
	drawImage: () => {},
	getImageData: () => ({ data: new Uint8ClampedArray(4) }),
	putImageData: () => {},
	createImageData: () => ({ data: new Uint8ClampedArray(4) }),
	measureText: () => ({ width: 0 }),
	fillText: () => {},
	clearRect: () => {},
	save: () => {},
	restore: () => {},
	beginPath: () => {},
	closePath: () => {},
	arc: () => {},
	fill: () => {},
	translate: () => {},
	scale: () => {}
})) as unknown as HTMLCanvasElement['getContext'];

afterEach(() => {
	cleanup();
	callManagerSpies.joinExistingCall.mockClear();
	callManagerSpies.startCall.mockClear();
});

describe('the durable call action in an actual message row', () => {
	it.each([
		['a one-to-one session', false] as const,
		['a group session', true] as const
	])(
		'joins the existing call with exact identity for %s',
		async (_, isGroup) => {
			const activeSession = isGroup
				? mockActiveSessionGroup()
				: mockActiveSession1on1();
			const callLifecycle = {
				callId: 'call-message-action',
				roomRef: activeSession.rid,
				callRoomId: '!media-room:oriso.invalid',
				callType: 'video' as const,
				state: 'running' as const,
				participants: []
			};

			render(
				<MessageContextShell activeSession={activeSession}>
					<MessageItemComponent
						{...mockMessageItemComponentProps({
							rid: activeSession.rid,
							callLifecycle
						})}
					/>
				</MessageContextShell>
			);

			fireEvent.click(screen.getByRole('button'));

			expect(callManagerSpies.joinExistingCall).toHaveBeenCalledWith(
				{
					callId: 'call-message-action',
					roomRef: activeSession.rid,
					callRoomId: '!media-room:oriso.invalid',
					callType: 'video',
					state: 'running',
					participants: []
				},
				isGroup
			);
			expect(callManagerSpies.joinExistingCall).toHaveBeenCalledTimes(1);
			expect(callManagerSpies.startCall).not.toHaveBeenCalled();
		}
	);

	it('rejoins a group call recorded in a 1:1 session as a group call', async () => {
		/*
		 * A supervision call lives in a side room of an ordinary 1:1 client
		 * session, and `startSupervisionCall` makes it a group call from the
		 * side room's own participant count. The rejoin path had only
		 * `activeSession.isGroup`, which describes the CLIENT session and is
		 * false here — so the call was rejoined as one-to-one, and leaving it
		 * takes `endCall`, which publishes a remote hangup and finalises the
		 * lifecycle while the other supervisors are still in it.
		 *
		 * The side that started the call writes what it is; this reads that.
		 */
		const activeSession = mockActiveSession1on1();
		const callLifecycle = {
			callId: 'call-supervision',
			roomRef: activeSession.rid,
			callRoomId: '!media-sv:oriso.invalid',
			callType: 'video' as const,
			state: 'running' as const,
			participants: [],
			isGroup: true
		};

		render(
			<MessageContextShell activeSession={activeSession}>
				<MessageItemComponent
					{...mockMessageItemComponentProps({
						rid: activeSession.rid,
						callLifecycle
					})}
				/>
			</MessageContextShell>
		);

		fireEvent.click(screen.getByRole('button'));

		expect(callManagerSpies.joinExistingCall).toHaveBeenCalledWith(
			expect.objectContaining({ callId: 'call-supervision' }),
			true
		);
	});

	it.each([
		['a banned user', true, false] as const,
		['an archived session', false, true] as const
	])('offers no join action to %s', async (_, isUserBanned, isArchived) => {
		const baseSession = mockActiveSession1on1();
		const activeSession = isArchived
			? {
					...baseSession,
					item: { ...baseSession.item, status: STATUS_ARCHIVED }
				}
			: baseSession;

		render(
			<MessageContextShell activeSession={activeSession}>
				<MessageItemComponent
					{...mockMessageItemComponentProps({
						rid: activeSession.rid,
						isUserBanned,
						callLifecycle: {
							callId: 'banned-call',
							roomRef: activeSession.rid,
							callRoomId: '!banned-media:oriso.invalid',
							callType: 'audio',
							state: 'running',
							participants: []
						}
					})}
				/>
			</MessageContextShell>
		);

		expect(screen.queryByRole('button')).toBeNull();
		expect(callManagerSpies.joinExistingCall).not.toHaveBeenCalled();
		expect(callManagerSpies.startCall).not.toHaveBeenCalled();
	});
});
