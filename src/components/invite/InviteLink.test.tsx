// @vitest-environment jsdom

import * as React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { redeemInviteLink } from '../../api/apiRedeemInviteLink';
import { apiPostRegistration } from '../../api/apiPostRegistration';
import { LocaleContext, TenantContext } from '../../globalState';
import { GlobalComponentContext } from '../../globalState/provider/GlobalComponentContext';
import { redirectToApp } from '../registration/autoLogin';
import {
	applyRedeemSessionCredentials,
	redirectToInviteSession
} from './inviteLinkHelpers';

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

vi.mock('../registration/autoLogin', () => ({
	redirectToApp: vi.fn()
}));

vi.mock('./inviteLinkHelpers', () => ({
	applyRedeemSessionCredentials: vi.fn(),
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
	useTranslation: () => {
		const catalogue: Record<string, string> = {
			'registration.account.username.label': 'User-ID',
			'anonymousChat.pseudonym.changeName': 'Name ändern',
			'anonymousChat.pseudonym.continueWithSelection':
				'Weiter mit Auswahl'
		};
		return {
			t: (key: string) => catalogue[key] ?? key
		};
	}
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

	it('still hands topic-based redeem straight to the waiting room', async () => {
		vi.mocked(redeemInviteLink).mockResolvedValue({
			sessionId: 42,
			userName: 'anon_1',
			accessToken: 'access-token',
			refreshToken: 'refresh-token',
			expiresIn: 300,
			refreshExpiresIn: 600
		});

		renderInvite();

		await waitFor(() =>
			expect(applyRedeemSessionCredentials).toHaveBeenCalled()
		);
		expect(redirectToInviteSession).toHaveBeenCalled();
		expect(apiPostRegistration).not.toHaveBeenCalled();
		expect(screen.queryByLabelText('User-ID')).toBeNull();
	});
});
