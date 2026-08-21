// @vitest-environment jsdom
import * as React from 'react';
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AccountData } from './AccountData';
import { LegalLinksContext } from '../../../globalState/provider/LegalLinksProvider';
import { LocaleContext } from '../../../globalState/context/LocaleContext';
import { RegistrationContext } from '../../../globalState/provider/RegistrationProvider';
import { TenantContext } from '../../../globalState/provider/TenantProvider';
import { TenantDataInterface } from '../../../globalState/interfaces';
import { apiGetDepartmentLegal } from '../../../api/apiGetDepartmentLegal';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string) => key
	})
}));

vi.mock('../../../api/apiGetIsUsernameAvailable', () => ({
	apiGetIsUsernameAvailable: vi.fn().mockResolvedValue(true)
}));

vi.mock('../../../api/apiGetDepartmentLegal', () => ({
	apiGetDepartmentLegal: vi.fn().mockResolvedValue(null)
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

const agencyWithTopic = {
	agency: {
		id: 42,
		name: 'Beratungsstelle',
		departments: [{ topicId: 7, hasPublishedDpp: true }]
	},
	mainTopic: { id: 7, name: 'Suchtberatung' }
};

const renderAccountData = (
	tenant: TenantDataInterface,
	registrationData: Record<string, unknown> = {}
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
						<AccountData onChange={() => {}} />
					</TenantContext.Provider>
				</RegistrationContext.Provider>
			</LocaleContext.Provider>
		</LegalLinksContext.Provider>
	);

describe('AccountData — configurable email field', () => {
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

describe('AccountData — department consent text on checkbox label', () => {
	it('does not render the Datenschutzhinweise accordion', async () => {
		vi.mocked(apiGetDepartmentLegal).mockResolvedValue({
			dpp: {
				content: '{"de":"<p>DPP</p>"}',
				consentText: '{"de":"Fachbereich-Einwilligung"}'
			},
			imprint: { content: null }
		});

		renderAccountData(tenantWith({}), agencyWithTopic);

		await waitFor(() =>
			expect(screen.getByText('Fachbereich-Einwilligung')).toBeDefined()
		);

		expect(
			screen.queryByText('Datenschutzhinweise der Beratungsstelle')
		).toBeNull();
		expect(
			screen.queryByText('registration.agency.legal.headline')
		).toBeNull();
	});

	it('shows department consentText with the same label wrapper when present', async () => {
		vi.mocked(apiGetDepartmentLegal).mockResolvedValue({
			dpp: {
				content: '{"de":"<p>DPP</p>"}',
				consentText: '{"de":"Fachbereich-Einwilligungssatz"}'
			},
			imprint: { content: null }
		});

		renderAccountData(tenantWith({}), agencyWithTopic);

		await waitFor(() => {
			const labelNode = screen.getByText('Fachbereich-Einwilligungssatz');
			expect(
				labelNode.closest(
					'[data-cy="registration-data-protection-label"]'
				)
			).toBeTruthy();
		});

		expect(
			screen.queryByText('registration.dataProtection.label.prefix')
		).toBeNull();
	});

	it('shows an empty checkbox label while department legal is loading', async () => {
		let resolveLegal: (value: unknown) => void = () => {};
		vi.mocked(apiGetDepartmentLegal).mockReturnValue(
			new Promise((resolve) => {
				resolveLegal = resolve;
			}) as ReturnType<typeof apiGetDepartmentLegal>
		);

		renderAccountData(tenantWith({}), agencyWithTopic);

		expect(
			screen.queryByText(
				(_, element) =>
					element?.getAttribute('data-cy') ===
					'registration-data-protection-label'
			)
		).toBeNull();
		expect(
			screen.queryByText('registration.dataProtection.label.prefix')
		).toBeNull();

		resolveLegal({
			dpp: {
				content: null,
				consentText: '{"de":"Geladener Einwilligungstext"}'
			},
			imprint: { content: null }
		});

		await waitFor(() =>
			expect(
				screen.getByText('Geladener Einwilligungstext')
			).toBeDefined()
		);
	});

	it('falls back to the i18n LegalLinks label when consentText is absent', async () => {
		vi.mocked(apiGetDepartmentLegal).mockResolvedValue({
			dpp: { content: '{"de":"<p>DPP</p>"}', consentText: null },
			imprint: { content: null }
		});

		renderAccountData(tenantWith({}), agencyWithTopic);

		await waitFor(() => {
			const label = screen.getByText(
				(_, element) =>
					element?.getAttribute('data-cy') ===
					'registration-data-protection-label'
			);
			expect(label.textContent).toContain(
				'registration.dataProtection.label.prefix'
			);
			expect(label.textContent).toContain(
				'registration.dataProtection.label.suffix'
			);
		});
		expect(screen.queryByText('Fachbereich-Einwilligungssatz')).toBeNull();
	});

	it('falls back to the i18n label when agency/topic are not selected yet', () => {
		renderAccountData(tenantWith({}), {});

		expect(apiGetDepartmentLegal).not.toHaveBeenCalled();
		expect(
			screen.getByText(
				(_, element) =>
					element?.getAttribute('data-cy') ===
					'registration-data-protection-label'
			).textContent
		).toContain('registration.dataProtection.label.prefix');
	});

	it('resolves consentText JSON by the current UI language', async () => {
		vi.mocked(apiGetDepartmentLegal).mockResolvedValue({
			dpp: {
				content: null,
				consentText: JSON.stringify({
					de: 'Deutscher Einwilligungstext',
					en: 'English consent text'
				})
			},
			imprint: { content: null }
		});

		renderAccountData(tenantWith({}), agencyWithTopic);

		await waitFor(() =>
			expect(
				screen.getByText('Deutscher Einwilligungstext')
			).toBeDefined()
		);
		expect(screen.queryByText('English consent text')).toBeNull();
	});
});
