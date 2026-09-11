// @vitest-environment jsdom
import * as React from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string) => key,
		i18n: { language: 'de' }
	})
}));

vi.mock('lottie-react', () => ({ default: () => null }));

vi.mock('../../../api/apiGetIsUsernameAvailable', () => ({
	apiGetIsUsernameAvailable: vi.fn().mockResolvedValue(true)
}));

// No Träger-authored text for this Fachbereich, so the platform sentence
// applies and the checkbox is live from the first frame.
vi.mock('../../../api/apiGetConsentText', () => ({
	apiGetConsentText: vi
		.fn()
		.mockResolvedValue({ status: 'ok', consentText: null })
}));

// RegistrationProvider.tsx also imports the other registration steps, which
// transitively pull in lottie-web. Only the context itself is needed here.
vi.mock('../../../globalState/provider/RegistrationProvider', async () => {
	const ReactModule = await import('react');

	return { RegistrationContext: ReactModule.createContext({}) };
});

/* eslint-disable import/first -- must load after the vi.mock calls above. */
import { AccountData } from './AccountData';
import { LegalLinksContext } from '../../../globalState/provider/LegalLinksProvider';
import { LocaleContext } from '../../../globalState/context/LocaleContext';
import { RegistrationContext } from '../../../globalState/provider/RegistrationProvider';
import { TenantContext } from '../../../globalState/provider/TenantProvider';
import { clearAccountDataDraft, setAccountDataDraft } from './accountDataDraft';
import { TenantDataInterface } from '../../../globalState/interfaces';
/* eslint-enable import/first */

const VALID_PASSWORD = 'Sichere-Passphrase9!';
const VALID_USERNAME = 'anon-musterstadt';
const TOPIC = 7;

const legalLinks = [
	{
		label: 'login.legal.infoText.dataprotection',
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

/**
 * Everything but the consent already satisfied, so the only thing left that
 * could hold the step shut is the data-protection promise itself.
 */
const draftReadyToLeave = () =>
	setAccountDataDraft({
		identity: { name: 'anon', avatar: 'fox' } as never,
		username: VALID_USERNAME,
		password: VALID_PASSWORD,
		repeatPassword: VALID_PASSWORD,
		acceptedConsentBinding: null,
		email: '',
		twoFactorAuthEnabled: false
	});

const renderStep = ({
	dataProtection,
	setDisabledNextButton = () => {}
}: {
	dataProtection?: 'checkbox' | 'snackbar';
	setDisabledNextButton?: (disabled: boolean) => void;
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
								agency: {
									id: 42,
									name: 'Beratungsstelle 42',
									departments: [
										{
											topicId: TOPIC,
											hasPublishedDpp: false
										}
									]
								},
								mainTopic: { id: TOPIC, name: 'Suchtberatung' }
							}
						} as never
					}
				>
					<TenantContext.Provider
						value={{ tenant, setTenant: () => {} } as never}
					>
						<AccountData
							onChange={() => {}}
							entry="link"
							dataProtection={dataProtection}
						/>
					</TenantContext.Provider>
				</RegistrationContext.Provider>
			</LocaleContext.Provider>
		</LegalLinksContext.Provider>
	);

const anyCheckbox = () =>
	document.querySelector('input[type="checkbox"]') as HTMLInputElement | null;

afterEach(() => {
	cleanup();
	clearAccountDataDraft();
	vi.clearAllMocks();
});

/**
 * ORISO-Frontend#1341, item 5. Only the live-chat link entry swaps the consent
 * box for the note; everything else — the four-step registration, mail
 * counselling, the self-help group entry, all of which also render this step —
 * must keep the checkbox and its gate exactly as they were.
 */
describe('AccountData — the privacy note replaces the consent box only when asked', () => {
	it('keeps the checkbox by default', async () => {
		renderStep({});

		await waitFor(() => expect(anyCheckbox()).not.toBeNull());
		expect(
			screen.queryByTestId('registration-dataprotection-snackbar')
		).toBeNull();
	});

	it('keeps the checkbox for a link entry that did not ask for the note', async () => {
		renderStep({ dataProtection: 'checkbox' });

		await waitFor(() => expect(anyCheckbox()).not.toBeNull());
		expect(
			screen.queryByTestId('registration-dataprotection-snackbar')
		).toBeNull();
	});

	it('shows the note instead of the box when it is asked for', async () => {
		renderStep({ dataProtection: 'snackbar' });

		await waitFor(() =>
			expect(
				screen.getByTestId('registration-dataprotection-snackbar')
			).toBeTruthy()
		);
		expect(anyCheckbox()).toBeNull();
	});

	/* Without this the note would be a trap: nothing left to tick, and a step
	   that can never be left. The consent itself is taken later, in the waiting
	   room (item 2). */
	it('does not hold the step shut on a consent that is no longer asked here', async () => {
		draftReadyToLeave();
		const setDisabledNextButton = vi.fn();

		renderStep({ dataProtection: 'snackbar', setDisabledNextButton });

		await waitFor(() =>
			expect(setDisabledNextButton).toHaveBeenCalledWith(false)
		);
	});

	it('still holds it shut with the checkbox unticked', async () => {
		draftReadyToLeave();
		const setDisabledNextButton = vi.fn();

		renderStep({ setDisabledNextButton });

		await waitFor(() => expect(anyCheckbox()).not.toBeNull());
		expect(setDisabledNextButton).not.toHaveBeenCalledWith(false);
	});
});
