// @vitest-environment jsdom
import * as React from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		/* Returns the key, as before, so existing assertions still read as
		   keys — except when a `defaultValue` is supplied, where it renders
		   that with `{{…}}` interpolated. Without this a component that
		   interpolates the wrong value, or none, is indistinguishable from one
		   that gets it right. */
		t: (key: string, options?: Record<string, unknown>) => {
			const template = options?.defaultValue;
			if (typeof template !== 'string') {
				return key;
			}
			return template.replace(/\{\{(\w+)\}\}/g, (_, name) =>
				String(options?.[name] ?? '')
			);
		},
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
	agencyId = AGENCY_A,
	locale = 'de'
}: {
	hasPublishedDpp: boolean;
	setDisabledNextButton?: (disabled: boolean) => void;
	agencyId?: number;
	locale?: string;
}) => (
	<LegalLinksContext.Provider value={legalLinks}>
		<LocaleContext.Provider
			value={
				{
					locale,
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
		draftAccepting(consentBindingKey(AGENCY_A, TOPIC, null, 'platform:de'));
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
		draftAccepting(consentBindingKey(AGENCY_A, TOPIC, null, 'platform:de'));
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
		draftAccepting(consentBindingKey(AGENCY_A, TOPIC, null, 'platform:de'));
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

	/* Was "no Fachbereich policy of its own -> no request, enabled at once".
	   That shortcut is gone: the flag means a policy of its *own*, and a
	   department without one is governed by inherited Träger wording, so
	   skipping the request offered the platform sentence where it does not
	   apply (Codex P1, #1110). What survives is the case where there is
	   genuinely nothing to ask about. */
	it('asks for nothing and is enabled at once when no Fachbereich is selected', async () => {
		renderStep({ hasPublishedDpp: false, agencyId: null as never });

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
		draftAccepting(consentBindingKey(AGENCY_A, TOPIC, null, 'platform:de'));

		renderStep({ hasPublishedDpp: true, agencyId: AGENCY_A });

		await waitFor(() => expect(consentCheckbox()?.checked).toBe(true));
	});

	it('drops it when the Beratungsstelle changed while it was stored', async () => {
		draftAccepting(consentBindingKey(AGENCY_A, TOPIC, null, 'platform:de'));

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
		draftAccepting(consentBindingKey(AGENCY_A, TOPIC, null, 'platform:de'));
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

/**
 * Shirloin on PR #1110: a Träger text that exists but cannot be rendered — an
 * empty language map, or markup the allowlist strips to nothing — used to fall
 * through to the platform sentence while the acceptance still bound to the
 * Träger `versionId`. The help-seeker would have agreed to wording they never
 * saw, which is not consent in any sense that survives review.
 *
 * Each shape below reaches "unrenderable" by a genuinely different route:
 * `resolveLegalContent` takes a *string*, so a JSON map with no usable entry
 * fails at parsing, while markup that survives parsing can still be emptied by
 * the sanitizer. Fixtures that all collapse into one branch would let two of
 * these three names claim coverage the test does not have.
 */
describe('AccountData — an unrenderable Träger sentence blocks acceptance', () => {
	const unrenderable = {
		'a language map with no usable entry': '{}',
		'markup the allowlist strips to nothing': '<script>alert(1)</script>',
		'markup that sanitizes to whitespace only': '<p>   </p>'
	};

	it('tells the user what happened instead of leaving a nameless disabled box', async () => {
		vi.mocked(apiGetConsentText).mockResolvedValue(
			ok({ sentence: '{}', versionId: 4711 } as ConsentTextData)
		);

		renderStep({ hasPublishedDpp: true });

		await waitFor(() =>
			expect(
				document.querySelector(
					'[data-cy="consent-sentence-unrenderable"]'
				)
			).not.toBeNull()
		);
		expect(anyCheckbox()?.disabled).toBe(true);
	});

	Object.entries(unrenderable).forEach(([shape, sentence]) => {
		it(`shows no platform fallback and keeps the checkbox disabled — ${shape}`, async () => {
			vi.mocked(apiGetConsentText).mockResolvedValue(
				ok({ sentence, versionId: 4711 } as ConsentTextData)
			);

			renderStep({ hasPublishedDpp: true });

			/* Wait for the fetch to SETTLE, not merely for a checkbox to
			   exist. While the resolution is still `pending` the checkbox is
			   disabled anyway, so asserting there would pass whatever the
			   production code does — the pending notice disappearing is the
			   first moment the answer is the resolved one. */
			await waitFor(() =>
				expect(
					document.querySelector(
						'[data-cy="consent-sentence-pending"]'
					)
				).toBeNull()
			);
			// The platform sentence must NOT stand in for wording that failed
			// to render: it is not what the acceptance would bind to.
			expect(
				screen.queryByText('registration.dataProtection.label.prefix', {
					exact: false
				})
			).toBeNull();
			expect(anyCheckbox()?.disabled).toBe(true);
		});
	});

	it('still accepts a Träger sentence that does render', async () => {
		vi.mocked(apiGetConsentText).mockResolvedValue(
			ok({
				sentence:
					'Ich willige ein, dass meine Angaben nach {{legal_links}} verarbeitet werden.',
				versionId: 4711
			} as ConsentTextData)
		);

		renderStep({ hasPublishedDpp: true });

		await waitFor(() =>
			expect(screen.getByText(/Ich willige ein/)).toBeDefined()
		);
		/* Guards the fix from degenerating into "disable everything": the
		   renderable case must stay acceptable. Waited for rather than asserted
		   at once — the sentence is rendered by the label while the gate lives
		   one level up and is fed by an effect, so under load the two can be a
		   tick apart. The assertion is unchanged in strength: a checkbox that
		   never enables still fails. */
		await waitFor(() => expect(anyCheckbox()?.disabled).toBe(false));
	});
});

/**
 * Codex on PR #1110, three findings of one shape: something that is not the
 * Träger's wording was being treated as if it were.
 */
describe('AccountData — only real Träger wording counts as a consent sentence', () => {
	it('does not accept a sentence that is nothing but the mandatory token', async () => {
		vi.mocked(apiGetConsentText).mockResolvedValue(
			ok({
				sentence: '{{legal_links}}',
				versionId: 4711
			} as ConsentTextData)
		);

		renderStep({ hasPublishedDpp: true });

		await waitFor(() =>
			expect(
				document.querySelector('[data-cy="consent-sentence-pending"]')
			).toBeNull()
		);
		// Links plus the cookie notice are the platform's requirement, not a
		// statement anyone can agree to.
		expect(anyCheckbox()?.disabled).toBe(true);
	});

	it.each([
		['zero-width space', '\u200B'],
		['left-to-right mark', '\u200E'],
		['right-to-left mark', '\u200F'],
		['left-to-right isolate', '\u2066'],
		// Not in the string at all until a browser decodes it — the case that
		// showed string processing was the wrong tool here.
		['entity-encoded zero-width space', '&#x200B;'],
		['named entity for a soft hyphen', '&shy;'],
		// Mn, not Cf — outside the property the previous version used.
		['variation selector', '\uFE0F']
	])(
		'does not accept wording made only of a %s',
		async (_name, invisible) => {
			vi.mocked(apiGetConsentText).mockResolvedValue(
				ok({
					sentence: `${invisible}{{legal_links}}`,
					versionId: 4711
				} as ConsentTextData)
			);

			renderStep({ hasPublishedDpp: true });

			await waitFor(() =>
				expect(
					document.querySelector(
						'[data-cy="consent-sentence-pending"]'
					)
				).toBeNull()
			);
			expect(anyCheckbox()?.disabled).toBe(true);
		}
	);

	it('does not carry an acceptance across a revision of unversioned wording', async () => {
		vi.mocked(apiGetConsentText).mockResolvedValue(
			ok({
				sentence: 'Erste Fassung {{legal_links}}',
				versionId: null
			} as ConsentTextData)
		);
		// A draft accepted against the FIRST wording, restored next to the second.
		draftAccepting(
			consentBindingKey(AGENCY_A, TOPIC, null, 'Erste Fassung')
		);

		vi.mocked(apiGetConsentText).mockResolvedValue(
			ok({
				sentence: 'Zweite, andere Fassung {{legal_links}}',
				versionId: null
			} as ConsentTextData)
		);

		renderStep({ hasPublishedDpp: true });

		await waitFor(() =>
			expect(screen.getByText(/Zweite, andere Fassung/)).toBeDefined()
		);
		// Without a per-sentence fingerprint both revisions key to
		// `agency:topic:none` and this box would be restored ticked.
		expect(anyCheckbox()?.checked).toBe(false);
	});
});

/**
 * Codex P1 + P2 on PR #1110: two ways the governing wording could be missed —
 * one by never asking for it, one by rendering it without its links.
 */
describe('AccountData — inherited wording and mandatory links', () => {
	it('asks for the consent text even when the department has no policy of its own', async () => {
		vi.mocked(apiGetConsentText).mockResolvedValue(
			ok({
				sentence: 'Geerbter Trägersatz {{legal_links}}',
				versionId: null
			} as ConsentTextData)
		);

		// hasPublishedDpp === false means "no policy OF ITS OWN"; such a
		// department is governed by the Träger's inherited text.
		renderStep({ hasPublishedDpp: false });

		await waitFor(() =>
			expect(screen.getByText(/Geerbter Trägersatz/)).toBeDefined()
		);
		expect(apiGetConsentText).toHaveBeenCalled();
		// The platform sentence must not stand in for wording that governs.
		expect(
			screen.queryByText('registration.dataProtection.label.prefix', {
				exact: false
			})
		).toBeNull();
	});

	it('adds the policy links even when the sentence has an unrelated link of its own', async () => {
		vi.mocked(apiGetConsentText).mockResolvedValue(
			ok({
				// An own anchor plus the token in a dropped attribute: checking
				// merely for "an <a>" would be satisfied while the mandatory
				// privacy and imprint links are still missing.
				sentence:
					'<span title="{{legal_links}}">Ich willige ein, siehe <a href="https://traeger.example/info">Infos</a>.</span>',
				versionId: 4711
			} as ConsentTextData)
		);

		renderStep({ hasPublishedDpp: true });

		await waitFor(() =>
			expect(screen.getByText(/Ich willige ein/)).toBeDefined()
		);
		expect(
			document.querySelector('a[href="https://oriso.test/datenschutz"]')
		).not.toBeNull();
	});

	it('adds the policy links when the surviving anchor has nothing to click', async () => {
		vi.mocked(apiGetConsentText).mockResolvedValue(
			ok({
				// Right href, no content: an href test alone would suppress the
				// fallback and leave the disclosure unreachable.
				sentence:
					'<span title="{{legal_links}}">Ich willige ein.<a href="https://oriso.test/datenschutz"></a></span>',
				versionId: 4711
			} as ConsentTextData)
		);

		renderStep({ hasPublishedDpp: true });

		await waitFor(() =>
			expect(screen.getByText(/Ich willige ein/)).toBeDefined()
		);
		const links = Array.from(
			document.querySelectorAll<HTMLAnchorElement>(
				'a[href="https://oriso.test/datenschutz"]'
			)
		);
		expect(links.some((link) => link.textContent?.trim())).toBe(true);
	});

	it('adds the policy links when the URL appears only as visible text', async () => {
		vi.mocked(apiGetConsentText).mockResolvedValue(
			ok({
				// The privacy URL is present as prose, not as a link, while the
				// token sits in a dropped attribute. A substring test would be
				// satisfied; a help-seeker still has nothing to click.
				sentence:
					'<span title="{{legal_links}}">Ich willige ein, siehe https://oriso.test/datenschutz.</span>',
				versionId: 4711
			} as ConsentTextData)
		);

		renderStep({ hasPublishedDpp: true });

		await waitFor(() =>
			expect(screen.getByText(/Ich willige ein/)).toBeDefined()
		);
		expect(
			document.querySelector('a[href="https://oriso.test/datenschutz"]')
		).not.toBeNull();
	});

	it('keeps the policy links when the token sat in a stripped attribute', async () => {
		vi.mocked(apiGetConsentText).mockResolvedValue(
			ok({
				// `title` is not on the consent allowlist, so substituting into it
				// and sanitising afterwards would drop the anchors entirely.
				sentence:
					'<span title="{{legal_links}}">Ich willige ein.</span>',
				versionId: 4711
			} as ConsentTextData)
		);

		renderStep({ hasPublishedDpp: true });

		await waitFor(() =>
			expect(screen.getByText(/Ich willige ein/)).toBeDefined()
		);
		expect(document.querySelector('a[href]')).not.toBeNull();
	});
});

/**
 * Codex P1 on #1110: `resolveLegalContent` reports whether the wording shown is
 * a machine translation and which language is legally binding, and the hook was
 * discarding both. `LegalContentRenderer` surfaces them for a policy document;
 * a consent sentence needs it more, not less — ticking a box next to wording
 * whose binding version you have never seen is not informed consent.
 */
describe('AccountData — the help-seeker is told which wording binds', () => {
	it('names the language that actually binds, not a fixed one', async () => {
		vi.mocked(apiGetConsentText).mockResolvedValue(
			ok({
				sentence: JSON.stringify({
					de: 'Maschinelle Fassung {{legal_links}}',
					de__meta: { mt: true, src: 'en' },
					en: 'Authored wording {{legal_links}}'
				}),
				versionId: 4711
			} as ConsentTextData)
		);

		renderStep({ hasPublishedDpp: true });

		const notice = await waitFor(() => {
			const node = document.querySelector(
				'[data-cy="consent-machine-translated"]'
			);
			expect(node).not.toBeNull();
			return node as HTMLElement;
		});
		// The authored language is English here; a notice claiming the German
		// version binds would be a false legal statement.
		// The authored language is English here; a notice claiming the German
		// version binds would be a false legal statement.
		expect(notice.textContent).toContain('Englisch');
		expect(notice.textContent).not.toContain('deutsche Fassung');
	});

	it('says so when the sentence on screen is machine-translated', async () => {
		vi.mocked(apiGetConsentText).mockResolvedValue(
			ok({
				sentence: JSON.stringify({
					de: 'Maschinelle Fassung {{legal_links}}',
					de__meta: { mt: true, orig: 'en' },
					en: 'Authored wording {{legal_links}}'
				}),
				versionId: 4711
			} as ConsentTextData)
		);

		renderStep({ hasPublishedDpp: true });

		await waitFor(() =>
			expect(
				document.querySelector('[data-cy="consent-machine-translated"]')
			).not.toBeNull()
		);
		/* Shown, and acceptable — informing beats blocking, which would stop
		   registration wherever a Träger has not authored every language.
		   Waited for: the gate lives one level up and is fed by an effect. */
		await waitFor(() => expect(anyCheckbox()?.disabled).toBe(false));
	});

	it('says so when the sentence is shown in another language than the UI', async () => {
		vi.mocked(apiGetConsentText).mockResolvedValue(
			ok({
				// German UI, only English wording authored: the sentence is
				// displayed in English and the reader must be told why.
				sentence: JSON.stringify({
					en: 'Authored wording {{legal_links}}'
				}),
				versionId: 4711
			} as ConsentTextData)
		);

		renderStep({ hasPublishedDpp: true });

		await waitFor(() =>
			expect(
				document.querySelector('[data-cy="consent-fallback-language"]')
			).not.toBeNull()
		);
	});

	it('says nothing when the wording is the authored one', async () => {
		vi.mocked(apiGetConsentText).mockResolvedValue(
			ok({
				sentence: 'Ich willige ein {{legal_links}}',
				versionId: 4711
			} as ConsentTextData)
		);

		renderStep({ hasPublishedDpp: true });

		await waitFor(() =>
			expect(screen.getByText(/Ich willige ein/)).toBeDefined()
		);
		expect(
			document.querySelector('[data-cy="consent-machine-translated"]')
		).toBeNull();
		expect(
			document.querySelector('[data-cy="consent-fallback-language"]')
		).toBeNull();
	});
});

/**
 * Codex on #1110: the platform fallback passed no wording into the binding key,
 * so every language produced `agency:topic:none`. Tick the German sentence,
 * switch language with the pill, and the box stays ticked beside wording nobody
 * affirmatively accepted.
 */
describe('AccountData — a fallback acceptance belongs to the language it was given in', () => {
	beforeEach(() => {
		vi.mocked(apiGetConsentText).mockResolvedValue(ok(null));
	});

	it('does not carry a German fallback acceptance into another language', async () => {
		draftAccepting(consentBindingKey(AGENCY_A, TOPIC, null, 'platform:de'));

		renderStep({ hasPublishedDpp: false, locale: 'en' });

		await waitFor(() => expect(anyCheckbox()).not.toBeNull());
		expect(anyCheckbox()?.checked).toBe(false);
	});

	it('keeps it in the language it was given in', async () => {
		draftAccepting(consentBindingKey(AGENCY_A, TOPIC, null, 'platform:de'));

		renderStep({ hasPublishedDpp: false, locale: 'de' });

		await waitFor(() => expect(anyCheckbox()?.checked).toBe(true));
	});
});
