import * as React from 'react';
import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { userEvent, within } from 'storybook/test';
import { useTranslation } from 'react-i18next';
import { SessionsListToolbar } from './SessionsListToolbar';
import type { SessionSearchPersonResult } from './SessionsListToolbar';
import type { SessionToolbarChipFilter } from './sessionToolbarFilters';
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
		subtitle: 'Suchtprobleme'
	},
	{
		id: 'ratsuchender-r3',
		name: 'Ratsuchender R3',
		subtitle: '1-1 Beratung'
	},
	{
		id: 'ruhiges-yak-kim',
		name: 'ruhiges Yak Kim',
		subtitle: 'Familienberatung'
	},
	{
		id: 'traeger-admins-caritas',
		name: 'Träger Admins Caritas',
		subtitle: 'Team Intern'
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

	return (
		<div style={shell}>
			<SessionsListToolbar
				translate={t}
				searchValue={search}
				onSearchChange={setSearch}
				searchPeopleResults={searchPeopleResults}
				selectedPersonIds={selectedPersonIds}
				onSelectedPersonIdsChange={setSelectedPersonIds}
				activeChip={activeChip}
				onChipToggle={(chip) =>
					setActiveChip((prev) => (prev === chip ? null : chip))
				}
				showConsultantActions={showConsultantActions}
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

const meta = {
	title: 'Components/Session/List/SessionsListToolbar',
	tags: ['autodocs'],
	parameters: {
		layout: 'fullscreen',
		backgrounds: { default: 'gray' },
		docs: {
			description: {
				component:
					'Consultant **MY_SESSION** list toolbar: kebab + search field and horizontal filter chips (create, archive, unread, drafts, internal group chat, supervision, conversation circle). Styling lives in `sessionsList.styles.scss` (`.sessionsListToolbar`). Uses React Router `Link` for create/archive; chips are stateful toggle buttons.'
			}
		}
	}
} satisfies Meta;

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
