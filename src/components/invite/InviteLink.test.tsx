// @vitest-environment jsdom

import * as React from 'react';
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor
} from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { redeemInviteLink } from '../../api/apiRedeemInviteLink';
import { apiPostRegistration } from '../../api/apiPostRegistration';
import { LocaleContext, TenantContext } from '../../globalState';
import { GlobalComponentContext } from '../../globalState/provider/GlobalComponentContext';
import { redirectToApp } from '../registration/autoLogin';
import {
	applyRedeemSessionCredentials,
	assignInviteSessionDisplayName,
	redirectToInviteSession
} from './inviteLinkHelpers';
import { apiGetAnonymousEnquiryDetails } from '../../api/apiGetAnonymousEnquiryDetails';

vi.mock('../../api/apiRedeemInviteLink', async () => {
	const actual = await vi.importActual<
		typeof import('../../api/apiRedeemInviteLink')
	>('../../api/apiRedeemInviteLink');
	return {
		...actual,
		redeemInviteLink: vi.fn()
	};
});

vi.mock('../../api/apiPostRegistration', () => ({
	apiPostRegistration: vi.fn()
}));

vi.mock('../../api/apiGetAnonymousEnquiryDetails', () => ({
	apiGetAnonymousEnquiryDetails: vi.fn()
}));

vi.mock('../registration/autoLogin', () => ({
	redirectToApp: vi.fn()
}));

vi.mock('../anonymousChat/entryRoom/LiveChatEntryRoom', () => ({
	LiveChatEntryRoom: ({ sessionId }: { sessionId: number }) => (
		<div data-testid="live-chat-entry-room">room {sessionId}</div>
	)
}));
vi.mock('./inviteLinkHelpers', () => ({
	applyRedeemSessionCredentials: vi.fn(),
	assignInviteSessionDisplayName: vi.fn(),
	redirectToInviteSession: vi.fn()
}));

vi.mock('lottie-web', () => ({ default: {} }));
vi.mock('lottie-react', () => ({ default: () => null }));
vi.mock('../stage/stage', () => ({
	Stage: () => null
}));

vi.mock('../stageLayout/StageLayout', () => ({
	StageLayout: ({ children }: { children: React.ReactNode }) => (
		<main>{children}</main>
	)
}));

vi.mock('../pseudonym/AnimalAvatar', () => ({
	AnimalAvatar: () => <div data-testid="animal-avatar" />
}));

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (_key: string, fallback?: string) => fallback ?? _key
	})
}));

const { InviteLink } = await import('./InviteLink');

const localeValue = {
	locale: 'de',
	initLocale: 'de',
	setLocale: vi.fn(),
	locales: ['de'],
	selectableLocales: ['de']
};

const tenantValue = {
	tenant: { id: 1 },
	setTenant: vi.fn()
};

const Stage = () => <div data-testid="stage" />;

const renderInvite = () =>
	render(
		<GlobalComponentContext.Provider value={{ Stage }}>
			<TenantContext.Provider value={tenantValue as any}>
				<LocaleContext.Provider value={localeValue}>
					<MemoryRouter initialEntries={['/invite/token-123']}>
						<Routes>
							<Route
								path="/invite/:token"
								element={<InviteLink />}
							/>
						</Routes>
					</MemoryRouter>
				</LocaleContext.Provider>
			</TenantContext.Provider>
		</GlobalComponentContext.Provider>
	);

describe('InviteLink legacy identity', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(redeemInviteLink).mockResolvedValue({
			tenantId: 1,
			agencyId: 7,
			consultingTypeId: 3,
			topicId: 11
		});
		vi.mocked(apiPostRegistration).mockResolvedValue(undefined);
	});

	it('shows a re-rollable User-ID and does not register until continue', async () => {
		renderInvite();

		const usernameField = await screen.findByLabelText('User-ID');
		const username = (usernameField as HTMLInputElement).value;

		expect(username).not.toMatch(/^Anonymous-/);
		expect(username).toMatch(/^[a-z0-9_]+_\d{4}$/);
		expect(usernameField).toHaveProperty('readOnly', true);
		expect(apiPostRegistration).not.toHaveBeenCalled();

		fireEvent.click(screen.getByRole('button', { name: 'Name ändern' }));

		await waitFor(() => {
			expect((usernameField as HTMLInputElement).value).not.toMatch(
				/^Anonymous-/
			);
		});

		fireEvent.click(
			screen.getByRole('button', { name: 'Weiter mit Auswahl' })
		);

		await waitFor(() =>
			expect(apiPostRegistration).toHaveBeenCalledWith(
				expect.stringContaining('/service/users/askers/new'),
				expect.objectContaining({
					username: expect.not.stringMatching(/^Anonymous-/),
					agencyId: '7',
					postcode: '00000',
					consultingType: '3',
					mainTopicId: '11',
					preferredLanguage: 'de'
				}),
				false,
				tenantValue.tenant
			)
		);
		expect(redirectToApp).toHaveBeenCalled();
	});

	it('opens the entry room on this page for a topic-based redeem, no redirect', async () => {
		vi.mocked(redeemInviteLink).mockResolvedValue({
			sessionId: 42,
			userName: 'anon_1',
			accessToken: 'access-token',
			refreshToken: 'refresh-token',
			expiresIn: 300,
			refreshExpiresIn: 600
		});

		// A promise that never settles: the courtesy name is stored in the
		// background, and the room has to appear without waiting for it.
		vi.mocked(assignInviteSessionDisplayName).mockReturnValue(
			new Promise<string | null>(() => undefined)
		);

		renderInvite();

		await waitFor(() =>
			expect(applyRedeemSessionCredentials).toHaveBeenCalled()
		);
		await waitFor(() =>
			expect(assignInviteSessionDisplayName).toHaveBeenCalled()
		);
		await waitFor(() =>
			expect(screen.getByTestId('live-chat-entry-room').textContent).toBe(
				'room 42'
			)
		);
		/* The room replaces the redirect: the guest stays on this page. */
		expect(redirectToInviteSession).not.toHaveBeenCalled();
		expect(apiPostRegistration).not.toHaveBeenCalled();
		expect(screen.queryByLabelText('User-ID')).toBeNull();
	});
});

describe('InviteLink queue entries', () => {
	beforeEach(() => {
		/* The suite has no global auto-cleanup, so the rooms rendered by the
		   previous describe would still be in the document. */
		cleanup();
		vi.clearAllMocks();
		localStorage.clear();
		vi.mocked(assignInviteSessionDisplayName).mockResolvedValue(null);
		vi.mocked(redeemInviteLink).mockResolvedValue({
			sessionId: 42,
			userName: 'anon_1',
			accessToken: 'access-token',
			refreshToken: 'refresh-token',
			expiresIn: 300,
			refreshExpiresIn: 600
		});
	});

	it('walks the guest back into the session they already have, instead of taking a second place in the queue', async () => {
		/* What a reload looks like: the browser still holds the session the
		   first visit opened, and the server still has it waiting. */
		localStorage.setItem('oriso.invite.session.token-123', '42');
		vi.mocked(apiGetAnonymousEnquiryDetails).mockResolvedValue({
			numAvailableConsultants: 1,
			status: 'NEW'
		});

		renderInvite();

		await waitFor(() =>
			expect(screen.getByTestId('live-chat-entry-room').textContent).toBe(
				'room 42'
			)
		);
		expect(redeemInviteLink).not.toHaveBeenCalled();
	});

	it('redeems a fresh session once the remembered one is over', async () => {
		localStorage.setItem('oriso.invite.session.token-123', '41');
		vi.mocked(apiGetAnonymousEnquiryDetails).mockResolvedValue({
			numAvailableConsultants: 0,
			status: 'DONE'
		});

		renderInvite();

		await waitFor(() => expect(redeemInviteLink).toHaveBeenCalled());
		await waitFor(() =>
			expect(screen.getByTestId('live-chat-entry-room').textContent).toBe(
				'room 42'
			)
		);
	});

	it('remembers the session a fresh redeem opened, so the next visit can reuse it', async () => {
		renderInvite();

		await waitFor(() =>
			expect(screen.getByTestId('live-chat-entry-room').textContent).toBe(
				'room 42'
			)
		);
		expect(localStorage.getItem('oriso.invite.session.token-123')).toBe(
			'42'
		);
	});
});
