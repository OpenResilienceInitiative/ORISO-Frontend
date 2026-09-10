// @vitest-environment jsdom
import * as React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

// The German fallbacks are what a fresh tenant sees, so the test asserts them
// rather than a catalogue lookup: `t` hands back the key, `translateWithFallback`
// then serves the default written into the component.
vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string) => key,
		i18n: { language: 'de' }
	})
}));

// The legal popup reaches a Lottie player through its dialog chrome, and that
// player touches a canvas 2d context at module load — which jsdom does not
// have. Same mock `useTenantTheming.test.tsx` uses.
vi.mock('lottie-react', () => ({ default: () => null }));

vi.mock('../../../globalState/provider/TenantProvider', async () => {
	const ReactModule = await import('react');
	return {
		TenantContext: ReactModule.createContext({}),
		useTenant: () => null
	};
});

/* eslint-disable import/first -- must load after the vi.mock calls above. */
import { DataProtectionSnackbar } from './DataProtectionSnackbar';
import { LegalLinksContext } from '../../../globalState/provider/LegalLinksProvider';
/* eslint-enable import/first */

const PRIVACY_URL = 'https://oriso.test/datenschutz';

const legalLinks = [
	{
		label: 'login.legal.infoText.dataprotection',
		registration: true,
		getUrl: () => PRIVACY_URL
	},
	{
		label: 'login.legal.infoText.impressum',
		registration: true,
		getUrl: () => 'https://oriso.test/impressum'
	}
] as never;

const renderNote = (links: unknown = legalLinks) =>
	render(
		<LegalLinksContext.Provider value={links as never}>
			<DataProtectionSnackbar />
		</LegalLinksContext.Provider>
	);

afterEach(cleanup);

describe('DataProtectionSnackbar — the live-chat privacy note', () => {
	/* Frank's wording, verbatim (ORISO-Frontend#1341, item 5). It ships as the
	   German fallback of three catalogue keys, so it is on screen for a fresh
	   tenant whose platform admin has configured nothing at all. */
	it('says the default sentence without anything being configured first', () => {
		renderNote();

		expect(
			screen.getByTestId('registration-dataprotection-snackbar')
				.textContent
		).toBe(
			'Das ist unsere Datenschutzbestimmung. Für Authentifizierung und ' +
				'Navigation verwendet diese Websites Cookies.'
		);
	});

	/* The same button the stage footer's „Datenschutzerklärung" is, so it opens
	   the same popup and not a second one. `data-cy-link` is what carries the
	   configured privacy URL through `LegalLinkButton`. */
	it('links the platform data-privacy document, not the imprint', () => {
		renderNote();

		const link = screen.getByRole('button', {
			name: 'Datenschutzbestimmung'
		});
		expect(link.getAttribute('data-cy-link')).toBe(PRIVACY_URL);
	});

	it('opens the shared legal popup rather than leaving the page', async () => {
		renderNote();

		await userEvent.click(
			screen.getByRole('button', { name: 'Datenschutzbestimmung' })
		);

		expect(screen.getByTestId('legal-modal-privacy')).toBeTruthy();
	});

	/* A deployment with no privacy link configured must still read as a
	   sentence. A dead anchor would promise a document that is not there. */
	it('keeps the sentence whole when no privacy link is configured', () => {
		renderNote([]);

		expect(screen.getByText(/Datenschutzbestimmung/)).toBeTruthy();
		expect(
			screen.queryByRole('button', { name: 'Datenschutzbestimmung' })
		).toBeNull();
	});

	it('goes away when it is dismissed', async () => {
		renderNote();

		await userEvent.click(
			screen.getByRole('button', { name: 'Schließen' })
		);

		expect(
			screen.queryByTestId('registration-dataprotection-snackbar')
		).toBeNull();
	});
});
