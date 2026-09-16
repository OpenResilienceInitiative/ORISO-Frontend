// @vitest-environment jsdom
import * as React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
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
			const { MessageItemComponent } = await import(
				'./MessageItemComponent'
			);
			const { MessageContextShell } = await import('./messageStoryShell');
			const {
				mockActiveSession1on1,
				mockActiveSessionGroup,
				mockMessageItemComponentProps
			} = await import('./MessageItemComponent.mocks');
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

	it.each([
		['a banned user', true, false] as const,
		['an archived session', false, true] as const
	])('offers no join action to %s', async (_, isUserBanned, isArchived) => {
		const { MessageItemComponent } = await import('./MessageItemComponent');
		const { MessageContextShell } = await import('./messageStoryShell');
		const { mockActiveSession1on1, mockMessageItemComponentProps } =
			await import('./MessageItemComponent.mocks');
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
