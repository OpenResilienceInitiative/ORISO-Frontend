// @vitest-environment jsdom
import * as React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AccountData } from './AccountData';
import { LegalLinksContext } from '../../../globalState/provider/LegalLinksProvider';
import { LocaleContext } from '../../../globalState/context/LocaleContext';
import { RegistrationContext } from '../../../globalState/provider/RegistrationProvider';
import { TenantContext } from '../../../globalState/provider/TenantProvider';
import { TenantDataInterface } from '../../../globalState/interfaces';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string) => key
	})
}));

vi.mock('../../../api/apiGetIsUsernameAvailable', () => ({
	apiGetIsUsernameAvailable: vi.fn().mockResolvedValue(true)
}));

vi.mock('../../departmentLegal/DepartmentLegalSection', () => ({
	DepartmentLegalSection: () => null
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

afterEach(cleanup);

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

const renderAccountData = (tenant: TenantDataInterface) =>
	render(
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
