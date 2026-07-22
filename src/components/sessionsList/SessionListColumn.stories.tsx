import * as React from 'react';
import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { useTranslation } from 'react-i18next';
import { SessionsListToolbar } from './SessionsListToolbar';
import type { SessionToolbarChipFilter } from './sessionToolbarFilters';
import { SessionListCreateChat } from './SessionListCreateChat';
import { EmptyState } from '../emptyState/EmptyState';
import { MenuVerticalIcon } from '../../resources/img/icons';
import { MessageAvatar } from '../message/MessageAvatar';
import { formatMessagePersonName } from '../message/messageNameUtils';
import teamImage from '../../resources/img/illustrations/Team.svg';
import nearbyConversationIcon from '../../resources/img/icons/chatroom/nearby_conv_type_200.svg';
import './sessionsList.styles.scss';
import '../sessionsListItem/sessionsListItem.styles.scss';

const APP_ORISO_CHAT_FIGMA_URL =
	'https://www.figma.com/design/L2mOFNSGdxPPx1XA4HFAog/App.Oriso?node-id=316-17725&t=XHH5HQNmA8DUWl2U-0';
const ORISO_M3_FIGMA_URL =
	'https://www.figma.com/design/RTUi1rcrEWECXz8rNFmj7Q/Design-System-M3_ORISO?node-id=60853-24182&p=f&t=ieIskw4Lz5hlc7iM-0';

/** Story shell only — no spacing/radius overrides; production classes own layout. */
const columnShell: React.CSSProperties = {
	maxWidth: 420,
	minHeight: 560,
	margin: '0 auto',
	position: 'relative'
};

function DemoCard({
	active = false,
	beforeActive = false,
	afterActive = false,
	topic,
	postcode,
	user,
	subject,
	team = false
}: {
	active?: boolean;
	beforeActive?: boolean;
	afterActive?: boolean;
	topic: string;
	postcode?: string;
	user: string;
	subject: string;
	team?: boolean;
}) {
	const displayName = formatMessagePersonName(undefined, user);

	return (
		<div
			className={[
				'sessionsListItem',
				active && 'sessionsListItem--active',
				beforeActive && 'sessionsListItem--beforeActive',
				afterActive && 'sessionsListItem--afterActive'
			]
				.filter(Boolean)
				.join(' ')}
		>
			<div className="sessionsListItem__content">
				<div className="sessionsListItem__row">
					<div className="sessionsListItem__rowLeft">
						{postcode !== undefined ? (
							<div className="sessionsListItem__topicPostcodeGroup">
								<div className="sessionsListItem__topic">
									{topic}
								</div>
								<div className="sessionsListItem__postcode">
									{postcode}
								</div>
							</div>
						) : (
							<>
								<div className="sessionsListItem__topic">
									{topic}
								</div>
								<div className="sessionsListItem__consultingType" />
							</>
						)}
					</div>
					<div className="sessionsListItem__rowRight">
						<div className="sessionsListItem__date">18.3.2026</div>
						<button
							type="button"
							className="sessionsListItem__menuIcon"
							aria-label="Chatraum Einstellungen"
						>
							<MenuVerticalIcon />
						</button>
					</div>
				</div>
				<div className="sessionsListItem__row">
					<div className="sessionsListItem__icon">
						<MessageAvatar
							isGroup={team}
							isSystemNotification={false}
							userId={user}
							username={user}
							displayName={displayName}
							size={32}
						/>
					</div>
					<div className="sessionsListItem__username">
						{displayName}
					</div>
				</div>
				<div className="sessionsListItem__row">
					<div className="sessionsListItem__subject">{subject}</div>
					{team ? (
						<div className="sessionsListItem__consultingTypeIcon">
							<img
								src={teamImage}
								alt=""
								className="sessionsListItem__consultingTypeIcon--team"
							/>
						</div>
					) : (
						<div className="sessionsListItem__consultingTypeIcon sessionsListItem__consultingTypeIcon--nearby">
							<img
								src={nearbyConversationIcon}
								alt="Nähe"
								className="sessionsListItem__consultingTypeIcon--nearbyIcon"
							/>
							<span className="sessionsListItem__consultingTypeIcon--nearbyLabel">
								Nähe
							</span>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}

function ColumnShell({ children }: { children: React.ReactNode }) {
	return (
		<div className="sessionsList__wrapper" style={columnShell}>
			<div className="sessionsList__innerWrapper">{children}</div>
		</div>
	);
}

function CardScroll({ children }: { children: React.ReactNode }) {
	return (
		<div className="sessionsList__scrollArea">
			<div className="sessionsList__scrollContainer sessionsList__scrollContainer--hasToolbar">
				{children}
			</div>
		</div>
	);
}

function FullColumnPlayground() {
	const { t } = useTranslation();
	const [search, setSearch] = useState('');
	const [chip, setChip] = useState<SessionToolbarChipFilter | null>('groups');

	return (
		<ColumnShell>
			<SessionsListToolbar
				translate={t}
				searchValue={search}
				onSearchChange={setSearch}
				activeChip={chip}
				onChipToggle={(c) => setChip((p) => (p === c ? null : c))}
				showConsultantActions
				showCreateGroupChatAction
				showSupervisionChip
				createGroupChatPath="/sessions/consultant/sessionView/createGroupChat"
				archiveTabPath="/sessions/consultant/sessionView?sessionListTab=archive"
				archiveTabActive={false}
				createGroupChatActive={false}
			/>
			<CardScroll>
				<DemoCard
					beforeActive
					topic="kein Thema gewählt"
					user="Group Test"
					subject="Sie haben den Chat erstellt."
					team
				/>
				<DemoCard
					active
					topic="Familienberatung"
					postcode="12345"
					user="testuser@example.invalid"
					subject="So geht es weiter"
				/>
				<DemoCard
					afterActive
					topic="Suchtberatung"
					postcode="80331"
					user="max.mustermann"
					subject="Letzte Nachricht Vorschau"
				/>
			</CardScroll>
		</ColumnShell>
	);
}

const meta: Meta = {
	title: 'Components/Session/List/Session list column',
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
					'**Composite:** toolbar + sample cards using production `sessionsList*` / `sessionsListItem*` classes (6px active gap, 24px stacked corners, MessageAvatar username row). Does not include `ResizableHandle` or real data providers.'
			}
		}
	}
};

export default meta;
type Story = StoryObj<typeof meta>;

export const ToolbarAndCards: Story = {
	render: () => <FullColumnPlayground />
};

function ToolbarCreateChatColumn() {
	const { t } = useTranslation();
	const [search, setSearch] = useState('');
	return (
		<ColumnShell>
			<SessionsListToolbar
				translate={t}
				searchValue={search}
				onSearchChange={setSearch}
				activeChip={null}
				onChipToggle={() => {}}
				showConsultantActions
				showCreateGroupChatAction
				showSupervisionChip={false}
				createGroupChatPath="/sessions/consultant/sessionView/createGroupChat"
				archiveTabPath="/sessions/consultant/sessionView?sessionListTab=archive"
				archiveTabActive={false}
				createGroupChatActive
			/>
			<CardScroll>
				<SessionListCreateChat />
				<DemoCard
					afterActive
					topic="Familienberatung"
					postcode="10115"
					user="other.user"
					subject="…"
				/>
			</CardScroll>
		</ColumnShell>
	);
}

export const ToolbarCreateChatAndCards: Story = {
	render: () => <ToolbarCreateChatColumn />
};

/**
 * Empty column (Figma node 7108-45494). Verifies that the 1px white side
 * hairlines the stacked cards normally draw down the column edges are kept
 * when there are no conversations (`sessionsList__emptyState`).
 */
function EmptyColumn() {
	const { t } = useTranslation();
	const [search, setSearch] = useState('');
	return (
		<ColumnShell>
			<SessionsListToolbar
				translate={t}
				searchValue={search}
				onSearchChange={setSearch}
				activeChip={null}
				onChipToggle={() => {}}
				showConsultantActions
				showCreateGroupChatAction
				showSupervisionChip={false}
				createGroupChatPath="/sessions/consultant/sessionView/createGroupChat"
				archiveTabPath="/sessions/consultant/sessionView?sessionListTab=archive"
				archiveTabActive={false}
				createGroupChatActive={false}
			/>
			<EmptyState
				className="sessionsList__emptyState"
				headline="No conversations available"
				variant="no-conversations"
			/>
		</ColumnShell>
	);
}

export const EmptyWithSideHairlines: Story = {
	render: () => <EmptyColumn />
};
