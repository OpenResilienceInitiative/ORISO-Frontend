// @vitest-environment jsdom
import * as React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

vi.mock('../../../api/apiAgencyLanguages', () => ({
	apiAgencyLanguages: vi.fn(async () => ({ languages: ['de', 'en'] }))
}));

// Pulled in by AgencySelectionResults' empty state. lottie-web grabs a canvas
// context at import time, which jsdom does not implement.
vi.mock('../../emptyState/SearchEmptyStateAnimation', () => ({
	SearchEmptyStateAnimation: () => null
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

/* eslint-disable import/first -- mocks above */
import { AgencyDetailsPanel } from './AgencyDetailsPanel';
import { AgencySelectionResults } from './AgencySelectionResults';
import { LegalLinksContext } from '../../../globalState/provider/LegalLinksProvider';
import { RegistrationContext } from '../../../globalState';
import {
	AgencyDataInterface,
	TopicsDataInterface
} from '../../../globalState/interfaces';
/* eslint-enable import/first */

const LANGUAGES_INTRO = 'Diese Beratungsstelle berät Sie auf:';

// `languages.<iso>` is what the mocked `t` returns for the language names, so
// this is the list `AgencyLanguages` renders once the API call settles.
const LANGUAGE_LIST = 'languages.de (DE) | languages.en (EN)';

const agency: AgencyDataInterface = {
	id: 101,
	name: 'Beratungszentrum Köln Mitte',
	description: 'Beratung zu Familie und Migration.',
	city: 'Köln',
	postcode: '50667',
	street: 'Domkloster',
	houseNumber: '3',
	openingHours: 'Mo-Do 9-17 Uhr',
	consultingType: 1,
	offline: false
};

const rowLabels = (container: HTMLElement): string[] =>
	Array.from(container.querySelectorAll('span.MuiTypography-caption')).map(
		(node) => node.textContent
	);

/** The whole card, so a sentence rendered by either half is counted. */
const renderCard = () =>
	render(
		<RegistrationContext.Provider
			value={{ setDisabledNextButton: vi.fn() } as any}
		>
			<AgencySelectionResults
				onChange={vi.fn()}
				results={[agency]}
				zipcode="50667"
				nextStepUrl=""
				fallbackUrl=""
				onNextClick={vi.fn()}
			/>
		</RegistrationContext.Provider>
	);

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
	vi.clearAllMocks();
});

describe('AgencyDetailsPanel (#1274)', () => {
	it('orders the rows About, Sprachen, Adresse', () => {
		const { container } = render(
			<AgencyDetailsPanel agency={agency} open />
		);

		expect(rowLabels(container)).toEqual([
			'Zu dieser Beratungsstelle',
			'Sprachen',
			'Adresse'
		]);
	});

	it('hides the opening hours row even when the agency has them', () => {
		const { container } = render(
			<AgencyDetailsPanel agency={agency} open />
		);

		expect(rowLabels(container)).not.toContain('Öffnungszeiten');
		expect(screen.queryByText(/Mo-Do 9-17 Uhr/)).toBeNull();
	});

	it('renders the languages intro and the language list once per card', async () => {
		const user = userEvent.setup();
		renderCard();

		await user.click(
			screen.getByRole('button', { name: `Mehr: ${agency.name}` })
		);
		await screen.findByText(LANGUAGE_LIST);

		// Both used to render twice: once in the collapsed card header and again
		// in the expanded Sprachen row.
		expect(screen.getAllByText(LANGUAGE_LIST)).toHaveLength(1);
		expect([
			...screen.queryAllByText(LANGUAGES_INTRO),
			...screen.queryAllByTitle(LANGUAGES_INTRO)
		]).toHaveLength(1);
	});

	it('opens the languages tooltip on keyboard focus, not hover only', async () => {
		const user = userEvent.setup();
		render(<AgencyDetailsPanel agency={agency} open />);

		const trigger = screen.getByText('Sprachen', { selector: 'span' });
		expect(trigger.getAttribute('tabindex')).toBe('0');

		await user.tab();
		expect(document.activeElement).toBe(trigger);

		const tooltip = await screen.findByRole('tooltip');
		expect(tooltip.textContent).toContain(LANGUAGES_INTRO);
	});
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
