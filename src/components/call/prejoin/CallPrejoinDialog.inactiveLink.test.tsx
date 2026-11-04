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
import { NotificationsContext } from '../../../globalState';

vi.mock('../../knockWaitDialog/KnockWaitDialog', () => ({
	KnockWaitDialog: ({ phase, onJoin, onKnockAgain }: any) => (
		<div>
			<output data-testid="phase">{phase ?? 'check'}</output>
			<button onClick={onJoin}>join</button>
			{onKnockAgain && <button onClick={onKnockAgain}>again</button>}
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
vi.mock('react-i18next', () => {
	const t = (key: string) =>
		key === 'directLink.entry.inactive'
			? 'Dieser Link ist nicht mehr aktiv.'
			: key;
	return { useTranslation: () => ({ t }) };
});

const { CallPrejoinDialog } = await import('./CallPrejoinDialog');

const pending = {
	token: 'tok',
	knockId: 21,
	sessionId: 9,
	matrixRoomId: '!room:oriso',
	medium: 'VIDEO' as const,
	status: 'DECLINED' as const
};

const knockAgainRefusedWith = async (refusal: unknown) => {
	const addNotification = vi.fn();
	render(
		<NotificationsContext.Provider
			value={{ addNotification } as unknown as never}
		>
			<CallPrejoinDialog
				modality="video"
				roomRef="!room:oriso"
				onClose={vi.fn()}
				onJoin={({ onKnock }) => onKnock(pending, vi.fn())}
				knockDeps={{
					getKnock: vi.fn(() => new Promise(() => undefined)),
					cancelKnock: vi.fn(),
					start: vi.fn(() => Promise.reject(refusal))
				}}
				pollMs={60_000}
			/>
		</NotificationsContext.Provider>
	);
	await act(async () => {
		fireEvent.click(screen.getByText('join'));
	});
	await waitFor(() => screen.getByText('again'));
	await act(async () => {
		fireEvent.click(screen.getByText('again'));
	});
	/* Back on the device check: the knock is gone. */
	await waitFor(() => expect(screen.queryByText('again')).toBeNull());
	return addNotification;
};

describe('CallPrejoinDialog when knocking again is refused', () => {
	afterEach(() => {
		cleanup();
		sessionStorage.clear();
	});

	it('says the link is no longer active when it was switched off (#2012)', async () => {
		const addNotification = await knockAgainRefusedWith({
			status: 410
		});
		expect(addNotification).toHaveBeenCalledWith(
			expect.objectContaining({
				title: 'Dieser Link ist nicht mehr aktiv.'
			})
		);
	});

	it('says the link is paused when the server says so', async () => {
		const addNotification = await knockAgainRefusedWith(
			new Response('{"reason":"DIRECT_LINK_INACTIVE"}', { status: 410 })
		);
		expect(addNotification).toHaveBeenCalledWith(
			expect.objectContaining({ title: 'inviteLink.paused' })
		);
	});

	it('goes back to the check silently for any other refusal', async () => {
		const addNotification = await knockAgainRefusedWith({ status: 500 });
		expect(addNotification).not.toHaveBeenCalled();
	});
});
