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
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

vi.mock('../../knockWaitDialog/KnockWaitDialog', () => ({
	KnockWaitDialog: ({ phase, knocking, onJoin }: any) => (
		<div>
			<output data-testid="phase">{knocking ? 'waiting' : phase}</output>
			<button onClick={onJoin}>join</button>
		</div>
	)
}));
vi.mock('../../waitingRoom/callEntry/useCallDeviceCheck', () => ({
	useCallDeviceCheck: () => ({
		check: { devices: { microphone: [], camera: [] } },
		controls: { micOn: true, cameraOn: false, selection: {} },
		cameraAvailable: false,
		retry: vi.fn()
	})
}));

const { CallPrejoinDialog } = await import('./CallPrejoinDialog');

const pending = {
	token: 'tok',
	knockId: 21,
	sessionId: 9,
	matrixRoomId: '!room:oriso',
	medium: 'VIDEO' as const,
	status: 'PENDING' as const
};

const dialog = (
	onClose: () => void,
	callEnded: boolean,
	status: 'PENDING' | 'ADMITTED' = 'PENDING'
) => (
	<CallPrejoinDialog
		modality="video"
		roomRef="!room:oriso"
		onClose={onClose}
		callEnded={callEnded}
		onJoin={({ onKnock }) => onKnock(pending, vi.fn())}
		knockDeps={{
			getKnock: vi.fn(() => Promise.resolve({ status })) as never,
			cancelKnock: vi.fn(),
			start: vi.fn()
		}}
		pollMs={60_000}
	/>
);

describe('CallPrejoinDialog when the call ends', () => {
	afterEach(() => {
		cleanup();
		sessionStorage.clear();
	});

	it('closes the device check, releasing the preview', () => {
		const onClose = vi.fn();
		const { rerender } = render(dialog(onClose, false));
		expect(onClose).not.toHaveBeenCalled();
		rerender(dialog(onClose, true));
		expect(onClose).toHaveBeenCalledTimes(1);
	});

	it('closes while a knock is still waiting', async () => {
		const onClose = vi.fn();
		const { rerender } = render(dialog(onClose, false));
		await act(async () => {
			fireEvent.click(screen.getByText('join'));
		});
		await waitFor(() =>
			expect(screen.getByTestId('phase').textContent).toBe('waiting')
		);
		rerender(dialog(onClose, true));
		expect(onClose).toHaveBeenCalledTimes(1);
	});

	it('does not cut off the hand-over once the person was let in', async () => {
		const onClose = vi.fn();
		const { rerender } = render(dialog(onClose, false, 'ADMITTED'));
		await act(async () => {
			fireEvent.click(screen.getByText('join'));
		});
		await waitFor(() =>
			expect(screen.getByTestId('phase').textContent).toBe('admitted')
		);
		rerender(dialog(onClose, true, 'ADMITTED'));
		expect(onClose).not.toHaveBeenCalled();
	});
});
