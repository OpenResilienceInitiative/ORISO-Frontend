import * as React from 'react';
import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { useTranslation } from 'react-i18next';
import { expect, fireEvent, waitFor } from 'storybook/test';
import { SessionsListToolbar } from './SessionsListToolbar';
import { ResizableHandle } from './ResizableHandle';
import { SESSIONS_LIST_RESIZE } from './sessionsListResize.constants';
import { resolveStageLayout, STAGE_LAYOUT } from '../chatStage/stageLayout';
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
								alt="Mail"
								className="sessionsListItem__consultingTypeIcon--nearbyIcon"
							/>
							<span className="sessionsListItem__consultingTypeIcon--nearbyLabel">
								Mail
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
					'**Composite:** toolbar + sample cards using production `sessionsList*` / `sessionsListItem*` classes ' +
					'(6px active gap, 24px stacked corners, MessageAvatar username row, #597 selected `2px --m3-primary`). ' +
					'Does not include `ResizableHandle` or real data providers.'
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

/*
 * ---------------------------------------------------------------------------
 * D10 (Frank, 05.09.2026): while a side pane is open the list column snaps to
 * the 80 px icon rail, because a 1280 px screen cannot host a 420 px list plus
 * two 520 px chat panes. `SessionsListWrapper` wires it in three lines
 * (`resolveStageLayout` → width → the handle's `maxWidth`); until 07.09. the
 * behaviour was only visible in `Templates/ConsultantSessionStage` "(a)"/"(c)"
 * and in `SessionsListWrapper.railSnap.test.tsx`.
 *
 * These two stories drive the SAME pure rule and the SAME `ResizableHandle`
 * the wrapper uses. What they cannot show is the wrapper itself: `SessionsList`
 * pulls the session/consultant APIs, so a story of the wired column would sit
 * behind the "needs live data" panel. The wrapper's own guard therefore stays
 * covered by its unit test.
 * ---------------------------------------------------------------------------
 */

const RAIL_VIEWPORT = 1280;
const PERSISTED_LIST_WIDTH = 420;

function SnapDemo({ panelOpen }: { panelOpen: boolean }) {
	const { t } = useTranslation();
	const [dragged, setDragged] = useState<number | null>(null);
	// The three lines of `SessionsListWrapper`: ask the rule, take its width,
	// cap the handle with it.
	const layout = resolveStageLayout({
		viewportWidth: RAIL_VIEWPORT,
		listWidth: PERSISTED_LIST_WIDTH,
		panelWidth: STAGE_LAYOUT.MIN_PANE_WIDTH,
		panelOpen
	});
	const rail = layout.listMode === 'rail';
	const maxWidth = rail
		? STAGE_LAYOUT.RAIL_WIDTH
		: SESSIONS_LIST_RESIZE.EXPANDED_MAX_WIDTH;
	const width = dragged ?? layout.listWidth;
	return (
		<div style={{ display: 'flex', height: 420 }}>
			<div
				className={`sessionsList__wrapper${
					width < SESSIONS_LIST_RESIZE.ICON_ONLY_THRESHOLD
						? ' sessionsList__wrapper--iconOnly'
						: ''
				}`}
				// `.sessionsList__wrapper` carries `flex: 1`; the app's shell is
				// not a flex row, so the story pins the basis instead.
				style={{
					flex: '0 0 auto',
					width,
					position: 'relative',
					background: '#fff'
				}}
				data-cy="snap-column"
				data-list-mode={rail ? 'rail' : 'expanded'}
			>
				<SessionsListToolbar
					translate={t}
					searchValue=""
					onSearchChange={() => {}}
					activeChip={null}
					onChipToggle={() => {}}
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
						topic="Schuldnerberatung"
						postcode="55116"
						user="sonnenblume_47"
						subject="Mein Vertrag läuft im Oktober aus."
					/>
					<DemoCard
						topic="Suchtberatung"
						postcode="80331"
						user="stiller_fuchs_ali"
						subject="Ich habe die Unterlagen jetzt zusammen."
					/>
				</CardScroll>
				<ResizableHandle
					currentWidth={width}
					onResize={setDragged}
					maxWidth={maxWidth}
				/>
			</div>
			<div
				style={{
					flex: 1,
					margin: `0 ${STAGE_LAYOUT.CARD_MARGIN}px`,
					background: '#fff',
					borderRadius: 16,
					display: 'grid',
					placeItems: 'center',
					font: '13px system-ui'
				}}
			>
				<code data-testid="column-width">{width}px</code>
			</div>
		</div>
	);
}

/** Drag the handle 200 px to the right; return the width it settled at. */
const dragRight = async (canvasElement: HTMLElement, by: number) => {
	const handle = canvasElement.querySelector<HTMLElement>(
		'.sessionsList__resizeHandle'
	)!;
	const rect = handle.getBoundingClientRect();
	const at = {
		pointerId: 1,
		button: 0,
		clientX: rect.left + 12,
		clientY: rect.top + 40
	};
	await fireEvent.pointerDown(handle, at);
	await fireEvent.pointerMove(document, { ...at, clientX: at.clientX + by });
	await fireEvent.pointerUp(document, { ...at, clientX: at.clientX + by });
};

export const RailSnapWithPanelOpen: Story = {
	name: 'Side pane open — column snaps to the 80 px rail (D10)',
	render: () => <SnapDemo panelOpen />,
	play: async ({ canvasElement }) => {
		// The rule itself: 1280 − 420 leaves no room for two 520 px panes.
		const layout = resolveStageLayout({
			viewportWidth: RAIL_VIEWPORT,
			listWidth: PERSISTED_LIST_WIDTH,
			panelWidth: STAGE_LAYOUT.MIN_PANE_WIDTH,
			panelOpen: true
		});
		await expect(layout.listMode).toBe('rail');
		await expect(layout.listWidth).toBe(STAGE_LAYOUT.RAIL_WIDTH);
		// What the column does with it.
		const column = canvasElement.querySelector<HTMLElement>(
			'[data-cy="snap-column"]'
		)!;
		await expect(Math.round(column.getBoundingClientRect().width)).toBe(
			STAGE_LAYOUT.RAIL_WIDTH
		);
		await expect(column.classList).toContain(
			'sessionsList__wrapper--iconOnly'
		);
		// And dragging it wider is locked: the handle is capped at the rail.
		await dragRight(canvasElement, 200);
		await waitFor(() =>
			expect(
				canvasElement.querySelector('[data-testid="column-width"]')
					?.textContent
			).toBe(`${STAGE_LAYOUT.RAIL_WIDTH}px`)
		);
		await expect(Math.round(column.getBoundingClientRect().width)).toBe(
			STAGE_LAYOUT.RAIL_WIDTH
		);
	}
};

export const ExpandedWithPanelClosed: Story = {
	name: 'No side pane — column keeps its persisted width',
	render: () => <SnapDemo panelOpen={false} />,
	play: async ({ canvasElement }) => {
		const column = canvasElement.querySelector<HTMLElement>(
			'[data-cy="snap-column"]'
		)!;
		await expect(Math.round(column.getBoundingClientRect().width)).toBe(
			PERSISTED_LIST_WIDTH
		);
		await expect(column.classList).not.toContain(
			'sessionsList__wrapper--iconOnly'
		);
		// Here the handle may widen the column, up to the expanded maximum.
		await dragRight(canvasElement, 200);
		await waitFor(() =>
			expect(
				canvasElement.querySelector('[data-testid="column-width"]')
					?.textContent
			).toBe(`${SESSIONS_LIST_RESIZE.EXPANDED_MAX_WIDTH}px`)
		);
	}
};
