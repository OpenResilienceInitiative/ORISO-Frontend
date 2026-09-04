// @vitest-environment jsdom
import * as React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AgencyDataInterface } from '../../../globalState/interfaces';

vi.mock('../../../api/apiAgencyLanguages', () => ({
	apiAgencyLanguages: vi.fn(async () => ({ languages: ['de', 'en'] }))
}));

// Pulled in by AgencySelectionResults' empty state. lottie-web grabs a canvas
// context at import time, which jsdom does not implement.
vi.mock('../../emptyState/SearchEmptyStateAnimation', () => ({
	SearchEmptyStateAnimation: () => null
}));

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string, fallback?: string) => fallback ?? key,
		i18n: { language: 'de' }
	})
}));

/* eslint-disable import/first -- mocks above */
import { AgencyDetailsPanel } from './AgencyDetailsPanel';
import { AgencySelectionResults } from './AgencySelectionResults';
import { RegistrationContext } from '../../../globalState';
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

describe('AgencyDetailsPanel (#1274)', () => {
	afterEach(() => {
		cleanup();
		vi.clearAllMocks();
	});

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
