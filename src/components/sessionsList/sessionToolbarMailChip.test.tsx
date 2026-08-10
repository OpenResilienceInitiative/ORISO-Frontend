// @vitest-environment jsdom
/**
 * Regression guard for #985 — the modality formerly labelled "Nähe" is called
 * "Mail" everywhere. "Nähe" was too obscure for practitioners, and it appeared
 * in more than the one filter chip the reporter saw: the session-list toolbar,
 * the enquiry filter row, the list-item modality badge, and the catalogues
 * behind them all carried it.
 *
 * Covers both paths a label can take: the catalogue entry and the hardcoded
 * `translate(key, fallback)` default that is used when the catalogue misses.
 */

import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SessionsListToolbar } from './SessionsListToolbar';
import { EnquiryFilterChips } from './EnquiryFilterChips';
import deCommon from '../../resources/i18n/de/common.json';
import deInformalCommon from '../../resources/i18n/de@informal/common.json';
import enCommon from '../../resources/i18n/en/common.json';

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
		NearbyFilterIcon: Icon,
		SupervisionFilterIcon: Icon,
		UnreadFilterIcon: Icon
	};
});

const CATALOGUES: [string, typeof deCommon][] = [
	['de', deCommon],
	['de@informal', deInformalCommon as typeof deCommon],
	['en', enCommon as typeof deCommon]
];

describe('"Mail" modality label (#985)', () => {
	it.each(CATALOGUES)(
		'labels both chip keys "Mail" in %s',
		(_, catalogue) => {
			const chips = catalogue.sessionList.toolbar.chips;

			expect(chips.nearby).toBe('Mail');
			expect(chips.chats).toBe('Mail');
		}
	);

	it('renders "Mail" in the session-list toolbar when the catalogue is missing', () => {
		// `translate` echoing the key is how the toolbar sees an unresolved
		// entry, which makes it fall through to the hardcoded default.
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
					createGroupChatPath="/sessions/create"
					archiveTabPath="/sessions/archive"
					archiveTabActive={false}
					createGroupChatActive={false}
				/>
			</MemoryRouter>
		);

		expect(screen.getByText('Mail')).toBeTruthy();
		expect(screen.queryByText('Nähe')).toBeNull();
		expect(screen.queryByText('Nearby')).toBeNull();
	});

	it('renders the German chip label in the enquiry filter row', () => {
		render(
			<EnquiryFilterChips
				translate={(key) =>
					key === 'sessionList.toolbar.chips.nearby'
						? deCommon.sessionList.toolbar.chips.nearby
						: key
				}
				activeChip={null}
				onChipToggle={vi.fn()}
				showLiveChatChip={false}
			/>
		);

		expect(screen.getByText('Mail')).toBeTruthy();
		expect(screen.queryByText('Nähe')).toBeNull();
	});
});
