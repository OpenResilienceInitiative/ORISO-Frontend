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
import { AgencyContactPersonSection } from './AgencyContactPersonSection';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string) => key })
}));

let appConfig: { supportEmail?: string } = {};
vi.mock('../../hooks/useAppConfig', () => ({
	useAppConfig: () => appConfig
}));

const apiMock = vi.fn();
vi.mock('../../api/apiGetAgencyContactPerson', () => ({
	apiGetAgencyContactPerson: (...args: unknown[]) => apiMock(...args)
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

const K = 'profile.data.agency.contactPerson';

const counsellingContact = {
	source: 'OWN',
	people: [
		{
			role: 'CONTACT',
			displayName: 'Maria Muster',
			email: 'maria@example.org',
			isConsultant: true,
			chatConsultantId: 'c-1'
		}
	]
};

afterEach(cleanup);

beforeEach(() => {
	appConfig = {};
	apiMock.mockReset();
	submit.mockReset();
	hookState = { isSubmitting: false, errorReason: null };
});

const renderIt = (name = 'Beratungsstelle Nord') =>
	render(<AgencyContactPersonSection agencyId={7} agencyName={name} />);

describe('AgencyContactPersonSection (ORISO-Admin#1534)', () => {
	it('shows a loading line first, then the contact of the centre', async () => {
		apiMock.mockResolvedValue(counsellingContact);
		renderIt();

		expect(screen.getByText(`${K}.loading`)).toBeTruthy();
		expect(await screen.findByText('Maria Muster')).toBeTruthy();
		expect(apiMock).toHaveBeenCalledWith(7);
	});

	it('opens one chat with the contact, named after the centre', async () => {
		apiMock.mockResolvedValue(counsellingContact);
		renderIt();

		fireEvent.click(await screen.findByRole('button'));
		expect(submit).toHaveBeenCalledWith({
			selectedIds: ['c-1'],
			agencyId: 7,
			name: 'Beratungsstelle Nord'
		});
	});

	it('cuts a long centre name to the 50 characters a chat name allows', async () => {
		apiMock.mockResolvedValue(counsellingContact);
		renderIt('B'.repeat(80));
		fireEvent.click(await screen.findByRole('button'));
		expect(submit.mock.calls[0][0].name).toBe('B'.repeat(50));
	});

	it('uses a fallback name when the centre name is too short', async () => {
		apiMock.mockResolvedValue(counsellingContact);
		renderIt('X');
		fireEvent.click(await screen.findByRole('button'));
		expect(submit.mock.calls[0][0].name).toBe(`${K}.chatFallbackName`);
	});

	it('falls back to the support address when the contact cannot be loaded', async () => {
		appConfig = { supportEmail: 'support@example.org' };
		apiMock.mockRejectedValue(new Error('CATCH_ALL'));
		renderIt();

		await waitFor(() =>
			expect(screen.getByText(`${K}.loadError`)).toBeTruthy()
		);
		expect(
			screen
				.getByRole('link', { name: 'support@example.org' })
				.getAttribute('href')
		).toBe('mailto:support@example.org');
		expect(screen.queryByText(`${K}.support.heading`)).toBeNull();
	});

	it('names the refusal of the chat service next to the button', async () => {
		apiMock.mockResolvedValue(counsellingContact);
		hookState = {
			isSubmitting: false,
			errorReason: 'INTERNAL_CHAT_RECIPIENT_OUT_OF_SCOPE'
		};
		renderIt();

		expect(
			await screen.findByText('groupChat.internal.error.outOfScope')
		).toBeTruthy();
	});
});
