// @vitest-environment jsdom
/**
 * Search menu behaviour in the toolbar (#1195 JOB7).
 *
 * Selecting a person must not make the menu unusable. The menu itself already
 * closed only on Enter / the red confirm control / an outside click, but the
 * result list collapsed to the current selection as soon as one person was
 * picked (toggling clears the query, and the empty-query branch returned only
 * the selection), so a second person could never be selected.
 */

import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SessionsListToolbar } from './SessionsListToolbar';

afterEach(cleanup);

vi.mock('./SessionToolbarFilterIcons', () => {
	const Icon = () => <span aria-hidden />;
	return {
		ArchiveFilterIcon: Icon,
		CreateChatFilterIcon: Icon,
		DraftFilterIcon: Icon,
		GroupFilterIcon: Icon,
		InternalGroupFilterIcon: Icon,
		LiveChatFilterIcon: Icon,
		MailFilterIcon: Icon,
		NearbyFilterIcon: Icon,
		SupervisionFilterIcon: Icon,
		UnreadFilterIcon: Icon
	};
});

const roster = [
	{
		id: '1:asker',
		name: 'iene_lou_7575',
		subtitle: 'Ratsuchende:r | Mainz',
		role: 'asker' as const,
		avatarSeed: 'a'
	},
	{
		id: '2:asker',
		name: 'ratsuchender_4',
		subtitle: 'Ratsuchende:r | Mainz',
		role: 'asker' as const,
		avatarSeed: 'b'
	},
	{
		id: '3:consultant',
		name: 'Ingrid Koschmider',
		subtitle: 'Berater:in | Mainz',
		role: 'consultant' as const,
		avatarSeed: 'c'
	}
];

const openSearch = (selectedPersonIds: string[] = []) => {
	const onSelectedPersonIdsChange = vi.fn();
	render(
		<MemoryRouter>
			<SessionsListToolbar
				translate={(key) => key}
				searchValue=""
				onSearchChange={vi.fn()}
				activeChip={null}
				onChipToggle={vi.fn()}
				showConsultantActions
				showCreateGroupChatAction={false}
				showSupervisionChip={false}
				showGroupChip
				showInternalGroupChip
				createGroupChatPath="/sessions/create"
				archiveTabPath="/sessions/archive"
				archiveTabActive={false}
				createGroupChatActive={false}
				searchPeopleResults={roster}
				selectedPersonIds={selectedPersonIds}
				onSelectedPersonIdsChange={onSelectedPersonIdsChange}
			/>
		</MemoryRouter>
	);
	fireEvent.focus(screen.getByRole('searchbox'));
	return { onSelectedPersonIdsChange };
};

const personRows = () =>
	screen
		.getAllByRole('checkbox')
		.filter((node) =>
			node.getAttribute('data-cy')?.startsWith('session-search-person-')
		);

describe('SessionsListToolbar search menu — selecting people (JOB7)', () => {
	it('lists every person when the menu opens', () => {
		openSearch();

		expect(personRows()).toHaveLength(3);
	});

	it('keeps the full list visible once a person is selected', () => {
		openSearch(['1:asker']);

		expect(personRows()).toHaveLength(3);
	});

	it('still lists everyone after three people are selected in a row', () => {
		openSearch(['1:asker', '2:asker', '3:consultant']);

		expect(personRows()).toHaveLength(3);
	});

	it('keeps the menu open when a person is toggled', () => {
		const { onSelectedPersonIdsChange } = openSearch();

		fireEvent.click(personRows()[1]);

		expect(onSelectedPersonIdsChange).toHaveBeenCalled();
		expect(
			screen.getByTestId('session-search-results-scroll')
		).toBeTruthy();
	});
});
