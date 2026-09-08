import * as React from 'react';
import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { useTranslation } from 'react-i18next';
import { SessionsListToolbar } from './SessionsListToolbar';
import type { SessionSearchPersonResult } from './SessionsListToolbar';
import {
	sessionMatchesToolbar,
	type SessionToolbarChipFilter
} from './sessionToolbarFilters';
import { buildExtendedSession } from '../../globalState/helpers/stateHelpers';
import type { ListItemInterface } from '../../globalState/interfaces/SessionsDataInterface';
import { phone390Globals } from '../message/messageStoryShell';
import {
	APP_ORISO_CHAT_FIGMA_URL,
	ORISO_M3_FIGMA_URL
} from '../storybookDesignLinks';
import './sessionsList.styles.scss';

const shell: React.CSSProperties = {
	backgroundColor: '#eae7e8',
	padding: 16,
	maxWidth: 520,
	margin: '0 auto'
};

type ToolbarDemoProps = {
	showConsultantActions?: boolean;
	showSupervisionChip?: boolean;
	initialChip?: SessionToolbarChipFilter | null;
	archiveTabActive?: boolean;
	createGroupChatActive?: boolean;
	initialSearch?: string;
	initialSelectedPersonIds?: string[];
};

const searchPeopleResults: SessionSearchPersonResult[] = [
	{
		id: 'sanftes-alpaka-kala',
		name: 'Sanftes Alpaka Kala',
		subtitle: 'Suchtprobleme',
		role: 'asker',
		avatarSeed: 'sanftes-alpaka-kala'
	},
	{
		id: 'ratsuchender-r3',
		name: 'Ratsuchender R3',
		subtitle: '1-1 Beratung',
		role: 'asker',
		avatarSeed: 'ratsuchender-r3'
	},
	{
		id: 'ruhiges-yak-kim',
		name: 'ruhiges Yak Kim',
		subtitle: 'Familienberatung',
		role: 'asker',
		avatarSeed: 'ruhiges-yak-kim'
	},
	{
		id: 'traeger-admins-caritas',
		name: 'Träger Admins Caritas',
		subtitle: 'Team Intern',
		role: 'consultant',
		avatarSeed: 'traeger-admins-caritas'
	}
];

function SessionsListToolbarPlayground({
	showConsultantActions = true,
	showSupervisionChip = true,
	initialChip = null,
	archiveTabActive = false,
	createGroupChatActive = false,
	initialSearch = '',
	initialSelectedPersonIds = []
}: ToolbarDemoProps) {
	const { t } = useTranslation();
	const [search, setSearch] = useState(initialSearch);
	const [activeChip, setActiveChip] =
		useState<SessionToolbarChipFilter | null>(initialChip);
	const [selectedPersonIds, setSelectedPersonIds] = useState<string[]>(
		initialSelectedPersonIds
	);
	const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);
	const [selectedTypeId, setSelectedTypeId] = useState<string | null>(null);
	const [archiveOnly, setArchiveOnly] = useState(false);

	return (
		<div style={shell}>
			<SessionsListToolbar
				translate={t}
				searchValue={search}
				onSearchChange={setSearch}
				searchPeopleResults={searchPeopleResults}
				selectedPersonIds={selectedPersonIds}
				onSelectedPersonIdsChange={setSelectedPersonIds}
				searchTopicResults={[
					{
						id: 'schulden',
						label: 'Schulden',
						subtitle: 'Mainz 30232'
					},
					{
						id: 'suchtberatung',
						label: 'Suchtberatung',
						subtitle: 'Mainz 30232'
					}
				]}
				selectedTopicId={selectedTopicId}
				onSelectedTopicIdChange={setSelectedTopicId}
				searchTypeResults={[
					{ id: 'oneToOne', label: '1-1 Beratung' },
					{ id: 'liveChat', label: 'Live Chat' },
					{ id: 'nearby', label: 'Mail' }
				]}
				selectedTypeId={selectedTypeId}
				onSelectedTypeIdChange={setSelectedTypeId}
				searchArchiveOnly={archiveOnly}
				onSearchArchiveOnlyChange={setArchiveOnly}
				onSearchConfirm={() => {}}
				activeChip={activeChip}
				onChipToggle={(chip) =>
					setActiveChip((prev) => (prev === chip ? null : chip))
				}
				showConsultantActions={showConsultantActions}
				showCreateGroupChatAction={showConsultantActions}
				showSupervisionChip={showSupervisionChip}
				showLiveChatChip
				createGroupChatPath="/sessions/consultant/sessionView/createGroupChat"
				archiveTabPath="/sessions/consultant/sessionView?sessionListTab=archive"
				archiveTabActive={archiveTabActive}
				createGroupChatActive={createGroupChatActive}
				chipCounts={{
					unread: 4,
					drafts: 2,
					liveChat: 1,
					supervision: 1,
					groups: 3
				}}
			/>
		</div>
	);
}

const meta: Meta = {
	title: 'Components/Session/List/SessionsListToolbar',
	tags: ['autodocs'],
	parameters: {
		layout: 'fullscreen',
		backgrounds: { default: 'gray' },
		design: [
			{
				type: 'figma',
				name: 'App.Oriso consultant chat',
				url: APP_ORISO_CHAT_FIGMA_URL
			},
			{
				type: 'figma',
				name: 'Design System M3 ORISO',
				url: ORISO_M3_FIGMA_URL
			}
		],
		docs: {
			description: {
				component:
					'Consultant **MY_SESSION** list toolbar: kebab + search field and horizontal filter chips (create, archive, unread, drafts, internal group chat, supervision, conversation circle). Styling lives in `sessionsList.styles.scss` (`.sessionsListToolbar`). Uses React Router `Link` for create/archive; chips are stateful toggle buttons.'
			}
		}
	}
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
	render: () => <SessionsListToolbarPlayground />
};

function ToolbarWithSearchPreset() {
	const { t } = useTranslation();
	const [search, setSearch] = useState('Familie');
	const [activeChip, setActiveChip] =
		useState<SessionToolbarChipFilter | null>(null);
	return (
		<div style={shell}>
			<SessionsListToolbar
				translate={t}
				searchValue={search}
				onSearchChange={setSearch}
				activeChip={activeChip}
				onChipToggle={(chip) =>
					setActiveChip((p) => (p === chip ? null : chip))
				}
				showConsultantActions
				showCreateGroupChatAction
				showSupervisionChip
				createGroupChatPath="/sessions/consultant/sessionView/createGroupChat"
				archiveTabPath="/sessions/consultant/sessionView?sessionListTab=archive"
				archiveTabActive={false}
				createGroupChatActive={false}
			/>
		</div>
	);
}

export const WithSearchText: Story = {
	render: () => <ToolbarWithSearchPreset />
};

export const SearchPanelOpen: Story = {
	render: () => <SessionsListToolbarPlayground initialSearch="Ratsuch" />,
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await userEvent.click(canvas.getByRole('searchbox'));
	}
};

export const SearchWithSelectedPeople: Story = {
	render: () => (
		<SessionsListToolbarPlayground
			initialSelectedPersonIds={[
				'sanftes-alpaka-kala',
				'ruhiges-yak-kim'
			]}
		/>
	)
};

export const DraftsFilterActive: Story = {
	render: () => <SessionsListToolbarPlayground initialChip="drafts" />
};

export const UnreadFilterActive: Story = {
	render: () => <SessionsListToolbarPlayground initialChip="unread" />
};

export const OneToOneFilterActive: Story = {
	render: () => <SessionsListToolbarPlayground initialChip="nearby" />
};

export const GroupsFilterActive: Story = {
	render: () => <SessionsListToolbarPlayground initialChip="groups" />
};

export const InternalGroupFilterActive: Story = {
	parameters: {
		docs: {
			description: {
				story: 'Shows the toolbar with the internal group chat filter chip selected.'
			}
		}
	},
	render: () => <SessionsListToolbarPlayground initialChip="internalGroup" />
};

export const SupervisionFilterActive: Story = {
	parameters: {
		docs: {
			description: {
				story: 'Shows the toolbar with the supervision filter chip selected.'
			}
		}
	},
	render: () => <SessionsListToolbarPlayground initialChip="supervision" />
};

export const ArchiveRouteActive: Story = {
	render: () => (
		<SessionsListToolbarPlayground
			archiveTabActive
			showSupervisionChip={false}
		/>
	)
};

export const CreateGroupChatRouteActive: Story = {
	render: () => <SessionsListToolbarPlayground createGroupChatActive />
};

/** No + / archive links; calendar + filters only (asker-style strip). */
export const NoConsultantActions: Story = {
	render: () => (
		<SessionsListToolbarPlayground
			showConsultantActions={false}
			showSupervisionChip={false}
		/>
	)
};

/* ---------------------------------------------------------------------------
 * The supervision chip as a **filter** (ADR-008 list marker).
 *
 * `SupervisionFilterActive` above shows the chip in its selected state and
 * nothing else. What the chip now does — keep the rows the backend marks as
 * `supervision.supervisedByMe` and drop everything else, including rows owned
 * by another counsellor that somebody *else* supervises — had only a unit test
 * (`sessionToolbarSupervisionChip.test.ts`) and no story at all.
 *
 * These stories run the toolbar against `sessionMatchesToolbar`, the same
 * selector `SessionsList.tsx` filters with, over fixtures built by the real
 * `buildExtendedSession`. The row strip below the toolbar is a deliberately
 * plain stand-in for the session list — the subject here is the chip → filter
 * wiring, not the list item's own presentation, which has its own stories.
 * ------------------------------------------------------------------------- */

const SUPERVISION_VIEWER_ID = 'consultant-me';
const OTHER_COUNSELLOR_ID = 'consultant-kim';
const OTHER_SUPERVISOR_ID = 'consultant-angela';

type SupervisionRowFixture = {
	name: string;
	note: string;
	raw: ListItemInterface;
};

const supervisionRow = (
	id: number,
	name: string,
	note: string,
	consultantId: string,
	supervision?: {
		supervisedByMe?: boolean;
		supervisorConsultantIds?: string[];
		supervisorDisplayNames?: string[];
	}
): SupervisionRowFixture => ({
	name,
	note,
	raw: {
		consultant: { id: consultantId } as ListItemInterface['consultant'],
		user: { username: name } as ListItemInterface['user'],
		session: {
			id,
			matrixRoomId: `!supervision-demo-${id}:oriso.org`,
			messagesRead: true,
			conversationType: 'AGENCY_COUNSELLING',
			...(supervision ? { supervision } : {})
		} as unknown as ListItemInterface['session']
	}
});

/**
 * Four rows, and only two of them are mine to supervise. The third is the one
 * that matters: another counsellor owns it and somebody else supervises it —
 * the old pre-marker heuristic ("any row owned by another counsellor") counted
 * exactly this row in, which is the regression these stories pin.
 */
const supervisionRows: SupervisionRowFixture[] = [
	supervisionRow(
		101,
		'Sanftes Alpaka Kala',
		'Ich supervidiere diesen Fall',
		OTHER_COUNSELLOR_ID,
		{
			supervisedByMe: true,
			supervisorConsultantIds: [SUPERVISION_VIEWER_ID],
			supervisorDisplayNames: ['Karina P']
		}
	),
	supervisionRow(
		102,
		'Ruhiges Yak Kim',
		'Ich supervidiere diesen Fall',
		OTHER_COUNSELLOR_ID,
		{
			supervisedByMe: true,
			supervisorConsultantIds: [SUPERVISION_VIEWER_ID],
			supervisorDisplayNames: ['Karina P']
		}
	),
	supervisionRow(
		103,
		'Freundlicher Igel Toni',
		'Andere Person supervidiert',
		OTHER_COUNSELLOR_ID,
		{
			supervisedByMe: false,
			supervisorConsultantIds: [OTHER_SUPERVISOR_ID],
			supervisorDisplayNames: ['Angela K']
		}
	),
	supervisionRow(
		104,
		'Mutiges Reh Nala',
		'Mein eigener Fall',
		SUPERVISION_VIEWER_ID,
		{
			supervisedByMe: false,
			supervisorConsultantIds: [],
			supervisorDisplayNames: []
		}
	)
];

const matchesSupervisionChip = (
	row: SupervisionRowFixture,
	chip: SessionToolbarChipFilter | null
) =>
	sessionMatchesToolbar(
		row.raw,
		buildExtendedSession(row.raw),
		'',
		chip,
		[],
		[],
		SUPERVISION_VIEWER_ID
	);

const SUPERVISED_BY_ME_COUNT = supervisionRows.filter((row) =>
	matchesSupervisionChip(row, 'supervision')
).length;

function SupervisionChipFilterDemo({
	initialChip = null
}: {
	initialChip?: SessionToolbarChipFilter | null;
}) {
	const { t } = useTranslation();
	const [activeChip, setActiveChip] =
		useState<SessionToolbarChipFilter | null>(initialChip);
	const visibleRows = supervisionRows.filter((row) =>
		matchesSupervisionChip(row, activeChip)
	);

	return (
		<div style={shell}>
			<SessionsListToolbar
				translate={t}
				searchValue=""
				onSearchChange={() => {}}
				activeChip={activeChip}
				onChipToggle={(chip) =>
					setActiveChip((prev) => (prev === chip ? null : chip))
				}
				showConsultantActions
				showCreateGroupChatAction
				showSupervisionChip
				createGroupChatPath="/sessions/consultant/sessionView/createGroupChat"
				archiveTabPath="/sessions/consultant/sessionView?sessionListTab=archive"
				archiveTabActive={false}
				createGroupChatActive={false}
				chipCounts={{ supervision: SUPERVISED_BY_ME_COUNT }}
			/>
			<ul
				data-cy="supervision-filter-demo-list"
				style={{
					listStyle: 'none',
					margin: '12px 0 0',
					padding: 0,
					display: 'flex',
					flexDirection: 'column',
					gap: 8
				}}
			>
				{visibleRows.map((row) => (
					<li
						key={row.name}
						data-cy="supervision-filter-demo-row"
						style={{
							background: '#ffffff',
							borderRadius: 8,
							padding: '10px 12px'
						}}
					>
						<strong style={{ display: 'block' }}>{row.name}</strong>
						<span style={{ color: '#5b5b5b' }}>{row.note}</span>
					</li>
				))}
			</ul>
		</div>
	);
}

const demoRowNames = (canvasElement: HTMLElement) =>
	Array.from(
		canvasElement.querySelectorAll(
			'[data-cy="supervision-filter-demo-row"] strong'
		)
	).map((element) => element.textContent);

const supervisionChipButton = (canvasElement: HTMLElement) =>
	canvasElement.querySelector<HTMLButtonElement>(
		'[data-cy="sessions-list-chip-supervision"]'
	)!;

export const SupervisionChipNoFilter: Story = {
	name: 'Supervision chip — no filter active (every row)',
	parameters: {
		docs: {
			description: {
				story: 'Nothing selected: all four rows stay. The chip already carries its count, so the number of supervised conversations is readable before anyone filters.'
			}
		}
	},
	render: () => <SupervisionChipFilterDemo />,
	play: async ({ canvasElement }) => {
		await expect(demoRowNames(canvasElement).length).toBe(
			supervisionRows.length
		);
		await expect(
			supervisionChipButton(canvasElement).getAttribute('aria-pressed')
		).toBe('false');
	}
};

export const SupervisionChipFiltersList: Story = {
	name: 'Supervision chip — active, keeps only supervisedByMe rows',
	parameters: {
		docs: {
			description: {
				story: 'Pressing the chip filters through `sessionMatchesToolbar`. Only the rows the backend marks `supervision.supervisedByMe` survive — "Freundlicher Igel Toni" is owned by another counsellor **and** supervised by someone else, so it drops out. That row is the whole difference between the marker and the old heuristic.'
			}
		}
	},
	render: () => <SupervisionChipFilterDemo />,
	play: async ({ canvasElement }) => {
		const chip = supervisionChipButton(canvasElement);
		await expect(demoRowNames(canvasElement).length).toBe(4);

		await userEvent.click(chip);

		await waitFor(() =>
			expect(chip.getAttribute('aria-pressed')).toBe('true')
		);
		await waitFor(() =>
			expect(demoRowNames(canvasElement)).toEqual([
				'Sanftes Alpaka Kala',
				'Ruhiges Yak Kim'
			])
		);

		// Pressing it again releases the filter — the chip is a toggle.
		await userEvent.click(chip);
		await waitFor(() => expect(demoRowNames(canvasElement).length).toBe(4));
	}
};

export const SupervisionChipWithCount: Story = {
	name: 'Supervision chip — active with hit count',
	parameters: {
		docs: {
			description: {
				story: 'The count badge and the filtered list are the same number, computed from the same selector — a badge that drifts from what the filter returns is worse than no badge.'
			}
		}
	},
	render: () => <SupervisionChipFilterDemo initialChip="supervision" />,
	play: async ({ canvasElement }) => {
		const badge = supervisionChipButton(canvasElement).querySelector(
			'.sessionsListToolbar__chipBadge'
		);
		await expect(badge?.textContent).toBe(String(SUPERVISED_BY_ME_COUNT));
		await expect(demoRowNames(canvasElement).length).toBe(
			SUPERVISED_BY_ME_COUNT
		);
	}
};

export const SupervisionChipMobile390: Story = {
	name: 'Supervision chip — active, phone 390',
	globals: phone390Globals,
	parameters: {
		docs: {
			description: {
				story: 'The chip strip scrolls horizontally on a phone. The selected supervision chip keeps its label and badge at 390px instead of collapsing to the icon-only form the unselected chips use.'
			}
		}
	},
	render: () => <SupervisionChipFilterDemo initialChip="supervision" />,
	play: async ({ canvasElement }) => {
		const chip = supervisionChipButton(canvasElement);
		await expect(chip.getAttribute('aria-pressed')).toBe('true');
		await expect(chip.className).not.toContain(
			'sessionsListToolbar__chip--iconOnly'
		);
		const label = chip.querySelector<HTMLElement>(
			'.sessionsListToolbar__chipLabel'
		)!;
		await waitFor(() =>
			expect(label.getBoundingClientRect().width).toBeGreaterThan(0)
		);
		await expect(demoRowNames(canvasElement).length).toBe(
			SUPERVISED_BY_ME_COUNT
		);
	}
};
