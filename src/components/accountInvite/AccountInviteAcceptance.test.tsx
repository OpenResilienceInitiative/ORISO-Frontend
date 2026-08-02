// @vitest-environment jsdom

import * as React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
	acceptAccountInvite,
	getAccountInvite
} from '../../api/apiAccountInvite';
import { GlobalComponentContext } from '../../globalState/provider/GlobalComponentContext';
import { AccountInviteAcceptance } from './AccountInviteAcceptance';

vi.mock('../../api/apiAccountInvite', () => ({
	getAccountInvite: vi.fn(),
	acceptAccountInvite: vi.fn()
}));

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (_key: string, fallback?: string) => fallback ?? _key
	})
}));

vi.mock('../stageLayout/StageLayout', () => ({
	StageLayout: ({ children }: { children: React.ReactNode }) => (
		<main>{children}</main>
	)
}));

const Stage = () => <div data-testid="stage" />;

const renderAcceptance = () =>
	render(
		<GlobalComponentContext.Provider value={{ Stage }}>
			<MemoryRouter initialEntries={['/account-invite/token-123']}>
				<Routes>
					<Route
						path="/account-invite/:token"
						element={<AccountInviteAcceptance />}
					/>
				</Routes>
			</MemoryRouter>
		</GlobalComponentContext.Provider>
	);

describe('AccountInviteAcceptance', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(getAccountInvite).mockResolvedValue({
			recipientEmail: 'lisa.simpson@oriso.org',
			recipientFirstName: 'Lisa',
			recipientLastName: 'Simpson',
			targetRole: 'COUNSELLOR',
			tenantId: 79,
			agencyId: 275,
			departmentId: 2,
			expiresAt: '2026-07-25T12:00:00Z'
		});
		vi.mocked(acceptAccountInvite).mockResolvedValue({
			inviteStatus: 'ACCEPTED',
			provisioningStatus: 'COMPLETED'
		});
	});

	it('creates the invited counsellor while keeping the invited email fixed', async () => {
		renderAcceptance();

		const email = await screen.findByLabelText('E-Mail-Adresse');
		expect(email.getAttribute('value')).toBe('lisa.simpson@oriso.org');
		expect(email).toHaveProperty('disabled', true);

		fireEvent.change(screen.getByLabelText('Benutzername'), {
			target: { value: 'lisa_counsellor' }
		});
		fireEvent.change(screen.getByLabelText('Passwort'), {
			target: { value: 'Valid-Password-2026!' }
		});
		fireEvent.change(screen.getByLabelText('Passwort wiederholen'), {
			target: { value: 'Valid-Password-2026!' }
		});
		fireEvent.click(screen.getByRole('button', { name: 'Konto erstellen' }));

		await waitFor(() =>
			expect(acceptAccountInvite).toHaveBeenCalledWith('token-123', {
				username: 'lisa_counsellor',
				password: 'Valid-Password-2026!',
				formalLanguage: true
			})
		);
		expect(
			await screen.findByText('Ihr Beratungskonto wurde erstellt.')
		).toBeTruthy();
		expect(screen.getByRole('link', { name: 'Zur Anmeldung' })).toHaveProperty(
			'href',
			expect.stringContaining('/login')
		);
	});
});
