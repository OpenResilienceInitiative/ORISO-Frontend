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

vi.mock('react-i18next', () => {
	const catalogue: Record<string, string> = {
		'accountInvite.invalid':
			'Der Einladungslink ist ungültig oder abgelaufen.',
		'accountInvite.createFailed':
			'Das Beratungskonto konnte nicht erstellt werden. Bitte versuchen Sie es erneut.',
		'accountInvite.loading': 'Einladung wird geladen',
		'accountInvite.successTitle': 'Konto erstellt',
		'accountInvite.success': 'Ihr Beratungskonto wurde erstellt.',
		'accountInvite.toLogin': 'Zur Anmeldung',
		'accountInvite.title': 'Beratungskonto erstellen',
		'accountInvite.description':
			'Vervollständigen Sie Ihre Einladung mit einem Benutzernamen und Passwort.',
		'accountInvite.email': 'E-Mail-Adresse',
		'accountInvite.username': 'Benutzername',
		'accountInvite.password': 'Passwort',
		'accountInvite.passwordHint':
			'Mindestens 16 Zeichen mit Groß- und Kleinbuchstaben, Zahl und Sonderzeichen.',
		'accountInvite.repeatPassword': 'Passwort wiederholen',
		'accountInvite.submit': 'Konto erstellen'
	};
	const t = (key: string) => catalogue[key] ?? key;
	return {
		useTranslation: () => ({ t })
	};
});

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
			firstName: 'Lisa',
			lastName: 'Simpson',
			targetRole: 'COUNSELLOR',
			tenantId: 79,
			agencyId: 275,
			departmentId: 2,
			// Backend serializes LocalDateTime without a timezone offset
			expiresAt: '2026-07-25T12:00:00'
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
		fireEvent.click(
			screen.getByRole('button', { name: 'Konto erstellen' })
		);

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
		expect(
			screen.getByRole('link', { name: 'Zur Anmeldung' })
		).toHaveProperty('href', expect.stringContaining('/login'));
	});
});
