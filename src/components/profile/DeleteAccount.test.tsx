// @vitest-environment oriso-jsdom

import {
	cleanup,
	fireEvent,
	render,
	screen,
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
import { DeleteAccount } from './DeleteAccount';
import type { ButtonItem } from '../button/Button';
import type { InputFieldItem } from '../inputField/InputField';
import type { OverlayItem } from '../overlay/Overlay';

const calls = vi.hoisted(() => ({
	deleteAccount: vi.fn(),
	capture: vi.fn(),
	cleanup: vi.fn(),
	isCurrentSession: vi.fn(),
	removeCookies: vi.fn()
}));

vi.mock('../../api', () => ({
	apiDeleteAskerAccount: calls.deleteAccount,
	FETCH_ERRORS: { BAD_REQUEST: 'BAD_REQUEST' }
}));
vi.mock('../../services/matrixAccountStorage', () => ({
	captureMatrixAccountForDeletion: calls.capture,
	clearDeletedMatrixAccountStorage: calls.cleanup,
	isDeletedAccountSessionCurrent: calls.isCurrentSession
}));
vi.mock('../sessionCookie/accessSessionCookie', () => ({
	removeAllCookies: calls.removeCookies
}));
vi.mock('../../hooks/useAppConfig', () => ({
	useAppConfig: () => ({ urls: { home: '#home' } })
}));
vi.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string) => key })
}));
vi.mock('../button/Button', () => ({
	BUTTON_TYPES: { PRIMARY: 'PRIMARY', SECONDARY: 'SECONDARY' },
	Button: ({
		item,
		buttonHandle
	}: {
		item: ButtonItem;
		buttonHandle: () => void;
	}) => <button onClick={buttonHandle}>{item.label}</button>
}));
vi.mock('../inputField/InputField', () => ({
	InputField: ({
		item,
		inputHandle
	}: {
		item: InputFieldItem;
		inputHandle: React.ChangeEventHandler<HTMLInputElement>;
	}) => <input aria-label={item.label} onChange={inputHandle} />
}));
vi.mock('../overlay/Overlay', () => ({
	OVERLAY_FUNCTIONS: {
		CLOSE: 'CLOSE',
		DELETE_ACCOUNT: 'DELETE_ACCOUNT',
		REDIRECT: 'REDIRECT'
	},
	Overlay: ({
		item,
		handleOverlay
	}: {
		item: OverlayItem;
		handleOverlay: (action?: string) => void;
	}) => (
		<section aria-label={item.headline}>
			{item.copy && <p>{item.copy}</p>}
			{item.nestedComponent}
			{item.buttonSet?.map((button) => (
				<button
					key={button.label}
					disabled={button.disabled}
					onClick={() => handleOverlay(button.function)}
				>
					{button.label}
				</button>
			))}
		</section>
	)
}));

const capture = {
	subject: 'deleted-subject',
	session: { identity: 'old-session', stable: true },
	userId: '@deleted:matrix.localhost',
	deviceIds: ['ORISO_WEB_DELETED']
};

const confirmDeletion = () => {
	render(<DeleteAccount />);
	fireEvent.click(
		screen.getByRole('button', { name: 'deleteAccount.button.label' })
	);
	fireEvent.change(
		screen.getByLabelText('deleteAccount.confirmOverlay.input.label'),
		{
			target: { value: 'synthetic-password' }
		}
	);
	fireEvent.click(
		screen.getByRole('button', {
			name: 'deleteAccount.confirmOverlay.button.confirm'
		})
	);
};

describe('DeleteAccount browser cleanup', () => {
	afterEach(cleanup);
	beforeEach(() => {
		vi.resetAllMocks();
		calls.capture.mockReturnValue(capture);
		calls.deleteAccount.mockResolvedValue(undefined);
		calls.isCurrentSession.mockReturnValue(true);
	});

	it('captures before DELETE, retries only local cleanup, and keeps replacement cookies', async () => {
		let serverConfirmed!: () => void;
		calls.deleteAccount.mockReturnValueOnce(
			new Promise<void>((resolve) => {
				serverConfirmed = resolve;
			})
		);
		calls.cleanup.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
		confirmDeletion();
		expect(calls.capture.mock.invocationCallOrder[0]).toBeLessThan(
			calls.deleteAccount.mock.invocationCallOrder[0]
		);
		expect(calls.cleanup).not.toHaveBeenCalled();

		calls.isCurrentSession.mockReturnValue(false);
		serverConfirmed();
		const retry = await screen.findByRole('button', {
			name: 'deleteAccount.successOverlay.retryCleanup'
		});
		expect(
			screen.getByText('deleteAccount.successOverlay.cleanupIncomplete')
		).toBeTruthy();
		fireEvent.click(retry);

		await waitFor(() =>
			expect(
				screen.queryByText(
					'deleteAccount.successOverlay.cleanupIncomplete'
				)
			).toBeNull()
		);
		expect(calls.cleanup.mock.calls).toEqual([[capture], [capture]]);
		expect(calls.deleteAccount).toHaveBeenCalledOnce();
		fireEvent.click(
			screen.getByRole('button', {
				name: 'deleteAccount.successOverlay.button'
			})
		);
		expect(calls.isCurrentSession).toHaveBeenCalledWith(capture);
		expect(calls.removeCookies).not.toHaveBeenCalled();
	});

	it('shows retry after a local exception instead of wedging the success overlay', async () => {
		calls.cleanup.mockRejectedValueOnce(new Error('storage unavailable'));
		confirmDeletion();

		expect(
			await screen.findByText(
				'deleteAccount.successOverlay.cleanupIncomplete'
			)
		).toBeTruthy();
		expect(
			(
				screen.getByRole('button', {
					name: 'deleteAccount.successOverlay.retryCleanup'
				}) as HTMLButtonElement
			).disabled
		).toBe(false);
	});

	it('retains password validation and waits for the server before cleanup', async () => {
		calls.deleteAccount.mockRejectedValueOnce(new Error('BAD_REQUEST'));
		confirmDeletion();

		expect(
			await screen.findByText(
				'deleteAccount.confirmOverlay.input.warning'
			)
		).toBeTruthy();
		expect(calls.cleanup).not.toHaveBeenCalled();
	});
});
