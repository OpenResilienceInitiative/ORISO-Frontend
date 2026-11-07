// @vitest-environment oriso-jsdom
import * as React from 'react';
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { AccountData } from './AccountData';
import { clearDepartmentLegalCache } from '../../../api/apiGetDepartmentLegal';
import { LegalLinksContext } from '../../../globalState/provider/LegalLinksProvider';
import { LocaleContext } from '../../../globalState/context/LocaleContext';
import { RegistrationContext } from '../../../globalState/provider/RegistrationProvider';
import { TenantContext } from '../../../globalState/provider/TenantProvider';
import { TenantDataInterface } from '../../../globalState/interfaces';
import {
	clearAccountDataDraft,
	getAccountDataDraft,
	setAccountDataDraft
} from './accountDataDraft';
import { generatePseudonym } from '../../../utils/pseudonymGenerator';
import * as pseudonyms from '../../../utils/pseudonymGenerator';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string) => key
	})
}));

vi.mock('../../../api/apiGetIsUsernameAvailable', () => ({
	apiGetIsUsernameAvailable: vi.fn().mockResolvedValue(true)
}));

vi.mock('../../../api/apiGetConsentText', () => ({
	apiGetConsentText: vi.fn().mockResolvedValue({
		status: 'ok',
		consentText: null
	})
}));

// RegistrationProvider.tsx also imports the other registration steps
// (AgencySelection etc.), which transitively pull in lottie-web — unrelated
// to this component. Only the context itself is needed here.
vi.mock('../../../globalState/provider/RegistrationProvider', async () => {
	const ReactModule = await import('react');

	return {
		RegistrationContext: ReactModule.createContext({})
	};
});

afterEach(() => {
	cleanup();
	clearAccountDataDraft();
	clearDepartmentLegalCache();
	vi.restoreAllMocks();
	vi.clearAllMocks();
});

const tenantWith = (
	settings: Partial<TenantDataInterface['settings']>
): TenantDataInterface =>
	({
		id: 1,
		name: 'test',
		theming: {} as never,
		content: {} as never,
		settings
	}) as TenantDataInterface;

const renderAccountData = (
	tenant: TenantDataInterface,
	registrationData: Record<string, unknown> = {},
	temporary = false,
	onChange = vi.fn(),
	dataProtection: 'checkbox' | 'snackbar' = 'checkbox',
	conversationType: 'AGENCY_COUNSELLING' | 'SELF_HELP' = 'AGENCY_COUNSELLING'
) =>
	render(
		<LegalLinksContext.Provider
			value={[
				{
					label: 'login.legal.infoText.dataprotection',
					registration: true,
					getUrl: () => 'https://example.test/privacy'
				}
			]}
		>
			<LocaleContext.Provider
				value={{
					locale: 'de',
					initLocale: 'de',
					setLocale: () => {},
					locales: ['de'],
					selectableLocales: ['de']
				}}
			>
				<RegistrationContext.Provider
					value={{
						setDisabledNextButton: () => {},
						registrationData
					}}
				>
					<TenantContext.Provider
						value={{ tenant, setTenant: () => {} }}
					>
						<AccountData
							onChange={onChange}
							dataProtection={dataProtection}
							conversationType={conversationType}
							temporary={temporary}
						/>
					</TenantContext.Provider>
				</RegistrationContext.Provider>
			</LocaleContext.Provider>
		</LegalLinksContext.Provider>
	);

describe('AccountData — configurable email field', () => {
	it('does not collect email or offer email 2FA when account collection is forbidden', () => {
		renderAccountData(
			tenantWith({
				emailVisible: true,
				emailRequired: true,
				featureAskerEmailEnabled: false
			})
		);
		expect(
			screen.queryByLabelText('registration.account.email.label')
		).toBeNull();
		expect(
			screen.queryByLabelText('registration.account.twoFactorAuth.label')
		).toBeNull();
	});

	it('clears a restored email and permits completion despite restored required-email and 2FA settings', async () => {
		setAccountDataDraft({
			identity: generatePseudonym('de'),
			username: 'policy-asker',
			password: 'Sichere-Passphrase9!',
			repeatPassword: 'Sichere-Passphrase9!',
			acceptedConsentBinding: null,
			email: 'restored@example.test',
			twoFactorAuthEnabled: true
		});
		const onChange = vi.fn();
		renderAccountData(
			tenantWith({
				emailVisible: true,
				emailRequired: true,
				featureAskerEmailEnabled: false
			}),
			{},
			false,
			onChange,
			'snackbar'
		);
		await waitFor(() =>
			expect(onChange).toHaveBeenCalledWith({
				username: 'policy-asker',
				password: 'Sichere-Passphrase9!',
				email: undefined
			})
		);
	});

	it('does not render an email field when the tenant has it hidden', () => {
		renderAccountData(tenantWith({ emailVisible: false }));

		expect(
			screen.queryByLabelText('registration.account.email.label')
		).toBeNull();
	});

	it('does not render an email field when the tenant setting is absent', () => {
		renderAccountData(tenantWith({}));

		expect(
			screen.queryByLabelText('registration.account.email.label')
		).toBeNull();
	});

	it('renders an optional email field when the tenant has it visible but not required', () => {
		renderAccountData(
			tenantWith({ emailVisible: true, emailRequired: false })
		);

		const field = screen.getByLabelText('registration.account.email.label');
		expect(field).toBeDefined();
		expect(field.getAttribute('aria-required')).toBe('false');
	});

	it('renders a required email field when the tenant requires it', () => {
		renderAccountData(
			tenantWith({ emailVisible: true, emailRequired: true })
		);

		const field = screen.getByLabelText('registration.account.email.label');
		expect(field.getAttribute('aria-required')).toBe('true');
	});
});

describe('AccountData — optional 2FA toggle', () => {
	it('does not render the 2FA toggle when the tenant has no email field at all', () => {
		renderAccountData(tenantWith({ emailVisible: false }));

		expect(
			screen.queryByLabelText('registration.account.twoFactorAuth.label')
		).toBeNull();
	});

	it('renders the 2FA toggle when the tenant shows an email field', () => {
		renderAccountData(
			tenantWith({ emailVisible: true, emailRequired: false })
		);

		expect(
			screen.getByLabelText('registration.account.twoFactorAuth.label')
		).toBeDefined();
	});

	it('marks the email field as required once 2FA is toggled on, even though the tenant does not require it', () => {
		renderAccountData(
			tenantWith({ emailVisible: true, emailRequired: false })
		);

		const emailField = screen.getByLabelText(
			'registration.account.email.label'
		);
		expect(emailField.getAttribute('aria-required')).toBe('false');

		fireEvent.click(
			screen.getByLabelText('registration.account.twoFactorAuth.label')
		);

		expect(emailField.getAttribute('aria-required')).toBe('true');
	});
});

const agencyWithPublishedDpp = {
	agency: {
		id: 42,
		name: 'Beratungsstelle',
		departments: [{ topicId: 7, hasPublishedDpp: true }]
	},
	mainTopic: { id: 7, name: 'Suchtberatung' }
};

describe('AccountData — department legal accordion', () => {
	it('does not render the Datenschutzhinweise accordion', () => {
		renderAccountData(tenantWith({}), agencyWithPublishedDpp);

		expect(
			document.querySelector('[data-cy="department-legal-consent"]')
		).toBeNull();
		expect(
			screen.queryByText('Datenschutzhinweise der Beratungsstelle')
		).toBeNull();
		expect(
			screen.queryByText('registration.agency.legal.headline')
		).toBeNull();
	});
});

/**
 * A temporary join mints a password nobody ever sees. Switching back to
 * "Konto anlegen" used to leave it in both fields, masked: the person then
 * created a permanent account with a password they could not recover, and the
 * sentence that warned them was gone with the temporary mode (review on
 * ORISO-Frontend#1333, 2026-09-07).
 */
describe('AccountData — leaving the temporary join', () => {
	it('does not hand the minted password to the permanent account', () => {
		const view = renderAccountData(tenantWith({}), {}, true);

		view.rerender(
			<LegalLinksContext.Provider value={[]}>
				<LocaleContext.Provider
					value={{
						locale: 'de',
						initLocale: 'de',
						setLocale: () => {},
						locales: ['de'],
						selectableLocales: ['de']
					}}
				>
					<RegistrationContext.Provider
						value={{
							setDisabledNextButton: () => {},
							registrationData: {}
						}}
					>
						<TenantContext.Provider
							value={{
								tenant: tenantWith({}),
								setTenant: () => {}
							}}
						>
							<AccountData
								onChange={() => {}}
								temporary={false}
							/>
						</TenantContext.Provider>
					</RegistrationContext.Provider>
				</LocaleContext.Provider>
			</LegalLinksContext.Provider>
		);

		const passwordFields = Array.from(
			document.querySelectorAll('input[type="password"]')
		) as HTMLInputElement[];
		expect(passwordFields.length).toBeGreaterThan(0);
		passwordFields.forEach((field) => expect(field.value).toBe(''));
	});
});

it('rolling the login suggestion preserves the independently chosen avatar (#1025)', () => {
	renderAccountData(tenantWith({}));
	const initial = getAccountDataDraft().identity;
	vi.spyOn(pseudonyms, 'regeneratePseudonym').mockReturnValue({
		...initial,
		displayName: 'freundlicher Otter Kim',
		animalLabel: 'Otter',
		name: 'Kim',
		avatar: { ...initial.avatar, bg: '#000000' }
	});
	fireEvent.click(
		screen.getByRole('button', {
			name: /registration.account.suggest.username/
		})
	);
	expect(getAccountDataDraft().identity.avatar).toEqual(initial.avatar);
});

describe('optional ordinary registration alias', () => {
	it('blocks the step while the alias contains the password (#2073)', async () => {
		const password = 'Sichere-Passphrase9!';
		setAccountDataDraft({
			identity: generatePseudonym('de'),
			generatedUsername: 'generated_login_1234',
			username: 'fixed_login',
			password,
			repeatPassword: password,
			acceptedConsentBinding: null,
			email: '',
			twoFactorAuthEnabled: false,
			displayName: password
		});
		const onChange = vi.fn();
		renderAccountData(
			tenantWith({ featureDisplayNameEditable: true }),
			{},
			false,
			onChange,
			'snackbar',
			'AGENCY_COUNSELLING'
		);
		expect(
			await screen.findByText(
				'registration.account.displayName.matchesPassword'
			)
		).not.toBeNull();
		fireEvent.change(screen.getByLabelText('profile.data.displayName'), {
			target: { value: 'Chosen alias' }
		});
		await waitFor(() =>
			expect(onChange).toHaveBeenCalledWith(
				expect.objectContaining({ displayName: 'Chosen alias' })
			)
		);
		expect(onChange).not.toHaveBeenCalledWith(
			expect.objectContaining({ displayName: password })
		);
	});

	it('starts blank and keeps credentials and avatar when alias typing or dice changes', () => {
		renderAccountData(tenantWith({}));
		const login = screen.getByLabelText<HTMLInputElement>(
			'registration.account.username.label'
		);
		const before = getAccountDataDraft();
		const alias = screen.getByLabelText<HTMLInputElement>(
			'profile.data.displayName'
		);
		expect(alias.value).toBe('');
		expect(alias.required).toBe(false);
		fireEvent.change(alias, { target: { value: 'Visible alias' } });
		expect(alias.value).toBe('Visible alias');
		expect(login.value).toBe(before.username);
		fireEvent.click(
			screen.getByRole('button', {
				name: 'registration.account.displayName.suggest'
			})
		);
		expect(alias.value).not.toBe('');
		expect(alias.value).not.toBe('Visible alias');
		expect(login.value).toBe(before.username);
		expect(getAccountDataDraft().identity.avatar).toEqual(
			before.identity.avatar
		);
		fireEvent.click(
			screen.getByRole('button', {
				name: 'registration.account.displayName.useUsername'
			})
		);
		expect(alias.value).toBe('');
		expect(login.value).toBe(before.username);
	});
	it('allows only generated alias choices when typing is disabled', () => {
		renderAccountData(tenantWith({ featureDisplayNameEditable: false }));
		const alias = screen.getByLabelText<HTMLInputElement>(
			'profile.data.displayName'
		);
		const generatedAlias = alias.value;
		expect(generatedAlias).not.toBe('');
		expect(alias.readOnly).toBe(true);
		expect(
			screen.getByLabelText<HTMLInputElement>(
				'registration.account.username.label'
			).readOnly
		).toBe(true);
		fireEvent.change(alias, { target: { value: 'Forbidden custom' } });
		expect(alias.value).toBe(generatedAlias);
		expect(
			screen.queryByRole('button', {
				name: 'registration.account.displayName.useUsername'
			})
		).toBeNull();
		fireEvent.click(
			screen.getByRole('button', {
				name: 'registration.account.displayName.suggest'
			})
		);
		expect(alias.value).not.toBe('');
	});
	it('offers no unsupported alias field for self-help signup', () => {
		renderAccountData(
			tenantWith({}),
			{},
			false,
			vi.fn(),
			'checkbox',
			'SELF_HELP'
		);
		expect(screen.queryByLabelText('profile.data.displayName')).toBeNull();
	});
});

describe('registration context collection permission', () => {
	it.each(['AGENCY_COUNSELLING', 'SELF_HELP'] as const)(
		'hides %s email and email2FA despite visible/required presentation',
		(type) => {
			renderAccountData(
				tenantWith({
					emailVisible: true,
					emailRequired: true,
					featureAskerEmailCollectionAgencyCounsellingEnabled: false,
					featureAskerEmailCollectionSelfHelpEnabled: false
				}),
				{},
				false,
				vi.fn(),
				'checkbox',
				type
			);
			expect(
				screen.queryByLabelText('registration.account.email.label')
			).toBeNull();
			expect(
				screen.queryByLabelText(
					'registration.account.twoFactorAuth.label'
				)
			).toBeNull();
		}
	);
	it('does not apply the self-help collection cap to counselling signup', () => {
		renderAccountData(
			tenantWith({
				emailVisible: true,
				featureAskerEmailCollectionSelfHelpEnabled: false
			})
		);
		expect(
			screen.getByLabelText('registration.account.email.label')
		).toBeDefined();
	});
});

describe('completed optional alias data', () => {
	it.each([
		['AGENCY_COUNSELLING', true, 'Chosen alias'],
		['AGENCY_COUNSELLING', false, undefined],
		['SELF_HELP', true, undefined]
	] as const)(
		'submits only supported alias data for %s typing=%s',
		async (type, editable, expected) => {
			const identity = generatePseudonym('de');
			setAccountDataDraft({
				identity,
				generatedUsername: 'generated_login_1234',
				username: 'fixed_login',
				password: 'Sichere-Passphrase9!',
				repeatPassword: 'Sichere-Passphrase9!',
				acceptedConsentBinding: null,
				email: '',
				twoFactorAuthEnabled: false,
				displayName: '  Chosen alias  '
			});
			const onChange = vi.fn();
			renderAccountData(
				tenantWith({ featureDisplayNameEditable: editable }),
				{},
				false,
				onChange,
				'snackbar',
				type
			);
			await waitFor(() =>
				expect(onChange).toHaveBeenCalledWith(
					expect.objectContaining({
						username: editable
							? 'fixed_login'
							: 'generated_login_1234',
						displayName: editable ? expected : identity.displayName
					})
				)
			);
		}
	);
});
