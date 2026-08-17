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
import {
	apiGetConsentText,
	ConsentTextData
} from '../../../api/apiGetConsentText';
import { LegalLinksContext } from '../../../globalState/provider/LegalLinksProvider';
import { LocaleContext } from '../../../globalState/context/LocaleContext';
import { RegistrationContext } from '../../../globalState/provider/RegistrationProvider';
import { TenantContext } from '../../../globalState/provider/TenantProvider';
import { setAccountDataDraft, clearAccountDataDraft } from './accountDataDraft';
import { consentBindingKey } from './consentAcceptance';
import { TenantDataInterface } from '../../../globalState/interfaces';
/* eslint-enable import/first */

/** The API returns an envelope; almost every test wants the happy branch. */
const ok = (consentText: ConsentTextData | null) => ({
	status: 'ok' as const,
	consentText
});

const VALID_PASSWORD = 'Sichere-Passphrase9!';
const VALID_USERNAME = 'anon-musterstadt';

const AGENCY_A = 42;
const AGENCY_B = 99;
const TOPIC = 7;

const agencyWith = (hasPublishedDpp: boolean, id = AGENCY_A) => ({
	id,
	name: `Beratungsstelle ${id}`,
	departments: [{ topicId: TOPIC, hasPublishedDpp }]
});

const draftAccepting = (binding: string | null) =>
	setAccountDataDraft({
		identity: { name: 'anon', avatar: 'fox' } as never,
		username: VALID_USERNAME,
		password: VALID_PASSWORD,
		repeatPassword: VALID_PASSWORD,
		acceptedConsentBinding: binding,
		email: '',
		twoFactorAuthEnabled: false
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

const stepTree = ({
	hasPublishedDpp,
	setDisabledNextButton = () => {},
	agencyId = AGENCY_A
}: {
	hasPublishedDpp: boolean;
	setDisabledNextButton?: (disabled: boolean) => void;
	agencyId?: number;
}) => (
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
							agency: agencyWith(hasPublishedDpp, agencyId),
							mainTopic: {
								id: TOPIC,
								name: 'Suchtberatung'
							}
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

type StepOptions = Parameters<typeof stepTree>[0];

const renderStep = (options: StepOptions) => render(stepTree(options));

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
		renderStep({ hasPublishedDpp: true });

		await waitFor(() => expect(anyCheckbox()).not.toBeNull());
		expect(anyCheckbox()?.disabled).toBe(true);
		// …and there is genuinely no wording to have agreed to.
		expect(
			screen.queryByText('registration.dataProtection.label.prefix', {
				exact: false
			})
		).toBeNull();
	});

	it('names the disabled checkbox with a loading notice, not with nothing', async () => {
		/* Disabling a control does not remove it from the accessibility tree.
		   Without this, a screen-reader user met an unnamed checkbox and no
		   indication that anything was happening. The notice is safe where the
		   consent sentence is not, because there is nothing in it to agree to. */
		renderStep({ hasPublishedDpp: true });

		const pending = await screen.findByText(
			'registration.dataProtection.loading'
		);
		expect(pending.getAttribute('aria-live')).toBe('polite');
		expect(anyCheckbox()?.disabled).toBe(true);
		// The checkbox takes the notice as its accessible name.
		expect(pending.closest('label')).not.toBeNull();
	});

	it('replaces the notice with the sentence once it arrives', async () => {
		vi.mocked(apiGetConsentText).mockResolvedValue(ok(null));

		renderStep({ hasPublishedDpp: true });

		await waitFor(() => expect(consentCheckbox()?.disabled).toBe(false));
		expect(
			screen.queryByText('registration.dataProtection.loading')
		).toBeNull();
	});

	it('enables it once the sentence has resolved', async () => {
		vi.mocked(apiGetConsentText).mockResolvedValue(ok(null));

		renderStep({ hasPublishedDpp: true });

		// The label renders one tick before `AccountData` has processed the
		// resolution it reports, so wait for the settled state rather than for
		// the sentence appearing.
		await waitFor(() => expect(consentCheckbox()?.disabled).toBe(false));
	});

	it('never enables the next step from a restored acceptance while the sentence is in flight', async () => {
		// The dangerous shape: everything else already valid from the draft, so
		// the consent flag is the only thing left between the user and a
		// completed registration.
		draftAccepting(consentBindingKey(AGENCY_A, TOPIC, null));
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
		vi.mocked(apiGetConsentText).mockResolvedValue(ok(null));
		draftAccepting(consentBindingKey(AGENCY_A, TOPIC, null));
		const setDisabledNextButton = vi.fn();

		renderStep({ hasPublishedDpp: true, setDisabledNextButton });

		await waitFor(
			() => expect(setDisabledNextButton).toHaveBeenCalledWith(false),
			{ timeout: 3000 }
		);
	});

	it('never enables the next step when the consent request fails', async () => {
		/* The error path must arrive at the same place as the pending path: a
		   department that reports a published policy and whose sentence could
		   not be loaded is not a department whose consent can be given. */
		vi.mocked(apiGetConsentText).mockResolvedValue({
			status: 'unavailable'
		});
		draftAccepting(consentBindingKey(AGENCY_A, TOPIC, null));
		const setDisabledNextButton = vi.fn();

		renderStep({ hasPublishedDpp: true, setDisabledNextButton });

		await screen.findByRole('alert');
		await waitFor(() => expect(setDisabledNextButton).toHaveBeenCalled(), {
			timeout: 3000
		});
		await new Promise((resolve) => setTimeout(resolve, 600));

		expect(anyCheckbox()?.disabled).toBe(true);
		expect(setDisabledNextButton).not.toHaveBeenCalledWith(false);
	});

	it('leaves the unconfigured case untouched — enabled from the first frame, no request', async () => {
		renderStep({ hasPublishedDpp: false });

		expect(anyCheckbox()?.disabled).toBe(false);
		await waitFor(() => expect(consentCheckbox()).not.toBeNull());
		expect(apiGetConsentText).not.toHaveBeenCalled();
	});
});

/**
 * Codex P1 on PR #1110: the draft restored a bare `dataProtectionChecked`
 * boolean, from a time when there was one sentence for everyone. Since the
 * wording belongs to a Fachbereich, that boolean carried agency A's agreement
 * onto agency B's wording — never shown, never accepted, and registration
 * proceeded.
 *
 * The acceptance now records *what* was accepted, so a mismatch unticks the
 * box by construction, while returning to the same Fachbereich keeps the
 * user's work rather than punishing legitimate back-navigation.
 */
describe('AccountData — an acceptance belongs to one Fachbereich and one version', () => {
	beforeEach(() => {
		vi.mocked(apiGetConsentText).mockResolvedValue(ok(null));
	});

	it('keeps the tick when the user comes back to the same Fachbereich', async () => {
		draftAccepting(consentBindingKey(AGENCY_A, TOPIC, null));

		renderStep({ hasPublishedDpp: true, agencyId: AGENCY_A });

		await waitFor(() => expect(consentCheckbox()?.checked).toBe(true));
	});

	it('drops it when the Beratungsstelle changed while it was stored', async () => {
		draftAccepting(consentBindingKey(AGENCY_A, TOPIC, null));

		renderStep({ hasPublishedDpp: true, agencyId: AGENCY_B });

		// Wait for the *resolved* state first — asserting while the resolution
		// is still pending would pass for the wrong reason, since nothing is
		// ticked then either.
		await waitFor(() => expect(consentCheckbox()?.disabled).toBe(false));
		expect(consentCheckbox()?.checked).toBe(false);
	});

	it('drops it when the Träger published a new version of the wording', async () => {
		vi.mocked(apiGetConsentText).mockResolvedValue(
			ok({
				sentence: 'Neue Fassung mit {{legal_links}}.',
				versionId: 2
			})
		);
		draftAccepting(consentBindingKey(AGENCY_A, TOPIC, 1));

		renderStep({ hasPublishedDpp: true, agencyId: AGENCY_A });

		await waitFor(() =>
			expect(screen.getByText(/Neue Fassung/)).toBeDefined()
		);
		const checkbox = document.querySelector<HTMLInputElement>(
			'input[type="checkbox"]'
		);
		// Same argument: resolved first, then assert it is not ticked.
		await waitFor(() => expect(checkbox?.disabled).toBe(false));
		expect(checkbox?.checked).toBe(false);
	});

	it('keeps it when the same version is served again', async () => {
		vi.mocked(apiGetConsentText).mockResolvedValue(
			ok({
				sentence: 'Unveränderte Fassung mit {{legal_links}}.',
				versionId: 1
			})
		);
		draftAccepting(consentBindingKey(AGENCY_A, TOPIC, 1));

		renderStep({ hasPublishedDpp: true, agencyId: AGENCY_A });

		await waitFor(() =>
			expect(
				document.querySelector<HTMLInputElement>(
					'input[type="checkbox"]'
				)?.checked
			).toBe(true)
		);
		expect(screen.getByText(/Unveränderte Fassung/)).toBeDefined();
	});

	it('does not let a changed Fachbereich enable the next step', async () => {
		draftAccepting(consentBindingKey(AGENCY_A, TOPIC, null));
		const setDisabledNextButton = vi.fn();

		renderStep({
			hasPublishedDpp: true,
			agencyId: AGENCY_B,
			setDisabledNextButton
		});

		await waitFor(() => expect(setDisabledNextButton).toHaveBeenCalled(), {
			timeout: 3000
		});
		await new Promise((resolve) => setTimeout(resolve, 600));

		expect(setDisabledNextButton).not.toHaveBeenCalledWith(false);
	});
});
