// @vitest-environment oriso-jsdom
import * as React from 'react';
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
import {
	ContactSheetRequest,
	useContactSheetRequest
} from './ContactSheetRequest';
import { apiRequestContactSheetEmail } from '../../api/apiRequestContactSheetEmail';

vi.mock('../../api/apiRequestContactSheetEmail', () => ({
	apiRequestContactSheetEmail: vi.fn()
}));
vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string, options?: { email?: string }) =>
			options?.email ? `${key}: ${options.email}` : key
	})
}));

beforeEach(() => vi.resetAllMocks());
afterEach(cleanup);

describe('contact-sheet request', () => {
	it('requires an address and makes no request on render', () => {
		render(<ContactSheetRequest sessionId={42} />);
		expect(screen.getByRole('button')).toHaveProperty('disabled', true);
		expect(screen.getByText('contactSheet.missingEmail')).toBeTruthy();
		expect(apiRequestContactSheetEmail).not.toHaveBeenCalled();
	});

	it('sends once per deliberate click and shows the recipient', async () => {
		vi.mocked(apiRequestContactSheetEmail).mockResolvedValue(undefined);
		render(
			<ContactSheetRequest sessionId={42} email=" seeker@example.org " />
		);
		expect(
			screen.getByText('contactSheet.recipient: seeker@example.org')
		).toBeTruthy();
		expect(apiRequestContactSheetEmail).not.toHaveBeenCalled();

		fireEvent.click(screen.getByRole('button'));
		await waitFor(() =>
			expect(screen.getByRole('status').textContent).toContain(
				'contactSheet.sent'
			)
		);
		expect(apiRequestContactSheetEmail).toHaveBeenCalledExactlyOnceWith(42);

		fireEvent.click(screen.getByRole('button'));
		await waitFor(() =>
			expect(apiRequestContactSheetEmail).toHaveBeenCalledTimes(2)
		);
	});

	it('announces a pending request before delivery finishes', async () => {
		let complete = () => undefined;
		vi.mocked(apiRequestContactSheetEmail).mockReturnValue(
			new Promise<void>((resolve) => {
				complete = resolve;
			})
		);
		render(
			<ContactSheetRequest sessionId={42} email="seeker@example.org" />
		);

		fireEvent.click(screen.getByRole('button'));
		expect(screen.getByRole('status').textContent).toBe(
			'contactSheet.sending'
		);
		expect(screen.getByRole('button')).toHaveProperty('disabled', true);

		complete();
		await waitFor(() =>
			expect(screen.getByRole('status').textContent).toContain(
				'contactSheet.sent'
			)
		);
	});

	it('shows a failed send instead of a success', async () => {
		vi.mocked(apiRequestContactSheetEmail).mockRejectedValue(
			new Error('SMTP failed')
		);
		render(
			<ContactSheetRequest sessionId={42} email="seeker@example.org" />
		);
		fireEvent.click(screen.getByRole('button'));
		await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
		expect(screen.queryByRole('status')).toBeNull();
	});

	it('keeps a request in flight when the menu remounts the item', async () => {
		let complete = () => undefined;
		vi.mocked(apiRequestContactSheetEmail).mockReturnValue(
			new Promise<void>((resolve) => {
				complete = resolve;
			})
		);
		// The menu holds the state and remounts the item on every opening.
		const Menu = ({ opening }: { opening: number }) => {
			const state = useContactSheetRequest(42, 'seeker@example.org');
			return (
				<ContactSheetRequest
					key={opening}
					sessionId={42}
					email="seeker@example.org"
					state={state}
				/>
			);
		};
		const { rerender } = render(<Menu opening={1} />);
		fireEvent.click(screen.getByRole('button'));
		rerender(<Menu opening={2} />);

		expect(screen.getByRole('status').textContent).toBe(
			'contactSheet.sending'
		);
		expect(screen.getByRole('button')).toHaveProperty('disabled', true);
		fireEvent.click(screen.getByRole('button'));
		expect(apiRequestContactSheetEmail).toHaveBeenCalledTimes(1);

		complete();
		await waitFor(() =>
			expect(screen.getByRole('status').textContent).toContain(
				'contactSheet.sent'
			)
		);
	});

	it('starts idle for another session and drops the late answer', async () => {
		let complete = () => undefined;
		vi.mocked(apiRequestContactSheetEmail).mockReturnValue(
			new Promise<void>((resolve) => {
				complete = resolve;
			})
		);
		const Menu = ({ sessionId }: { sessionId: number }) => {
			const state = useContactSheetRequest(
				sessionId,
				'seeker@example.org'
			);
			return (
				<ContactSheetRequest
					sessionId={sessionId}
					email="seeker@example.org"
					state={state}
				/>
			);
		};
		const { rerender } = render(<Menu sessionId={42} />);
		fireEvent.click(screen.getByRole('button'));
		rerender(<Menu sessionId={43} />);
		expect(screen.queryByRole('status')).toBeNull();

		complete();
		await Promise.resolve();
		await Promise.resolve();
		expect(screen.queryByRole('status')).toBeNull();
		expect(screen.getByRole('button')).toHaveProperty('disabled', false);
	});

	it('starts a returning session idle after an answer lands elsewhere', async () => {
		let complete = () => undefined;
		vi.mocked(apiRequestContactSheetEmail).mockReturnValue(
			new Promise<void>((resolve) => {
				complete = resolve;
			})
		);
		const Menu = ({ sessionId }: { sessionId: number }) => {
			const state = useContactSheetRequest(
				sessionId,
				'seeker@example.org'
			);
			return (
				<ContactSheetRequest
					sessionId={sessionId}
					email="seeker@example.org"
					state={state}
				/>
			);
		};
		const { rerender } = render(<Menu sessionId={42} />);
		fireEvent.click(screen.getByRole('button'));
		rerender(<Menu sessionId={43} />);
		complete();
		await Promise.resolve();
		await Promise.resolve();
		rerender(<Menu sessionId={42} />);

		expect(screen.queryByRole('status')).toBeNull();
		expect(screen.getByRole('button')).toHaveProperty('disabled', false);
		vi.mocked(apiRequestContactSheetEmail).mockResolvedValue(undefined);
		fireEvent.click(screen.getByRole('button'));
		await waitFor(() =>
			expect(screen.getByRole('status').textContent).toContain(
				'contactSheet.sent'
			)
		);
		expect(apiRequestContactSheetEmail).toHaveBeenCalledTimes(2);
	});
});
