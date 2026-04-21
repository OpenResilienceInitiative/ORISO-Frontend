import * as React from 'react';
import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { useTranslation } from 'react-i18next';
import {
	SessionsListToolbar,
	type SessionToolbarChipFilter
} from './SessionsListToolbar';
import './sessionsList.styles.scss';

const shell: React.CSSProperties = {
	backgroundColor: '#f5f5f5',
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
};

function SessionsListToolbarPlayground({
	showConsultantActions = true,
	showSupervisionChip = true,
	initialChip = null,
	archiveTabActive = false,
	createGroupChatActive = false
}: ToolbarDemoProps) {
	const { t } = useTranslation();
	const [search, setSearch] = useState('');
	const [activeChip, setActiveChip] =
		useState<SessionToolbarChipFilter | null>(initialChip);

	return (
		<div style={shell}>
			<SessionsListToolbar
				translate={t}
				searchValue={search}
				onSearchChange={setSearch}
				activeChip={activeChip}
				onChipToggle={(chip) =>
					setActiveChip((prev) => (prev === chip ? null : chip))
				}
				showConsultantActions={showConsultantActions}
				showSupervisionChip={showSupervisionChip}
				createGroupChatPath="/sessions/consultant/sessionView/createGroupChat"
				archiveTabPath="/sessions/consultant/sessionView?sessionListTab=archive"
				archiveTabActive={archiveTabActive}
				createGroupChatActive={createGroupChatActive}
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
					'Consultant **MY_SESSION** list toolbar: kebab + search field and horizontal filter chips (create, archive, calendar, groups icon, text filters, supervision). Styling lives in `sessionsList.styles.scss` (`.sessionsListToolbar`). Uses React Router `Link` for create/archive; chips are stateful toggle buttons.'
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

export const UnreadFilterActive: Story = {
	render: () => <SessionsListToolbarPlayground initialChip="neu" />
};

export const OneToOneFilterActive: Story = {
	render: () => <SessionsListToolbarPlayground initialChip="oneToOne" />
};

export const GroupsFilterActive: Story = {
	render: () => <SessionsListToolbarPlayground initialChip="groups" />
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
