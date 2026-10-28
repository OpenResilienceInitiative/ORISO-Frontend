// @vitest-environment oriso-jsdom
import * as React from 'react';
import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	vi
} from 'vite-plus/test';
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor
} from '@testing-library/react';
import { AgencyAdminContact } from './AgencyAdminContact';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string) => key })
}));

const apiMock = vi.fn();
vi.mock('../../api/apiGetAgencyAdminContacts', () => ({
	apiGetAgencyAdminContacts: (...args: unknown[]) => apiMock(...args)
}));

const submit = vi.fn();
let hookState: { isSubmitting: boolean; errorReason: string | null } = {
	isSubmitting: false,
	errorReason: null
};
vi.mock('../conversationCreate/useInternalSubsetChatSubmit', () => ({
	useInternalSubsetChatSubmit: () => ({
		submit,
		clearError: vi.fn(),
		...hookState
	})
}));

afterEach(cleanup);

beforeEach(() => {
	apiMock.mockReset();
	submit.mockReset();
	hookState = { isSubmitting: false, errorReason: null };
});

const renderIt = (name = 'Beratungsstelle Nord') =>
	render(<AgencyAdminContact agencyId={7} agencyName={name} />);

describe('AgencyAdminContact (#117)', () => {
	it('shows the contact link when admins exist and opens one chat with all of them, named after the centre', async () => {
		apiMock.mockResolvedValue([
			{ consultantId: 'a1', displayName: 'Maria Muster' },
			{ consultantId: 'a2', displayName: 'Ali Beispiel' }
		]);
		renderIt();

		const link = await screen.findByRole('button', {
			name: 'profile.data.agency.adminContact.link'
		});
		fireEvent.click(link);

		expect(apiMock).toHaveBeenCalledWith(7);
		expect(submit).toHaveBeenCalledWith({
			selectedIds: ['a1', 'a2'],
			agencyId: 7,
			name: 'Beratungsstelle Nord'
		});
	});

	it('cuts a long centre name to the 50 characters the chat name allows', async () => {
		apiMock.mockResolvedValue([{ consultantId: 'a1', displayName: 'M' }]);
		renderIt('B'.repeat(80));
		fireEvent.click(await screen.findByRole('button'));
		expect(submit.mock.calls[0][0].name).toBe('B'.repeat(50));
	});

	it('uses a fallback name when the centre name is too short for a chat name', async () => {
		apiMock.mockResolvedValue([{ consultantId: 'a1', displayName: 'M' }]);
		renderIt('X');
		fireEvent.click(await screen.findByRole('button'));
		expect(submit.mock.calls[0][0].name).toBe(
			'profile.data.agency.adminContact.fallbackName'
		);
	});

	it('shows the hint, not a link, when the centre has no admin', async () => {
		apiMock.mockResolvedValue([]);
		renderIt();

		expect(
			await screen.findByText('profile.data.agency.adminContact.none')
		).toBeTruthy();
		expect(screen.queryByRole('button')).toBeNull();
	});

	it('shows a hint, not a link, and does not throw when the admins cannot be loaded', async () => {
		apiMock.mockRejectedValue(new Error('CATCH_ALL'));
		renderIt();

		await waitFor(() =>
			expect(
				screen.getByText('profile.data.agency.adminContact.error')
			).toBeTruthy()
		);
		expect(screen.queryByRole('button')).toBeNull();
	});

	it('names the refusal of the chat service next to the link', async () => {
		apiMock.mockResolvedValue([{ consultantId: 'a1', displayName: 'M' }]);
		hookState = {
			isSubmitting: false,
			errorReason: 'INTERNAL_CHAT_RECIPIENT_OUT_OF_SCOPE'
		};
		renderIt();

		expect(
			await screen.findByText('groupChat.internal.error.outOfScope')
		).toBeTruthy();
	});

	it('disables the link while the room is being opened', async () => {
		apiMock.mockResolvedValue([{ consultantId: 'a1', displayName: 'M' }]);
		hookState = { isSubmitting: true, errorReason: null };
		renderIt();

		const link = (await screen.findByRole('button')) as HTMLButtonElement;
		expect(link.disabled).toBe(true);
	});
});
