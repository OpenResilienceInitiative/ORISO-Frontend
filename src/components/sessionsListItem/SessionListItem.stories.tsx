import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { MenuVerticalIcon } from '../../resources/img/icons';
import oneOnOneImage from '../../resources/img/illustrations/one-on-one.svg';
import teamImage from '../../resources/img/illustrations/Team.svg';
import './sessionsListItem.styles.scss';

const listShell: React.CSSProperties = {
	backgroundColor: '#f5f5f5',
	maxWidth: 440,
	margin: '0 auto',
	padding: '4px 8px'
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

/** Mirrors consultant 1:1 row layout (topic + PLZ, menu pill, 1-1 meta). */
function ConsultantCardMock({
	active = false,
	beforeActive = false,
	afterActive = false
}: {
	active?: boolean;
	beforeActive?: boolean;
	afterActive?: boolean;
}) {
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
			<div className="sessionsListItem__content" role="presentation">
				<div className="sessionsListItem__row">
					<div className="sessionsListItem__rowLeft">
						<div className="sessionsListItem__topicPostcodeGroup">
							<div className="sessionsListItem__topic">
								Familienberatung
							</div>
							<div className="sessionsListItem__postcode">
								12345
							</div>
						</div>
					</div>
					<div className="sessionsListItem__rowRight">
						<div className="sessionsListItem__date">18.3.2026</div>
						<div
							className="sessionsListItem__menuIcon"
							onClick={(e) => e.preventDefault()}
							role="button"
							tabIndex={0}
							aria-label="Menu"
						>
							<MenuVerticalIcon />
						</div>
					</div>
				</div>
				<div className="sessionsListItem__row">
					<MockAvatar letter="S" bg="#e8b4f0" />
					<div className="sessionsListItem__username">
						testuser@example.invalid
					</div>
				</div>
				<div className="sessionsListItem__row">
					<div className="sessionsListItem__subject sessionsListItem__subject--aliasMessage">
						<em>So geht es weiter</em>
					</div>
					<div className="sessionsListItem__consultingTypeIcon">
						<img
							src={oneOnOneImage}
							alt=""
							width={38}
							height={38}
						/>
					</div>
				</div>
			</div>
		</div>
	);
}

/** Group-style top row (topic chip only) + team meta. */
function GroupCardMock({
	active = false,
	beforeActive = false,
	afterActive = false
}: {
	active?: boolean;
	beforeActive?: boolean;
	afterActive?: boolean;
}) {
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
						<div className="sessionsListItem__topic">
							kein Thema gewählt
						</div>
						<div className="sessionsListItem__consultingType" />
					</div>
					<div className="sessionsListItem__rowRight">
						<div className="sessionsListItem__date">17.3.2026</div>
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
					<MockAvatar letter="N" bg="#c8e6c9" />
					<div className="sessionsListItem__username">
						New Redeploy
					</div>
				</div>
				<div className="sessionsListItem__row">
					<div className="sessionsListItem__subject">
						Sie haben den Chat erstellt.
					</div>
					<div className="sessionsListItem__consultingTypeIcon">
						<img
							src={teamImage}
							alt=""
							className="sessionsListItem__consultingTypeIcon--team"
						/>
					</div>
				</div>
			</div>
		</div>
	);
}

/** Postcode only (no topic) — standalone PLZ pill. */
function PostcodeOnlyCardMock() {
	return (
		<div className="sessionsListItem">
			<div className="sessionsListItem__content">
				<div className="sessionsListItem__row">
					<div className="sessionsListItem__rowLeft">
						<div className="sessionsListItem__consultingType">
							<div className="sessionsListItem__postcode sessionsListItem__postcode--standalone">
								99322
							</div>
						</div>
					</div>
					<div className="sessionsListItem__rowRight">
						<div className="sessionsListItem__date">1.4.2026</div>
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
					<MockAvatar letter="O" bg="#90caf9" />
					<div className="sessionsListItem__username">
						user@example.org
					</div>
				</div>
				<div className="sessionsListItem__row">
					<div className="sessionsListItem__subject">
						Letzte Nachricht …
					</div>
					<div className="sessionsListItem__consultingTypeIcon">
						<img
							src={oneOnOneImage}
							alt=""
							width={38}
							height={38}
						/>
					</div>
				</div>
			</div>
		</div>
	);
}

const meta = {
	title: 'Components/Session/List/SessionListItem',
	tags: ['autodocs'],
	parameters: {
		layout: 'fullscreen',
		backgrounds: { default: 'gray' },
		docs: {
			description: {
				component:
					'**Visual reference** for session list rows using the same BEM classes as `SessionListItemComponent` (`sessionsListItem.styles.scss`). The real list item depends on many data providers; these mocks document layout, chips (#646D78 topic, PLZ strip #FFD1D1), menu pill, selected white card + red border, and list shell #f5f5f5.'
			}
		}
	}
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const ConsultantUnselected: Story = {
	render: () => (
		<div style={listShell}>
			<ConsultantCardMock />
		</div>
	)
};

export const ConsultantSelected: Story = {
	render: () => (
		<div style={listShell}>
			<ConsultantCardMock active />
		</div>
	)
};

/** Middle card selected with stacked neighbours (no extra gap). */
export const StackedListWithSelection: Story = {
	render: () => (
		<div style={listShell}>
			<GroupCardMock beforeActive />
			<ConsultantCardMock active />
			<GroupCardMock afterActive />
		</div>
	)
};

export const GroupChatRow: Story = {
	render: () => (
		<div style={listShell}>
			<GroupCardMock />
		</div>
	)
};

export const PostcodeOnly: Story = {
	render: () => (
		<div style={listShell}>
			<PostcodeOnlyCardMock />
		</div>
	)
};
