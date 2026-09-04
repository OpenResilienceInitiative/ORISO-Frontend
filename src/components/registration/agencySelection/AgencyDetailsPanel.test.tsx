// @vitest-environment jsdom

import * as React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const TRANSLATIONS: Record<string, string> = {
	'login.legal.infoText.dataprotection': 'Datenschutzerklärung',
	'login.legal.infoText.impressum': 'Impressum'
};

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string, fallback?: string) =>
			TRANSLATIONS[key] ?? fallback ?? key,
		i18n: { language: 'de' }
	}),
	Trans: ({ i18nKey }: { i18nKey: string }) => <>{i18nKey}</>
}));

// AgencyDetailsPanel imports RegistrationContext from the globalState barrel,
// which re-exports RegistrationProvider → AgencySelection → lottie-web.
vi.mock('../../../globalState', async () => {
	const ReactModule = await import('react');
	return {
		RegistrationContext: ReactModule.createContext({})
	};
});

vi.mock('../../../globalState/provider/LegalLinksProvider', async () => {
	const ReactModule = await import('react');
	return { LegalLinksContext: ReactModule.createContext([]) };
});

vi.mock('../../../globalState/provider/TenantProvider', () => ({
	useTenant: () => ({ content: {} })
}));

vi.mock('./AgencyLanguages', () => ({
	AgencyLanguages: () => null
}));

/* eslint-disable import/first -- must load after the vi.mock calls above. */
import { AgencyDetailsPanel } from './AgencyDetailsPanel';
import { LegalLinksContext } from '../../../globalState/provider/LegalLinksProvider';
import { RegistrationContext } from '../../../globalState';
import {
	AgencyDataInterface,
	TopicsDataInterface
} from '../../../globalState/interfaces';
/* eslint-enable import/first */

const topic = { id: 7, name: 'Suchtberatung' } as TopicsDataInterface;

const legalLinks = [
	{
		label: 'login.legal.infoText.dataprotection',
		registration: true,
		getUrl: () => 'https://oriso.test/datenschutz'
	},
	{
		label: 'login.legal.infoText.impressum',
		registration: true,
		getUrl: () => 'https://oriso.test/impressum'
	}
] as unknown as React.ContextType<typeof LegalLinksContext>;

const agencyWith = (flags: {
	hasPublishedDpp?: boolean;
	hasPublishedImprint?: boolean;
}) =>
	({
		id: 42,
		name: 'Beratungsstelle Musterstadt',
		city: '',
		postcode: '',
		description: '',
		consultingType: 0,
		offline: false,
		departments: [{ topicId: 7, ...flags }]
	}) as AgencyDataInterface;

const renderPanel = (agency: AgencyDataInterface) =>
	render(
		<LegalLinksContext.Provider value={legalLinks}>
			<RegistrationContext.Provider
				value={
					{
						registrationData: { mainTopic: topic }
					} as React.ContextType<typeof RegistrationContext>
				}
			>
				<AgencyDetailsPanel agency={agency} open />
			</RegistrationContext.Provider>
		</LegalLinksContext.Provider>
	);

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
});

describe('AgencyDetailsPanel — Rechtliches row', () => {
	it('renders a Datenschutzerklärung button instead of the accordion when DPP is published', () => {
		renderPanel(agencyWith({ hasPublishedDpp: true }));

		expect(
			screen.getByRole('button', { name: 'Datenschutzerklärung' })
		).toBeTruthy();
		expect(screen.queryByRole('button', { name: 'Impressum' })).toBeNull();
		expect(
			screen.queryByText('Datenschutzhinweise der Beratungsstelle')
		).toBeNull();
		expect(screen.queryByText('Rechtliches')).toBeTruthy();
	});

	it('hides the Rechtliches row when neither document is published', () => {
		renderPanel(agencyWith({}));

		expect(screen.queryByText('Rechtliches')).toBeNull();
		expect(
			screen.queryByRole('button', { name: 'Datenschutzerklärung' })
		).toBeNull();
		expect(screen.queryByRole('button', { name: 'Impressum' })).toBeNull();
	});

	it('opens the shared modal on click, not a new tab', () => {
		const open = vi.spyOn(window, 'open').mockImplementation(() => null);

		renderPanel(agencyWith({ hasPublishedDpp: true }));
		fireEvent.click(
			screen.getByRole('button', { name: 'Datenschutzerklärung' })
		);

		expect(open).not.toHaveBeenCalled();
		expect(screen.getByTestId('legal-modal-privacy')).toBeTruthy();
	});

	it('renders only the Impressum button when only imprint is published', () => {
		renderPanel(agencyWith({ hasPublishedImprint: true }));

		expect(screen.getByRole('button', { name: 'Impressum' })).toBeTruthy();
		expect(
			screen.queryByRole('button', { name: 'Datenschutzerklärung' })
		).toBeNull();
	});
});
