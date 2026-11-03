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
		onCancel
	}: {
		phase: string;
		onCancel: () => void;
	}) => (
		<>
			<div>{phase}</div>
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
