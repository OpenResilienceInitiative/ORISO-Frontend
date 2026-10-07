// @vitest-environment jsdom
/**
 * Regression guard for #985 — the modality formerly labelled "Nähe" is called
 * "Mail" everywhere. "Nähe" was too obscure for practitioners, and it appeared
 * in more than the one filter chip the reporter saw: the session-list toolbar,
 * the enquiry filter row, the list-item modality badge, and the catalogues
 * behind them all carried it.
 *
 * Covers the catalogue path. Missing keys must follow `fallbackLng`
 * (#1154), not snap to a hardcoded English "Mail".
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
		MailFilterIcon: Icon,
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

	it('renders the catalogue Mail label in the session-list toolbar', () => {
		render(
			<MemoryRouter>
				<SessionsListToolbar
					translate={(key) =>
						key === 'sessionList.toolbar.chips.nearby'
							? deCommon.sessionList.toolbar.chips.nearby
							: key
					}
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
