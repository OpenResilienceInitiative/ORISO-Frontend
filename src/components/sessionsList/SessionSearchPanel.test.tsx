// @vitest-environment jsdom
/**
 * Search refinement panel (#1195).
 *
 * JOB1 — agencies are multi-selectable in the counselling-centre tab.
 * JOB3 — the result list scrolls inside the menu and auto-paginates 10 at a time.
 * JOB4 — rows use the generated animal avatars, not letter monograms.
 * JOB6 — rows use the MUI checkbox, not a hand-rolled span.
 */

import React from 'react';
import { act, cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	SessionSearchPanel,
	SessionSearchPanelLabels,
	SessionSearchPersonOption
} from './SessionSearchPanel';

afterEach(cleanup);

const labels: SessionSearchPanelLabels = {
	refineHint: 'Refine your search further using filters',
	tabPeople: 'People',
	tabType: 'By type',
	tabCentre: 'Counseling center',
	tabArchiveOnly: 'Archive only',
	emptyPeople: 'No matching people found.',
	emptyTypes: 'No chat types available.',
	emptyTopics: 'No topics found for your counseling centers.'
};

const person = (n: number): SessionSearchPersonOption => ({
	id: `${n}:asker`,
	name: `person_${n}`,
	subtitle: 'Ratsuchende:r | Mainz 30232',
	role: 'asker',
	avatarSeed: `seed-${n}`
});

const people = (count: number) =>
	Array.from({ length: count }, (_, i) => person(i + 1));

/** Captures the observer so a test can drive the sentinel manually. */
let intersect: (() => void) | null = null;

beforeEach(() => {
	intersect = null;
	vi.stubGlobal(
		'IntersectionObserver',
		class {
			constructor(cb: (entries: { isIntersecting: boolean }[]) => void) {
				intersect = () => cb([{ isIntersecting: true }]);
			}
			observe() {}
			disconnect() {}
			unobserve() {}
		}
	);
});

const renderPanel = (
	overrides: Partial<React.ComponentProps<typeof SessionSearchPanel>> = {}
) =>
	render(
		<SessionSearchPanel
			labels={labels}
			activeTab="people"
			onTabChange={vi.fn()}
			archiveOnly={false}
			onArchiveOnlyChange={vi.fn()}
			people={people(3)}
			selectedPersonIds={[]}
			onPersonToggle={vi.fn()}
			types={[]}
			selectedTypeId={null}
			onTypeSelect={vi.fn()}
			topics={[]}
			selectedTopicId={null}
			onTopicSelect={vi.fn()}
			{...overrides}
		/>
	);

describe('SessionSearchPanel — animal avatars (JOB4)', () => {
	it('renders a generated avatar per row instead of a letter monogram', () => {
		renderPanel();

		expect(
			screen.getAllByTestId('session-search-person-avatar')
		).toHaveLength(3);
	});

	it('does not render the two-letter monogram fallback', () => {
		renderPanel({ people: [person(1)] });

		expect(screen.queryByText('PE')).toBeNull();
	});
});

describe('SessionSearchPanel — MUI checkbox (JOB6)', () => {
	it('renders the MUI unchecked checkbox for an unselected row', () => {
		renderPanel({ people: [person(1)] });
		const row = screen.getByRole('checkbox');

		expect(
			within(row).getByTestId('CheckBoxOutlineBlankIcon')
		).toBeTruthy();
	});

	it('renders the MUI checked checkbox for a selected row', () => {
		renderPanel({ people: [person(1)], selectedPersonIds: ['1:asker'] });
		const row = screen.getByRole('checkbox');

		expect(within(row).getByTestId('CheckBoxIcon')).toBeTruthy();
	});
});

describe('SessionSearchPanel — inside scroll and auto-pagination (JOB3)', () => {
	it('shows at most 10 people before paginating', () => {
		renderPanel({ people: people(25) });

		expect(screen.getAllByRole('checkbox')).toHaveLength(10);
	});

	it('loads the next 10 when the sentinel scrolls into view', () => {
		renderPanel({ people: people(25) });

		act(() => intersect?.());

		expect(screen.getAllByRole('checkbox')).toHaveLength(20);
	});

	it('stops paginating once every person is shown', () => {
		renderPanel({ people: people(12) });

		act(() => intersect?.());
		act(() => intersect?.());

		expect(screen.getAllByRole('checkbox')).toHaveLength(12);
	});

	it('keeps the scroll position across an unrelated roster re-render', () => {
		// The session list re-derives its people array whenever a message
		// arrives; that must not snap a paginated list back to page 1.
		const { rerender } = renderPanel({ people: people(25) });
		act(() => intersect?.());
		expect(screen.getAllByRole('checkbox')).toHaveLength(20);

		rerender(
			<SessionSearchPanel
				labels={labels}
				activeTab="people"
				onTabChange={vi.fn()}
				archiveOnly={false}
				onArchiveOnlyChange={vi.fn()}
				people={people(25)}
				selectedPersonIds={[]}
				onPersonToggle={vi.fn()}
				types={[]}
				selectedTypeId={null}
				onTypeSelect={vi.fn()}
				topics={[]}
				selectedTopicId={null}
				onTopicSelect={vi.fn()}
			/>
		);

		expect(screen.getAllByRole('checkbox')).toHaveLength(20);
	});

	it('puts the results in their own scroll container', () => {
		renderPanel({ people: people(25) });

		expect(
			screen.getByTestId('session-search-results-scroll')
		).toBeTruthy();
	});
});

describe('SessionSearchPanel — two-agency filter (JOB1)', () => {
	const agencies = [
		{ id: '77', label: 'Beratungsstelle Mainz' },
		{ id: '42', label: 'Beratungsstelle Berlin' }
	];

	it('lists the counsellor agencies in the counselling-centre tab', () => {
		renderPanel({ activeTab: 'centre', agencies });

		expect(screen.getByText('Beratungsstelle Mainz')).toBeTruthy();
		expect(screen.getByText('Beratungsstelle Berlin')).toBeTruthy();
	});

	it('lets both agencies be selected at once', () => {
		renderPanel({
			activeTab: 'centre',
			agencies,
			selectedAgencyIds: ['77', '42']
		});

		const checked = screen
			.getAllByRole('checkbox')
			.filter((node) => node.getAttribute('aria-checked') === 'true');

		expect(checked).toHaveLength(2);
	});

	it('toggles an agency without clearing the other', () => {
		const onAgencyToggle = vi.fn();
		renderPanel({
			activeTab: 'centre',
			agencies,
			selectedAgencyIds: ['77'],
			onAgencyToggle
		});

		screen.getByTestId('session-search-agency-42').click();

		expect(onAgencyToggle).toHaveBeenCalledWith('42');
	});
});
