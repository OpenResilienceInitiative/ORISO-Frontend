// @vitest-environment jsdom
import * as React from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const TRANSLATIONS: Record<string, string> = {
	'registration.dataProtection.label.prefix': 'Ich habe die ',
	'registration.dataProtection.label.and': ' und ',
	'registration.dataProtection.label.suffix':
		' zur Kenntnis genommen. Für Authentifizierung und Navigation verwendet diese Webseite Cookies.',
	'registration.dataProtection.cookieNotice':
		'Für Authentifizierung und Navigation verwendet diese Webseite Cookies.',
	'legal.dataprotection': 'Datenschutzerklärung',
	'legal.imprint': 'Impressum'
};

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string, fallback?: string) =>
			TRANSLATIONS[key] ?? fallback ?? key,
		i18n: { language: 'de' }
	})
}));

vi.mock('../../../api/apiGetConsentText', () => ({
	apiGetConsentText: vi.fn()
}));

// `LegalLinksProvider` pulls in the app config and from there, transitively,
// lottie-web — which blows up in jsdom for reasons that have nothing to do
// with a consent sentence. Only the context object itself is needed, and both
// the component and this file import it from the mocked module, so it is the
// same object on both sides.
vi.mock('../../../globalState/provider/LegalLinksProvider', async () => {
	const ReactModule = await import('react');

	return { LegalLinksContext: ReactModule.createContext([]) };
});

/* eslint-disable import/first -- must load after the vi.mock calls above. */
import { DataProtectionConsentLabel } from './DataProtectionConsentLabel';
import { apiGetConsentText } from '../../../api/apiGetConsentText';
import { LegalLinksContext } from '../../../globalState/provider/LegalLinksProvider';
import {
	AgencyDataInterface,
	TopicsDataInterface
} from '../../../globalState/interfaces';
/* eslint-enable import/first */

const legalLinks = [
	{
		label: 'legal.dataprotection',
		registration: true,
		getUrl: () => 'https://oriso.test/datenschutz'
	},
	{
		label: 'legal.imprint',
		registration: true,
		getUrl: () => 'https://oriso.test/impressum'
	},
	{
		label: 'legal.termsAndConditions',
		registration: false,
		getUrl: () => 'https://oriso.test/agb'
	}
] as unknown as React.ContextType<typeof LegalLinksContext>;

const topic = { id: 7, name: 'Suchtberatung' } as TopicsDataInterface;

const agencyWith = (hasPublishedDpp: boolean) =>
	({
		id: 42,
		name: 'Beratungsstelle Musterstadt',
		departments: [{ topicId: 7, hasPublishedDpp }]
	}) as unknown as AgencyDataInterface;

const renderLabel = (agency?: AgencyDataInterface) =>
	render(
		<LegalLinksContext.Provider value={legalLinks}>
			<DataProtectionConsentLabel agency={agency} topic={topic} />
		</LegalLinksContext.Provider>
	);

afterEach(() => {
	cleanup();
	vi.clearAllMocks();
});

describe('DataProtectionConsentLabel — fallback is today, unchanged', () => {
	beforeEach(() => {
		vi.mocked(apiGetConsentText).mockResolvedValue(null);
	});

	it('renders the three-fragment sentence and never asks the backend when the Fachbereich has no published policy', async () => {
		renderLabel(agencyWith(false));

		await waitFor(() =>
			expect(screen.getByText(/Ich habe die/)).toBeDefined()
		);
		expect(
			screen.getByRole('link', { name: 'Datenschutzerklärung' })
		).toBeDefined();
		expect(screen.getByRole('link', { name: 'Impressum' })).toBeDefined();
		// The non-registration link stays out — `filter` semantics preserved.
		expect(screen.queryByRole('link', { name: /agb/i })).toBeNull();
		expect(
			screen.getByText(
				/Für Authentifizierung und Navigation verwendet diese Webseite Cookies\./
			)
		).toBeDefined();
		expect(apiGetConsentText).not.toHaveBeenCalled();
	});

	it('falls back when the backend has a policy but no consent sentence', async () => {
		renderLabel(agencyWith(true));

		await waitFor(() =>
			expect(apiGetConsentText).toHaveBeenCalledWith(
				42,
				7,
				expect.anything()
			)
		);
		await waitFor(() =>
			expect(screen.getByText(/Ich habe die/)).toBeDefined()
		);
		// Exactly one cookie sentence: the fallback carries it inside its own
		// suffix, so the fixed addendum must NOT be added on top of it.
		expect(
			screen.getAllByText(
				/Für Authentifizierung und Navigation verwendet diese Webseite Cookies\./
			)
		).toHaveLength(1);
	});

	it('falls back when no agency has been selected yet', async () => {
		renderLabel(undefined);

		await waitFor(() =>
			expect(screen.getByText(/Ich habe die/)).toBeDefined()
		);
		expect(apiGetConsentText).not.toHaveBeenCalled();
	});
});

describe('DataProtectionConsentLabel — the Träger sentence', () => {
	it('renders the server-substituted sentence with real, clickable links', async () => {
		vi.mocked(apiGetConsentText).mockResolvedValue({
			// {{Beratungsstelle}} / {{Thema}} are already substituted server-side
			// (ADR-021 decision 5); only {{legal_links}} arrives intact.
			sentence:
				'Ich willige ein, dass die Beratungsstelle Musterstadt meine Angaben zum Thema Suchtberatung nach {{legal_links}} verarbeitet.',
			versionId: 'v-7',
			cookieNotice: null
		});

		renderLabel(agencyWith(true));

		await waitFor(() =>
			expect(screen.getByText(/Ich willige ein/)).toBeDefined()
		);
		expect(screen.getByText(/Beratungsstelle Musterstadt/)).toBeDefined();
		expect(screen.getByText(/Suchtberatung/)).toBeDefined();
		// The platform's three fragments are gone — the Träger text *replaces*
		// the platform sentence (ADR-021 decision 2), it is not appended to it.
		expect(screen.queryByText(/Ich habe die/)).toBeNull();

		const policyLink = screen.getByRole('link', {
			name: 'Datenschutzerklärung'
		});
		expect(policyLink.getAttribute('href')).toBe(
			'https://oriso.test/datenschutz'
		);
		expect(policyLink.getAttribute('target')).toBe('_blank');
		expect(screen.getByRole('link', { name: 'Impressum' })).toBeDefined();
	});

	it('renders the cookie/authentication notice as a fixed addendum beneath it', async () => {
		vi.mocked(apiGetConsentText).mockResolvedValue({
			sentence: 'Kurzer Trägersatz mit {{legal_links}}.',
			versionId: null,
			cookieNotice: null
		});

		const { container } = renderLabel(agencyWith(true));

		await waitFor(() =>
			expect(screen.getByText(/Kurzer Trägersatz/)).toBeDefined()
		);
		const notice = container.querySelector(
			'[data-cy="consent-cookie-notice"]'
		);
		expect(notice?.textContent).toBe(
			'Für Authentifizierung und Navigation verwendet diese Webseite Cookies.'
		);
		// "beneath": the addendum follows the sentence in document order.
		const sentence = container.querySelector(
			'[data-cy="consent-sentence-traeger"]'
		);
		expect(
			sentence.compareDocumentPosition(notice) &
				Node.DOCUMENT_POSITION_FOLLOWING
		).toBeTruthy();
	});

	it('prefers the addendum wording the backend delivers over its own', async () => {
		// ORISO-AgencyService#254 ships the fixed addendum in the payload so
		// every client renders the same wording. The frontend string is the
		// stand-in until then — the addendum itself is never optional.
		vi.mocked(apiGetConsentText).mockResolvedValue({
			sentence: 'Trägersatz mit {{legal_links}}.',
			versionId: null,
			cookieNotice:
				'Diese Seite nutzt Cookies ausschließlich zur Anmeldung.'
		});

		const { container } = renderLabel(agencyWith(true));

		await waitFor(() =>
			expect(screen.getByText(/Trägersatz mit/)).toBeDefined()
		);
		expect(
			container.querySelector('[data-cy="consent-cookie-notice"]')
				?.textContent
		).toBe('Diese Seite nutzt Cookies ausschließlich zur Anmeldung.');
	});

	it('resolves the language map the other legal texts use', async () => {
		vi.mocked(apiGetConsentText).mockResolvedValue({
			sentence: JSON.stringify({
				de: 'Deutscher Trägersatz mit {{legal_links}}.',
				en: 'English consent sentence with {{legal_links}}.'
			}),
			versionId: null,
			cookieNotice: null
		});

		renderLabel(agencyWith(true));

		await waitFor(() =>
			expect(screen.getByText(/Deutscher Trägersatz/)).toBeDefined()
		);
		expect(screen.queryByText(/English consent sentence/)).toBeNull();
	});

	it('sanitizes the Träger sentence through the shared legal allowlist', async () => {
		vi.mocked(apiGetConsentText).mockResolvedValue({
			sentence: [
				'Ich willige ein, siehe {{legal_links}}.',
				'<script>window.__consentXss = true;</script>',
				'<img src="https://oriso.test/x.png" onerror="window.__consentXss = true">'
			].join(''),
			versionId: null,
			cookieNotice: null
		});

		const { container } = renderLabel(agencyWith(true));

		await waitFor(() =>
			expect(screen.getByText(/Ich willige ein/)).toBeDefined()
		);
		expect(container.querySelector('script')).toBeNull();
		expect(container.innerHTML).not.toContain('onerror');
		expect(
			(window as unknown as Record<string, unknown>).__consentXss
		).toBeUndefined();
		// …and the links still work.
		expect(
			screen
				.getByRole('link', { name: 'Datenschutzerklärung' })
				.getAttribute('href')
		).toBe('https://oriso.test/datenschutz');
	});

	it('keeps the links reachable even if a sentence without the mandatory token slips through', async () => {
		vi.mocked(apiGetConsentText).mockResolvedValue({
			sentence: 'Trägersatz ganz ohne Pflicht-Token.',
			versionId: null,
			cookieNotice: null
		});

		renderLabel(agencyWith(true));

		await waitFor(() =>
			expect(screen.getByText(/Trägersatz ganz ohne/)).toBeDefined()
		);
		expect(
			screen.getByRole('link', { name: 'Datenschutzerklärung' })
		).toBeDefined();
	});

	it('shows no sentence at all while a configured Fachbereich is still loading', () => {
		vi.mocked(apiGetConsentText).mockReturnValue(new Promise(() => {}));

		const { container } = renderLabel(agencyWith(true));

		// Never the platform wording as a placeholder: the checkbox must not
		// briefly carry a sentence that is not the one in force.
		expect(container.textContent).toBe('');
	});
});
