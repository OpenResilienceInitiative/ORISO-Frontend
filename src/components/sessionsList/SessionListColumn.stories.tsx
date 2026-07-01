import * as React from 'react';
import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { useTranslation } from 'react-i18next';
import { SessionsListToolbar } from './SessionsListToolbar';
import type { SessionToolbarChipFilter } from './sessionToolbarFilters';
import { SessionListCreateChat } from './SessionListCreateChat';
import { MenuVerticalIcon } from '../../resources/img/icons';
import oneOnOneImage from '../../resources/img/illustrations/one-on-one.svg';
import teamImage from '../../resources/img/illustrations/Team.svg';
import './sessionsList.styles.scss';
import '../sessionsListItem/sessionsListItem.styles.scss';

const APP_ORISO_CHAT_FIGMA_URL =
	'https://www.figma.com/design/L2mOFNSGdxPPx1XA4HFAog/App.Oriso?node-id=316-17725&t=XHH5HQNmA8DUWl2U-0';
const ORISO_M3_FIGMA_URL =
	'https://www.figma.com/design/RTUi1rcrEWECXz8rNFmj7Q/Design-System-M3_ORISO?node-id=60853-24182&p=f&t=ieIskw4Lz5hlc7iM-0';

const column: React.CSSProperties = {
	backgroundColor: '#eae7e8',
	maxWidth: 420,
	minHeight: 560,
	margin: '0 auto',
	padding: '8px 0',
	position: 'relative'
};

function MockAvatar({ letter, bg }: { letter: string; bg: string }) {
	return (
		<div className="sessionsListItem__icon">
			<div
				style={{
					width: 32,
					height: 32,
					borderRadius: '50%',
					background: bg,
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'center',
					fontWeight: 600,
					fontSize: 14,
					color: '#333'
				}}
			>
				{letter}
			</div>
		</div>
	);
}

function DemoCard({
	active,
	topic,
	postcode,
	user,
	subject,
	team
}: {
	active?: boolean;
	topic: string;
	postcode?: string;
	user: string;
	subject: string;
	team?: boolean;
}) {
	return (
		<div
			className={`sessionsListItem${active ? ' sessionsListItem--active' : ''}`}
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
						<div
							className="sessionsListItem__menuIcon"
							role="button"
							tabIndex={0}
							aria-label="Menu"
						>
							<MenuVerticalIcon />
						</div>
					</div>
				</div>
				<div className="sessionsListItem__row">
					<MockAvatar letter={user[0].toUpperCase()} bg="#e8b4f0" />
					<div className="sessionsListItem__username">{user}</div>
				</div>
				<div className="sessionsListItem__row">
					<div className="sessionsListItem__subject">{subject}</div>
					<div className="sessionsListItem__consultingTypeIcon">
						{team ? (
							<img
								src={teamImage}
								alt=""
								className="sessionsListItem__consultingTypeIcon--team"
							/>
						) : (
							<img
								src={oneOnOneImage}
								alt=""
								width={38}
								height={38}
							/>
						)}
					</div>
				</div>
			</div>
		</div>
	);
}

function FullColumnPlayground() {
	const { t } = useTranslation();
	const [search, setSearch] = useState('');
	const [chip, setChip] = useState<SessionToolbarChipFilter | null>('groups');

	return (
		<div style={column}>
			<div style={{ padding: '0 8px' }}>
				<SessionsListToolbar
					translate={t}
					searchValue={search}
					onSearchChange={setSearch}
					activeChip={chip}
					onChipToggle={(c) => setChip((p) => (p === c ? null : c))}
					showConsultantActions
					showSupervisionChip
					createGroupChatPath="/sessions/consultant/sessionView/createGroupChat"
					archiveTabPath="/sessions/consultant/sessionView?sessionListTab=archive"
					archiveTabActive={false}
					createGroupChatActive={false}
				/>
			</div>
			<DemoCard
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
				topic="Suchtberatung"
				postcode="80331"
				user="max.mustermann"
				subject="Letzte Nachricht Vorschau"
			/>
		</div>
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
					'**Composite:** toolbar + sample cards on **#eae7e8** (same shell as production). Useful for visual regression and stakeholder review. Does not include `ResizableHandle` or real data providers.'
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
		<div style={column}>
			<div style={{ padding: '0 8px' }}>
				<SessionsListToolbar
					translate={t}
					searchValue={search}
					onSearchChange={setSearch}
					activeChip={null}
					onChipToggle={() => {}}
					showConsultantActions
					showSupervisionChip={false}
					createGroupChatPath="/sessions/consultant/sessionView/createGroupChat"
					archiveTabPath="/sessions/consultant/sessionView?sessionListTab=archive"
					archiveTabActive={false}
					createGroupChatActive
				/>
			</div>
			<SessionListCreateChat />
			<DemoCard
				topic="Familienberatung"
				postcode="10115"
				user="other.user"
				subject="…"
			/>
		</div>
	);
}

export const ToolbarCreateChatAndCards: Story = {
	render: () => <ToolbarCreateChatColumn />
};
