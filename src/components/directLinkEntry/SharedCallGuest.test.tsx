// @vitest-environment oriso-jsdom
import * as React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import { apiJoinSharedCall } from '../../api/apiJoinSharedCall';
import {
	apiCancelOwnCallKnock,
	apiGetOwnCallKnock
} from '../../api/apiDirectLinks';
import { callManager } from '../../services/CallManager';
import { UserDataContext } from '../../globalState/context/UserDataContext';
import { forgetAllJoinMedia, peekJoinMedia } from '../call/prejoin/callPrejoin';
import { SharedCallGuest } from './SharedCallGuest';

vi.mock('../../api/apiJoinSharedCall', () => ({ apiJoinSharedCall: vi.fn() }));
vi.mock('../../api/apiDirectLinks', () => ({
	apiCancelOwnCallKnock: vi.fn(),
	apiGetOwnCallKnock: vi.fn()
}));
vi.mock('../../services/CallManager', () => ({
	callManager: {
		joinSharedCall: vi.fn(),
		getCurrentCall: vi.fn(),
		subscribe: vi.fn(() => () => undefined),
		hasActiveCall: vi.fn(() => false),
		leaveCall: vi.fn()
	}
}));
vi.mock('../knockWaitDialog/KnockWaitDialog', () => ({
	KnockWaitDialog: ({
		phase,
		onCancel,
		media
	}: {
		phase: string;
		onCancel: () => void;
		media: {
			micOn: boolean;
			cameraOn: boolean;
			avatar: { file: string };
			onToggleMic: () => void;
		};
	}) => (
		<>
			<div>{phase}</div>
			<div>{`mic ${media.micOn ? 'on' : 'off'}`}</div>
			<div>{`camera ${media.cameraOn ? 'on' : 'off'}`}</div>
			<div>{`avatar ${media.avatar.file}`}</div>
			<button onClick={media.onToggleMic}>toggle mic</button>
			<button onClick={onCancel}>cancel</button>
		</>
	)
}));
vi.mock('../waitingRoom/callEntry/useLiveCallDevices', () => ({
	useLiveCallDevices: () => ({
		devices: { camera: [], microphone: [], speaker: [] },
		micLevel: 0
	})
}));
vi.mock('../app/Loading', () => ({ Loading: () => <div>loading</div> }));
vi.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string) => key })
}));

const seat = {
	medium: 'VIDEO' as const,
	sourceRoomId: '!counselling:example',
	callId: 'call-1',
	callRoomId: '!call:example',
	guestMatrixUserId: '@guest:example'
};

const pending = {
	callAdmitted: false,
	knockId: 5,
	knockStatus: 'PENDING'
} as const;
const admitted = { callAdmitted: true, seat } as const;

const open = () => render(<SharedCallGuest token="link" modality="video" />);

describe('guest entry into a running call', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		forgetAllJoinMedia();
		vi.mocked(callManager.joinSharedCall).mockResolvedValue('joined');
	});

	it('joins the existing call once the server grants a direct seat', async () => {
		vi.mocked(apiJoinSharedCall).mockResolvedValueOnce(admitted);
		open();
		await waitFor(() =>
			expect(callManager.joinSharedCall).toHaveBeenCalledWith(
				seat,
				expect.any(AbortSignal)
			)
		);
		expect(apiJoinSharedCall).toHaveBeenCalledWith('link');
		expect(apiGetOwnCallKnock).not.toHaveBeenCalled();
	});

	it('waits for admission and obtains a seat through the same link', async () => {
		vi.mocked(apiJoinSharedCall)
			.mockResolvedValueOnce(pending)
			.mockResolvedValueOnce(admitted);
		vi.mocked(apiGetOwnCallKnock).mockResolvedValueOnce({
			id: 5,
			status: 'ADMITTED'
		} as Awaited<ReturnType<typeof apiGetOwnCallKnock>>);
		open();
		await waitFor(
			() => expect(callManager.joinSharedCall).toHaveBeenCalledTimes(1),
			{ timeout: 3000 }
		);
		expect(apiGetOwnCallKnock).toHaveBeenCalledWith(5);
		expect(apiJoinSharedCall).toHaveBeenCalledTimes(2);
	});

	it.each([
		[410, 'directLink.entry.inactive'],
		[403, 'calls.share.joinForbidden'],
		[409, 'calls.share.conversationMember']
	])(
		'explains status %s without joining a Matrix room',
		async (status, message) => {
			vi.mocked(apiJoinSharedCall).mockRejectedValueOnce(
				new Response(null, { status })
			);
			open();
			await screen.findByText(message);
			expect(callManager.joinSharedCall).not.toHaveBeenCalled();
			expect(apiGetOwnCallKnock).not.toHaveBeenCalled();
		}
	);

	it('withdraws a knock without joining any room', async () => {
		vi.mocked(apiJoinSharedCall).mockResolvedValueOnce(pending);
		vi.mocked(apiGetOwnCallKnock).mockReturnValue(
			new Promise(() => undefined)
		);
		vi.mocked(apiCancelOwnCallKnock).mockResolvedValueOnce(undefined);
		open();
		fireEvent.click(await screen.findByRole('button', { name: 'cancel' }));
		expect(apiCancelOwnCallKnock).toHaveBeenCalledWith(5);
		expect(callManager.joinSharedCall).not.toHaveBeenCalled();
	});
});

/*
 * FE#2209 live test (16 Nov): after admission the guest met a second, plain
 * Element Call lobby. The call now skips it, so the choice made before
 * entering has to travel with the guest into the call.
 */
describe("the guest's device choice", () => {
	const preJoin = {
		controls: { micOn: true, cameraOn: false, selection: {} },
		cameraAvailable: true
	};

	beforeEach(() => {
		vi.clearAllMocks();
		forgetAllJoinMedia();
	});

	it('goes into the call when the server seats the guest at once', async () => {
		let atJoin: unknown = 'not joined';
		vi.mocked(callManager.joinSharedCall).mockImplementation(async () => {
			atJoin = peekJoinMedia(seat.callRoomId);
			return 'joined';
		});
		vi.mocked(apiJoinSharedCall).mockResolvedValueOnce(admitted);
		render(
			<SharedCallGuest
				token="link"
				modality="video"
				deviceChoice={preJoin}
			/>
		);
		await waitFor(() =>
			expect(callManager.joinSharedCall).toHaveBeenCalled()
		);
		expect(atJoin).toEqual({ audio_enabled: true, video_enabled: false });
	});

	it('opens the knock wait with it, and enters with what was changed there', async () => {
		let atJoin: unknown = 'not joined';
		vi.mocked(callManager.joinSharedCall).mockImplementation(async () => {
			atJoin = peekJoinMedia(seat.callRoomId);
			return 'joined';
		});
		let admit: (value: unknown) => void = () => undefined;
		vi.mocked(apiJoinSharedCall)
			.mockResolvedValueOnce(pending)
			.mockResolvedValueOnce(admitted);
		vi.mocked(apiGetOwnCallKnock).mockReturnValueOnce(
			new Promise((resolve) => {
				admit = resolve;
			}) as ReturnType<typeof apiGetOwnCallKnock>
		);
		render(
			<SharedCallGuest
				token="link"
				modality="video"
				deviceChoice={preJoin}
			/>
		);
		await screen.findByText('mic on');
		screen.getByText('camera off');
		fireEvent.click(screen.getByRole('button', { name: 'toggle mic' }));
		await screen.findByText('mic off');
		admit({ id: 5, status: 'ADMITTED' });
		await waitFor(
			() => expect(callManager.joinSharedCall).toHaveBeenCalledTimes(1),
			{ timeout: 3000 }
		);
		expect(atJoin).toEqual({ audio_enabled: false, video_enabled: false });
	});
});

describe("the guest's animal while knocking", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('is the one picked before entering, not one derived from the id', async () => {
		vi.mocked(apiJoinSharedCall).mockResolvedValueOnce(pending);
		vi.mocked(apiGetOwnCallKnock).mockReturnValue(
			new Promise(() => undefined)
		);
		render(
			<UserDataContext.Provider
				value={
					{
						userData: {
							userId: 'guest-1',
							userName: 'lamm_rene_1769',
							avatarId: 'lamb'
						}
					} as never
				}
			>
				<SharedCallGuest token="link" modality="video" />
			</UserDataContext.Provider>
		);
		await screen.findByText('avatar lamb.svg');
	});
});
