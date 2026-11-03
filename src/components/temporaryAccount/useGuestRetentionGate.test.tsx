// @vitest-environment oriso-jsdom
import * as React from 'react';
import {
	act,
	cleanup,
	render,
	screen,
	fireEvent,
	waitFor
} from '@testing-library/react';
import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	vi
} from 'vite-plus/test';
import {
	apiGetTemporaryAccount,
	apiPutMessageRetention
} from '../../api/apiTemporaryAccount';
import { NotificationsContext } from '../../globalState/provider/NotificationsProvider';
import { LOOKUP_WAIT_MS, useGuestRetentionGate } from './useGuestRetentionGate';
import { resetTemporaryAccount } from './temporaryAccountStore';

vi.mock('../../api/apiTemporaryAccount', () => ({
	apiGetTemporaryAccount: vi.fn(() => Promise.resolve(null)),
	apiPutMessageRetention: vi.fn()
}));
vi.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string) => key })
}));
vi.mock('./KeepMessagesDialog', () => ({
	KeepMessagesDialog: ({ onConfirm, onCancel }: any) => (
		<div data-testid="keep-messages-dialog">
			<button onClick={() => onConfirm('keep')}>keep</button>
			<button onClick={onCancel}>cancel</button>
		</div>
	)
}));

const send = vi.fn();
const addNotification = vi.fn();
let gated: boolean | undefined;

const Inner = ({ enabled }: { enabled: boolean }) => {
	const { gate, dialog } = useGuestRetentionGate(enabled);
	return (
		<>
			<button
				onClick={() => {
					gated = gate(send);
					if (!gated) send();
				}}
			>
				send
			</button>
			{dialog}
		</>
	);
};

const Composer = ({ enabled = true }: { enabled?: boolean }) => (
	<NotificationsContext.Provider value={{ addNotification } as any}>
		<Inner enabled={enabled} />
	</NotificationsContext.Provider>
);

afterEach(cleanup);

beforeEach(() => {
	vi.clearAllMocks();
	gated = undefined;
	resetTemporaryAccount({
		messageRetention: 'GUEST_DECIDES',
		keepMessages: null
	});
});

describe('useGuestRetentionGate', () => {
	it('asks first, saves the answer, then sends', async () => {
		vi.mocked(apiPutMessageRetention).mockResolvedValue('saved');
		render(<Composer />);
		fireEvent.click(screen.getByText('send'));
		expect(gated).toBe(true);
		expect(send).not.toHaveBeenCalled();
		fireEvent.click(screen.getByText('keep'));
		await waitFor(() => expect(send).toHaveBeenCalledOnce());
		expect(apiPutMessageRetention).toHaveBeenCalledWith(true);
		expect(screen.queryByTestId('keep-messages-dialog')).toBeNull();

		// Asked once: the next message goes straight out.
		fireEvent.click(screen.getByText('send'));
		expect(gated).toBe(false);
	});

	it('sends nothing when the guest cancels', () => {
		render(<Composer />);
		fireEvent.click(screen.getByText('send'));
		fireEvent.click(screen.getByText('cancel'));
		expect(send).not.toHaveBeenCalled();
		expect(apiPutMessageRetention).not.toHaveBeenCalled();
	});

	it('still sends after a 409: the answer exists elsewhere', async () => {
		vi.mocked(apiPutMessageRetention).mockResolvedValue('alreadyDecided');
		render(<Composer />);
		fireEvent.click(screen.getByText('send'));
		await act(async () => {
			fireEvent.click(screen.getByText('keep'));
		});
		await waitFor(() => expect(send).toHaveBeenCalledOnce());
	});

	it('never asks a counsellor or a normal account', () => {
		render(<Composer enabled={false} />);
		fireEvent.click(screen.getByText('send'));
		expect(gated).toBe(false);
		cleanup();
		resetTemporaryAccount(null, 'ready');
		render(<Composer />);
		fireEvent.click(screen.getByText('send'));
		expect(gated).toBe(false);
	});

	it('holds a send until the lookup answers, then asks', async () => {
		resetTemporaryAccount();
		vi.mocked(apiGetTemporaryAccount).mockResolvedValue({
			messageRetention: 'GUEST_DECIDES',
			keepMessages: null
		});
		render(<Composer />);
		fireEvent.click(screen.getByText('send'));
		expect(gated).toBe(true);
		await screen.findByTestId('keep-messages-dialog');
		expect(send).not.toHaveBeenCalled();
	});

	it('retries a failed lookup on the next send', async () => {
		resetTemporaryAccount(null, 'failed');
		vi.mocked(apiGetTemporaryAccount).mockResolvedValue({
			messageRetention: 'GUEST_DECIDES',
			keepMessages: null
		});
		render(<Composer />);
		fireEvent.click(screen.getByText('send'));
		await screen.findByTestId('keep-messages-dialog');
		expect(apiGetTemporaryAccount).toHaveBeenCalled();
		expect(send).not.toHaveBeenCalled();
	});

	it('sends unasked when the person has no temporary account', async () => {
		resetTemporaryAccount();
		vi.mocked(apiGetTemporaryAccount).mockResolvedValue(null);
		render(<Composer />);
		fireEvent.click(screen.getByText('send'));
		await waitFor(() => expect(send).toHaveBeenCalledOnce());
		expect(screen.queryByTestId('keep-messages-dialog')).toBeNull();
	});

	// #2009: a guest the app cannot look up is never sent unasked.
	describe('when the account lookup does not answer', () => {
		const lookupNotice = () =>
			expect.objectContaining({
				notificationType: 'error',
				title: 'temporaryAccount.lookupFailed.title',
				text: 'temporaryAccount.lookupFailed.text',
				announce: 'alert'
			});

		it('holds the send and says so when the lookup fails twice', async () => {
			resetTemporaryAccount(null, 'failed');
			vi.mocked(apiGetTemporaryAccount).mockRejectedValue(
				new Error('503')
			);
			render(<Composer />);
			fireEvent.click(screen.getByText('send'));
			expect(gated).toBe(true);
			await waitFor(() =>
				expect(addNotification).toHaveBeenCalledWith(lookupNotice())
			);
			expect(send).not.toHaveBeenCalled();
			expect(screen.queryByTestId('keep-messages-dialog')).toBeNull();
		});

		it('holds the send and says so when the lookup takes too long', async () => {
			vi.useFakeTimers();
			try {
				resetTemporaryAccount();
				vi.mocked(apiGetTemporaryAccount).mockReturnValue(
					new Promise(() => undefined)
				);
				render(<Composer />);
				fireEvent.click(screen.getByText('send'));
				expect(send).not.toHaveBeenCalled();
				expect(addNotification).not.toHaveBeenCalled();
				await act(async () => {
					await vi.advanceTimersByTimeAsync(LOOKUP_WAIT_MS);
				});
				expect(send).not.toHaveBeenCalled();
				expect(addNotification).toHaveBeenCalledWith(lookupNotice());
				expect(screen.queryByTestId('keep-messages-dialog')).toBeNull();
			} finally {
				vi.useRealTimers();
			}
		});

		it('asks first once the lookup recovers on a second try', async () => {
			resetTemporaryAccount(null, 'failed');
			vi.mocked(apiGetTemporaryAccount).mockRejectedValueOnce(
				new Error('503')
			);
			render(<Composer />);
			fireEvent.click(screen.getByText('send'));
			await waitFor(() => expect(addNotification).toHaveBeenCalledOnce());

			vi.mocked(apiGetTemporaryAccount).mockResolvedValue({
				messageRetention: 'GUEST_DECIDES',
				keepMessages: null
			});
			fireEvent.click(screen.getByText('send'));
			await screen.findByTestId('keep-messages-dialog');
			expect(send).not.toHaveBeenCalled();
			vi.mocked(apiPutMessageRetention).mockResolvedValue('saved');
			fireEvent.click(screen.getByText('keep'));
			await waitFor(() => expect(send).toHaveBeenCalledOnce());
			expect(addNotification).toHaveBeenCalledOnce();
		});

		it('does not send when the lookup lands after the wait ran out and says so', async () => {
			vi.useFakeTimers();
			try {
				resetTemporaryAccount();
				let land: (value: null) => void = () => undefined;
				vi.mocked(apiGetTemporaryAccount).mockReturnValue(
					new Promise((resolve) => {
						land = resolve;
					})
				);
				render(<Composer />);
				fireEvent.click(screen.getByText('send'));
				await act(async () => {
					await vi.advanceTimersByTimeAsync(LOOKUP_WAIT_MS);
				});
				expect(send).not.toHaveBeenCalled();
				// The late answer is kept: the next try needs no new wait.
				await act(async () => {
					land(null);
				});
				fireEvent.click(screen.getByText('send'));
				expect(gated).toBe(false);
				expect(send).toHaveBeenCalledOnce();
			} finally {
				vi.useRealTimers();
			}
		});

		it('sends one message per try, never twice', async () => {
			resetTemporaryAccount(null, 'failed');
			vi.mocked(apiGetTemporaryAccount).mockRejectedValue(
				new Error('503')
			);
			render(<Composer />);
			fireEvent.click(screen.getByText('send'));
			fireEvent.click(screen.getByText('send'));
			await waitFor(() => expect(addNotification).toHaveBeenCalled());
			expect(send).not.toHaveBeenCalled();
		});
	});
});
