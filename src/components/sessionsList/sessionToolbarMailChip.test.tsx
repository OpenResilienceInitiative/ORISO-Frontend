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
 *
 * Also guards two follow-up regressions from PR #987 review:
 * - the orphan `chips.chats` alias key (only ever consumed as a URL alias in
 *   `normalizeSessionToolbarChip`, never as a label) must stay deleted, so it
 *   can never resurface as a second chip labelled "Mail";
 * - no two rendered toolbar chips may ever carry the same visible label.
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
import frCommon from '../../resources/i18n/fr/common.json';
import ruCommon from '../../resources/i18n/ru/common.json';
import tiCommon from '../../resources/i18n/ti/common.json';
import trCommon from '../../resources/i18n/tr/common.json';

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
	['en', enCommon as typeof deCommon],
	['fr', frCommon as typeof deCommon],
	['ru', ruCommon as typeof deCommon],
	['ti', tiCommon as typeof deCommon],
	['tr', trCommon as typeof deCommon]
];

/** Resolve dotted i18n keys against a raw catalogue, echoing unknown keys. */
const catalogueTranslate =
	(catalogue: typeof deCommon) =>
	(key: string): string => {
		const value = key
			.split('.')
			.reduce<unknown>(
				(node, part) =>
					node && typeof node === 'object'
						? (node as Record<string, unknown>)[part]
						: undefined,
				catalogue
			);
		return typeof value === 'string' ? value : key;
	};

/** Render the toolbar with every chip visible and return data-cy → label. */
const renderAllChips = (catalogue: typeof deCommon) => {
	const { container } = render(
		<MemoryRouter>
			<SessionsListToolbar
				translate={catalogueTranslate(catalogue)}
				searchValue=""
				onSearchChange={vi.fn()}
				activeChip={null}
				onChipToggle={vi.fn()}
				showConsultantActions
				showCreateGroupChatAction
				showSupervisionChip
				showLiveChatChip
				showGroupChip
				showInternalGroupChip
				createGroupChatPath="/sessions/create"
				archiveTabPath="/sessions/archive"
				archiveTabActive={false}
				createGroupChatActive={false}
			/>
		</MemoryRouter>
	);

	const labels: Record<string, string> = {};
	container
		.querySelectorAll('[data-cy^="sessions-list-chip-"]')
		.forEach((chip) => {
			labels[chip.getAttribute('data-cy')!] =
				chip.querySelector('.sessionsListToolbar__chipLabel')
					?.textContent ?? '';
		});
	return labels;
};

describe('"Mail" modality label (#985)', () => {
	it.each(CATALOGUES)(
		'labels the nearby chip "Mail" in %s',
		(_, catalogue) => {
			expect(catalogue.sessionList.toolbar.chips.nearby).toBe('Mail');
		}
	);

	it.each(CATALOGUES)(
		'keeps the orphan "chats" alias key out of %s',
		(_, catalogue) => {
			// `chats` is only a URL alias (normalizeSessionToolbarChip); as a
			// catalogue entry it once duplicated the "Mail" label (#987 review).
			expect(catalogue.sessionList.toolbar.chips).not.toHaveProperty(
				'chats'
			);
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

describe('toolbar chip labels stay distinct (#987 review)', () => {
	it.each(CATALOGUES)(
		'no two rendered chips share a label in %s',
		(_, catalogue) => {
			const labels = Object.values(renderAllChips(catalogue));

			expect(labels.length).toBeGreaterThan(0);
			expect(new Set(labels).size).toBe(labels.length);
		}
	);

	it('pins the intended label of every chip in de', () => {
		expect(renderAllChips(deCommon)).toEqual({
			'sessions-list-chip-create': 'Erstellen',
			'sessions-list-chip-unread': 'Ungelesen',
			'sessions-list-chip-drafts': 'Entwürfe',
			'sessions-list-chip-nearby': 'Mail',
			'sessions-list-chip-live-chat': 'Live-Chat',
			'sessions-list-chip-internal-group': 'Interner Gruppenchat',
			'sessions-list-chip-supervision': 'Supervision',
			'sessions-list-chip-groups': 'Gesprächskreis',
			'sessions-list-chip-archive': 'Archiviert'
		});
	});

	it('pins the intended label of every chip in en', () => {
		expect(renderAllChips(enCommon as typeof deCommon)).toEqual({
			'sessions-list-chip-create': 'Create',
			'sessions-list-chip-unread': 'Unread',
			'sessions-list-chip-drafts': 'Drafts',
			'sessions-list-chip-nearby': 'Mail',
			'sessions-list-chip-live-chat': 'Live chat',
			'sessions-list-chip-internal-group': 'Internal group chat',
			'sessions-list-chip-supervision': 'Supervision',
			'sessions-list-chip-groups': 'Conversation circle',
			'sessions-list-chip-archive': 'Archived'
		});
	});
});
