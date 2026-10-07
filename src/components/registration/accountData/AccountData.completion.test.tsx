// @vitest-environment jsdom
import * as React from 'react';
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
	within
} from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string, options?: Record<string, unknown> | string) =>
			key === 'chatFlyout.dataProtection'
				? 'Datenschutz'
				: typeof options === 'string'
					? options
					: (options?.defaultValue ?? key),
		i18n: { language: 'de' }
	})
}));
vi.mock('lottie-react', () => ({ default: () => null }));
vi.mock('../../stageLayout/StageLayout', () => ({
	StageLayout: ({ children }: { children: React.ReactNode }) => (
		<>{children}</>
	)
}));
vi.mock('../../../api/apiGetIsUsernameAvailable', () => ({
	apiGetIsUsernameAvailable: vi.fn().mockResolvedValue(true)
}));
vi.mock('../../../api/apiGetConsentText', () => ({
	apiGetConsentText: vi
		.fn()
		.mockResolvedValue({ status: 'ok', consentText: null })
}));
vi.mock('../../../globalState/provider/RegistrationProvider', async () => {
	const ReactModule = await import('react');
	return { RegistrationContext: ReactModule.createContext({}) };
});

/* eslint-disable import/first -- contexts are loaded after their vi.mock declarations. */
import { AccountData } from './AccountData';
import { clearAccountDataDraft } from './accountDataDraft';
import { apiGetIsUsernameAvailable } from '../../../api/apiGetIsUsernameAvailable';
import { LegalLinksContext } from '../../../globalState/provider/LegalLinksProvider';
import { LocaleContext } from '../../../globalState/context/LocaleContext';
import { RegistrationContext } from '../../../globalState/provider/RegistrationProvider';
import { TenantContext } from '../../../globalState/provider/TenantProvider';
import { RegistrationFooter } from '../../registrationFooter/RegistrationFooter';
import { RegistrationCompletionProvider } from '../consentCompletion/RegistrationCompletionContext';
import { RegistrationStepNav } from '../registrationStepNav/RegistrationStepNav';
import { GroupInviteEntry } from '../groupInviteEntry/GroupInviteEntry';
/* eslint-enable import/first */

afterEach(() => {
	cleanup();
	clearAccountDataDraft();
	vi.clearAllMocks();
	vi.mocked(apiGetIsUsernameAvailable).mockResolvedValue(true);
});

const tenant = {
	id: 1,
	name: 'test',
	theming: {},
	content: {},
	settings: { emailVisible: false }
} as never;
const legalLinks = [
	{
		label: 'Datenschutz',
		registration: true,
		getUrl: () => 'https://oriso.test/privacy'
	}
] as never;
const locale = {
	locale: 'de',
	initLocale: 'de',
	setLocale: () => {},
	locales: ['de'],
	selectableLocales: ['de']
} as never;
const noop = () => {};

const AccountCompletion = ({
	temporary = false,
	onRegister
}: {
	temporary?: boolean;
	onRegister: () => void;
}) => {
	const [disabled, setDisabled] = React.useState(true);
	return (
		<MemoryRouter>
			<LegalLinksContext.Provider value={legalLinks}>
				<LocaleContext.Provider value={locale}>
					<TenantContext.Provider value={{ tenant, setTenant: noop }}>
						<RegistrationContext.Provider
							value={{
								registrationData: {},
								setDisabledNextButton: setDisabled
							}}
						>
							{temporary ? (
								<GroupInviteEntry
									stage={<div />}
									gcid="group-test"
									aid="42"
									temporary
									onToggleTemporary={noop}
									onChange={noop}
									onJoin={onRegister}
									joinDisabled={disabled}
									busy={false}
								/>
							) : (
								<RegistrationCompletionProvider>
									<form
										onSubmit={(event) => {
											event.preventDefault();
											if (!disabled) onRegister();
										}}
									>
										<AccountData
											entry={
												temporary
													? 'link'
													: 'registration'
											}
											temporary={temporary}
											onChange={noop}
										/>
										<RegistrationFooter>
											<RegistrationStepNav
												prevStepUrl={null}
												nextStepUrl={null}
												backLabel="Zurück"
												nextLabel="Weiter"
												registerLabel={
													temporary
														? 'Beitreten'
														: 'Registrieren'
												}
												registeringLabel="Wird registriert"
												disabledNext={disabled}
											/>
										</RegistrationFooter>
									</form>
								</RegistrationCompletionProvider>
							)}
						</RegistrationContext.Provider>
					</TenantContext.Provider>
				</LocaleContext.Provider>
			</LegalLinksContext.Provider>
		</MemoryRouter>
	);
};

const fillPermanentAnswers = () => {
	fireEvent.change(
		screen.getByLabelText('registration.account.username.label'),
		{ target: { value: 'anon-musterstadt' } }
	);
	fireEvent.change(
		screen.getByLabelText('registration.account.password.label'),
		{ target: { value: 'Sichere-Passphrase9!' } }
	);
	fireEvent.change(
		screen.getByLabelText('registration.account.repeatPassword.label'),
		{ target: { value: 'Sichere-Passphrase9!' } }
	);
};

describe('AccountData with its real completion footer', () => {
	it('offers consent in the footer after valid answers and submits only after a deliberate tick', async () => {
		const onRegister = vi.fn();
		render(<AccountCompletion onRegister={onRegister} />);
		const primary = screen.getByRole('button', {
			name: 'Registrieren'
		}) as HTMLButtonElement;
		expect(primary.disabled).toBe(true);
		expect(screen.queryByRole('checkbox')).toBeNull();
		fillPermanentAnswers();

		const checkbox = await screen.findByRole('checkbox');
		const region = screen.getByRole('region', { name: 'Datenschutz' });
		expect(within(region).queryByRole('heading')).toBeNull();
		expect(
			region.closest('[data-cy="registration-footer"]')
		).not.toBeNull();
		expect((checkbox as HTMLInputElement).checked).toBe(false);
		expect(primary.disabled).toBe(true);
		fireEvent.click(primary);
		expect(onRegister).not.toHaveBeenCalled();

		fireEvent.click(checkbox);
		await waitFor(() => expect(primary.disabled).toBe(false));
		fireEvent.click(primary);
		expect(onRegister).toHaveBeenCalledTimes(1);
		fireEvent.click(checkbox);
		await waitFor(() => expect(primary.disabled).toBe(true));
		fireEvent.change(
			screen.getByLabelText('registration.account.username.label'),
			{ target: { value: 'anon-musterstadt ' } }
		);
		expect(screen.getByRole('checkbox')).toBe(checkbox);
	});

	it('uses the same explicit footer consent for a temporary group guest without showing a password', async () => {
		const onRegister = vi.fn();
		render(<AccountCompletion temporary onRegister={onRegister} />);
		expect(
			screen.queryByLabelText('registration.account.password.label')
		).toBeNull();
		const primary = screen.getByRole('button', {
			name: 'Der Gruppe beitreten'
		}) as HTMLButtonElement;
		const checkbox = await screen.findByRole('checkbox');
		expect(
			within(
				screen.getByRole('region', { name: 'Datenschutz' })
			).queryByRole('heading')
		).toBeNull();
		expect(primary.disabled).toBe(true);
		expect((checkbox as HTMLInputElement).checked).toBe(false);
		fireEvent.click(primary);
		expect(onRegister).not.toHaveBeenCalled();
		fireEvent.click(checkbox);
		await waitFor(() => expect(primary.disabled).toBe(false));
		fireEvent.click(primary);
		expect(onRegister).toHaveBeenCalledTimes(1);
	});

	it('does not offer the final consent until username availability is known', async () => {
		let resolveAvailability: (available: boolean) => void;
		vi.mocked(apiGetIsUsernameAvailable).mockImplementation(
			() =>
				new Promise((resolve) => {
					resolveAvailability = resolve;
				})
		);
		render(<AccountCompletion onRegister={noop} />);
		fillPermanentAnswers();
		await waitFor(() =>
			expect(apiGetIsUsernameAvailable).toHaveBeenCalledWith(
				'anon-musterstadt'
			)
		);
		expect(screen.queryByRole('checkbox')).toBeNull();
		resolveAvailability!(true);
		await screen.findByRole('checkbox');
		fireEvent.change(
			screen.getByLabelText('registration.account.username.label'),
			{ target: { value: 'x' } }
		);
		await waitFor(() => expect(screen.queryByRole('checkbox')).toBeNull());
		expect(
			(
				screen.getByRole('button', {
					name: 'Registrieren'
				}) as HTMLButtonElement
			).disabled
		).toBe(true);
	});
});
