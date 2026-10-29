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
import { useGuestRetentionGate } from './useGuestRetentionGate';
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
let gated: boolean | undefined;

const Composer = ({ enabled = true }: { enabled?: boolean }) => {
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
});
