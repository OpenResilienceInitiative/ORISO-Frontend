// @vitest-environment jsdom
import * as React from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string) => key,
		i18n: { language: 'de' }
	})
}));

vi.mock('../../../api/apiGetIsUsernameAvailable', () => ({
	apiGetIsUsernameAvailable: vi.fn().mockResolvedValue(true)
}));

vi.mock('../../departmentLegal/DepartmentLegalSection', () => ({
	DepartmentLegalSection: () => null
}));

vi.mock('../../../api/apiGetConsentText', () => ({
	apiGetConsentText: vi.fn()
}));

// RegistrationProvider.tsx also imports the other registration steps, which
// transitively pull in lottie-web. Only the context itself is needed here.
vi.mock('../../../globalState/provider/RegistrationProvider', async () => {
	const ReactModule = await import('react');

	return { RegistrationContext: ReactModule.createContext({}) };
});

/* eslint-disable import/first -- must load after the vi.mock calls above. */
import { AccountData } from './AccountData';
import { apiGetConsentText } from '../../../api/apiGetConsentText';
import { LegalLinksContext } from '../../../globalState/provider/LegalLinksProvider';
import { LocaleContext } from '../../../globalState/context/LocaleContext';
import { RegistrationContext } from '../../../globalState/provider/RegistrationProvider';
import { TenantContext } from '../../../globalState/provider/TenantProvider';
import { setAccountDataDraft, clearAccountDataDraft } from './accountDataDraft';
import { TenantDataInterface } from '../../../globalState/interfaces';
/* eslint-enable import/first */

const VALID_PASSWORD = 'Sichere-Passphrase9!';
const VALID_USERNAME = 'anon-musterstadt';

const agencyWith = (hasPublishedDpp: boolean) => ({
	id: 42,
	name: 'Beratungsstelle Musterstadt',
	departments: [{ topicId: 7, hasPublishedDpp }]
});

const legalLinks = [
	{
		label: 'legal.dataprotection',
		registration: true,
		getUrl: () => 'https://oriso.test/datenschutz'
	}
] as never;

const tenant = {
	id: 1,
	name: 'test',
	theming: {} as never,
	content: {} as never,
	settings: { emailVisible: false }
} as unknown as TenantDataInterface;

const renderStep = ({
	hasPublishedDpp,
	setDisabledNextButton
}: {
	hasPublishedDpp: boolean;
	setDisabledNextButton: (disabled: boolean) => void;
}) =>
	render(
		<LegalLinksContext.Provider value={legalLinks}>
			<LocaleContext.Provider
				value={
					{
						locale: 'de',
						initLocale: 'de',
						setLocale: () => {},
						locales: ['de'],
						selectableLocales: ['de']
					} as never
				}
			>
				<RegistrationContext.Provider
					value={
						{
							setDisabledNextButton,
							registrationData: {
								agency: agencyWith(hasPublishedDpp),
								mainTopic: { id: 7, name: 'Suchtberatung' }
							}
						} as never
					}
				>
					<TenantContext.Provider
						value={{ tenant, setTenant: () => {} } as never}
					>
						<AccountData onChange={() => {}} />
					</TenantContext.Provider>
				</RegistrationContext.Provider>
			</LocaleContext.Provider>
		</LegalLinksContext.Provider>
	);

const consentCheckbox = () =>
	screen
		.getByText('registration.dataProtection.label.prefix', { exact: false })
		.closest('label')
		?.querySelector('input[type="checkbox"]') as HTMLInputElement | null;

const anyCheckbox = () =>
	document.querySelector('input[type="checkbox"]') as HTMLInputElement | null;

afterEach(() => {
	cleanup();
	clearAccountDataDraft();
	vi.clearAllMocks();
});

/**
 * Codex P1 on PR #1110: the label renders nothing while a configured
 * Fachbereich's sentence is in flight, but the checkbox stayed enabled and
 * `dataProtectionChecked` alone still enabled the next step. On a slow
 * connection — and instantly, with a restored draft — someone could tick an
 * unlabelled control and register without ever seeing the wording that applies
 * to them. There is no informed consent in that flow.
 */
describe('AccountData — consent cannot be given before its sentence exists', () => {
	beforeEach(() => {
		vi.mocked(apiGetConsentText).mockReturnValue(new Promise(() => {}));
	});

	it('disables the checkbox while a configured sentence is still loading', async () => {
		renderStep({ hasPublishedDpp: true, setDisabledNextButton: () => {} });

		await waitFor(() => expect(anyCheckbox()).not.toBeNull());
		expect(anyCheckbox()?.disabled).toBe(true);
		// …and there is genuinely no wording to have agreed to.
		expect(
			screen.queryByText('registration.dataProtection.label.prefix', {
				exact: false
			})
		).toBeNull();
	});

	it('enables it once the sentence has resolved', async () => {
		vi.mocked(apiGetConsentText).mockResolvedValue(null);

		renderStep({ hasPublishedDpp: true, setDisabledNextButton: () => {} });

		await waitFor(() => expect(consentCheckbox()).not.toBeNull());
		expect(consentCheckbox()?.disabled).toBe(false);
	});

	it('never enables the next step from a restored acceptance while the sentence is in flight', async () => {
		// The dangerous shape: everything else already valid from the draft, so
		// the consent flag is the only thing left between the user and a
		// completed registration.
		setAccountDataDraft({
			identity: { name: 'anon', avatar: 'fox' } as never,
			username: VALID_USERNAME,
			password: VALID_PASSWORD,
			repeatPassword: VALID_PASSWORD,
			dataProtectionChecked: true,
			email: '',
			twoFactorAuthEnabled: false
		});
		const setDisabledNextButton = vi.fn();

		renderStep({ hasPublishedDpp: true, setDisabledNextButton });

		// Long enough for the debounced username-availability check to settle,
		// which is the last thing that would otherwise hold the button back.
		await waitFor(() => expect(setDisabledNextButton).toHaveBeenCalled(), {
			timeout: 3000
		});
		await new Promise((resolve) => setTimeout(resolve, 600));

		expect(setDisabledNextButton).not.toHaveBeenCalledWith(false);
	});

	it('does enable it once that same restored acceptance has a sentence again', async () => {
		vi.mocked(apiGetConsentText).mockResolvedValue(null);
		setAccountDataDraft({
			identity: { name: 'anon', avatar: 'fox' } as never,
			username: VALID_USERNAME,
			password: VALID_PASSWORD,
			repeatPassword: VALID_PASSWORD,
			dataProtectionChecked: true,
			email: '',
			twoFactorAuthEnabled: false
		});
		const setDisabledNextButton = vi.fn();

		renderStep({ hasPublishedDpp: true, setDisabledNextButton });

		await waitFor(
			() => expect(setDisabledNextButton).toHaveBeenCalledWith(false),
			{ timeout: 3000 }
		);
	});

	it('leaves the unconfigured case untouched — enabled from the first frame, no request', async () => {
		renderStep({ hasPublishedDpp: false, setDisabledNextButton: () => {} });

		expect(anyCheckbox()?.disabled).toBe(false);
		await waitFor(() => expect(consentCheckbox()).not.toBeNull());
		expect(apiGetConsentText).not.toHaveBeenCalled();
	});
});
