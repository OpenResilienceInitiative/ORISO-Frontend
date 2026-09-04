/**
 * `ConsultantSessionStage` — the wired view as a story composition
 * (inventory §3.4, feedback "Storybook-first = the wired view").
 *
 * Real organisms only: `SessionsListToolbar` + `SessionListItemComponent`
 * rows + `ResizableHandle` (list column), `SessionHeaderComponent`,
 * `MessageTimeline`, `MessageSubmitInterfaceComponent` (main chat),
 * `SidePanel` (secondary) and `ChannelSwitcherFab`. Layout decisions come
 * from `resolveStageLayout`; nothing here paints bubbles or composers.
 */
import * as React from 'react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SessionsListToolbar } from '../../sessionsList/SessionsListToolbar';
import { ResizableHandle } from '../../sessionsList/ResizableHandle';
import { SessionListItemComponent } from '../../sessionsListItem/SessionListItemComponent';
import { SessionHeaderComponent } from '../../sessionHeader/SessionHeaderComponent';
import { MessageTimeline } from '../../session/MessageTimeline';
import { MessageSubmitInterfaceComponent } from '../../messageSubmitInterface/messageSubmitInterfaceComponent';
import { focusSessionChromeOnPointerDown } from '../../session/focusSessionChrome';
import { mockE2eeParams } from '../../message/MessageItemComponent.mocks';
import { SidePanel, InfoBanner } from '../SidePanel';
import { PanelHeader } from '../PanelHeader';
import { ChannelSwitcherFab } from '../ChannelSwitcherFab';
import {
	resolveChannelLabel,
	type ChannelLabelMode,
	type SecondaryChannel
} from '../channelSwitcherState';
import { resolveStageLayout, STAGE_LAYOUT } from '../stageLayout';
import { useDockedComposerOffset } from '../useDockedComposerOffset';
import {
	ChatStageProviders,
	ListRowSession,
	seedStageMatrixRegistry
} from './ChatStageProviders';
import {
	CLIENT_MATRIX_ID,
	CLIENT_NAME,
	CLIENT_ROOM_ID,
	isCounsellorMessage,
	mainChatMessages,
	SESSION_ID,
	stageListItems,
	SUPERVISION_ROOM_ID,
	SUPERVISOR_NAME,
	supervisionMessages,
	THREAD_ROOT_ID,
	threadMessages
} from './chatStageFixtures';
import '../../sessionsList/sessionsList.styles.scss';
import '../../sessionsListItem/sessionsListItem.styles.scss';
import '../../sessionHeader/sessionHeader.styles.scss';
import '../../message/message.styles.scss';
import '../../messageSubmitInterface/messageSubmitInterface.styles.scss';
import '../../session/session.styles.scss';
import '../sidePanel.styles.scss';
import '../channelSwitcherFab.styles.scss';
import '../chatStage.styles.scss';

export type StagePanel = 'supervision' | 'thread' | null;

export interface ConsultantSessionStageProps {
	/** Which side room occupies the panel (desktop) / the screen (phone). */
	panel?: StagePanel;
	/** Inside the chat card (Frank's choice) or a second card. */
	panelVariant?: 'inside' | 'card';
	/** Apply the icon-rail snap rule when the panel opens (story c). */
	snapList?: boolean;
	listWidth?: number;
	panelWidth?: number;
	/** Secondary channels that exist (the FAB offers the ones not on screen). */
	openThreads?: number;
	supervisionUnread?: number;
	threadUnread?: number;
	labelMode?: ChannelLabelMode;
	/** Force the phone layout; `undefined` follows the viewport. */
	phone?: 'main' | 'secondary';
	/** Show the reason banner in the supervision room. */
	withReason?: boolean;
	fabDefaultOpen?: boolean;
}

const noop = () => {};
const handlers = {
	handleDecryptionErrors: noop,
	handleDecryptionSuccess: noop,
	e2eeParams: mockE2eeParams()
};

const useViewportWidth = () => {
	const [width, setWidth] = useState(() =>
		typeof window === 'undefined' ? 1280 : window.innerWidth
	);
	useEffect(() => {
		const update = () => setWidth(window.innerWidth);
		window.addEventListener('resize', update);
		return () => window.removeEventListener('resize', update);
	}, []);
	return width;
};

const threadRootExcerpt = () => {
	const root = mainChatMessages().find((m) => m._id === THREAD_ROOT_ID)!;
	return `${root.message.slice(0, 28)}…`;
};

function ListColumn({ width, rail }: { width: number; rail: boolean }) {
	const { t } = useTranslation();
	const [search, setSearch] = useState('');
	const items = stageListItems();
	const activeIndex = items.findIndex(
		(item) => item.session?.id === SESSION_ID
	);
	return (
		<div
			className={`chatStage__list sessionsList__wrapper${
				rail ? ' sessionsList__wrapper--iconOnly' : ''
			}`}
			style={{ width }}
			data-cy="stage-list"
			data-list-mode={rail ? 'rail' : 'expanded'}
		>
			<div className="sessionsList__innerWrapper">
				<SessionsListToolbar
					translate={t}
					searchValue={search}
					onSearchChange={setSearch}
					activeChip={null}
					onChipToggle={noop}
					showConsultantActions
					showCreateGroupChatAction
					showSupervisionChip
					createGroupChatPath="/sessions/consultant/sessionView/createGroupChat"
					archiveTabPath="/sessions/consultant/sessionView?sessionListTab=archive"
					archiveTabActive={false}
					createGroupChatActive={false}
				/>
				<div className="sessionsList__scrollArea">
					<div className="sessionsList__scrollContainer sessionsList__scrollContainer--hasToolbar">
						{items.map((item, index) => (
							<ListRowSession key={item.session!.id} item={item}>
								<SessionListItemComponent
									defaultLanguage="de"
									handleKeyDownLisItemContent={noop}
									index={index}
									isBeforeActive={index === activeIndex - 1}
									isAfterActive={index === activeIndex + 1}
								/>
							</ListRowSession>
						))}
					</div>
				</div>
			</div>
			<ResizableHandle
				currentWidth={width}
				onResize={noop}
				maxWidth={500}
			/>
		</div>
	);
}

function MainChat({
	fab,
	threadReplies
}: {
	fab?: React.ReactNode;
	threadReplies: number;
}) {
	const { t } = useTranslation();
	const paneRef = useRef<HTMLDivElement | null>(null);
	const fabOffset = useDockedComposerOffset(paneRef);
	// The app opens a conversation at its newest message.
	useEffect(() => {
		const toBottom = () => {
			const content =
				paneRef.current?.querySelector<HTMLElement>(
					'.session__content'
				);
			if (content) {
				content.scrollTop = content.scrollHeight;
			}
		};
		toBottom();
		// Rows animate in and the editor mounts late; settle, then scroll again.
		const timer = window.setTimeout(toBottom, 400);
		return () => window.clearTimeout(timer);
	}, []);
	return (
		<div className="chatStage__mainPane" ref={paneRef} data-cy="stage-main">
			<div>
				<SessionHeaderComponent bannedUsers={[]} />
			</div>
			<div className="session__content" id="session-scroll-container">
				<MessageTimeline
					messages={mainChatMessages()}
					renderMode="main"
					clientName={CLIENT_NAME}
					askerMatrixUserIdFor={() => CLIENT_MATRIX_ID}
					isMyMessage={isCounsellorMessage}
					threadsEnabled
					threadSummaryFor={(id) =>
						id === THREAD_ROOT_ID && threadReplies > 0
							? {
									replyCount: threadReplies,
									lastReplyText:
										threadMessages()[threadReplies - 1]
											.message
								}
							: undefined
					}
					onOpenThread={noop}
					{...handlers}
				/>
			</div>
			<MessageSubmitInterfaceComponent
				placeholder={t('enquiry.write.input.placeholder.consultant')}
				hideSupervisorAudience
				onSendButton={noop}
				isTyping={noop}
				language="de"
			/>
			{React.isValidElement(fab)
				? React.cloneElement(fab as React.ReactElement<any>, {
						bottomOffset: fabOffset
					})
				: fab}
		</div>
	);
}

function SupervisionRoom({
	variant,
	unread,
	withReason,
	onBack,
	switcher
}: {
	variant: 'inside' | 'card' | 'fullscreen';
	unread: number;
	withReason: boolean;
	onBack?: () => void;
	switcher?: React.ReactNode;
}) {
	const { t } = useTranslation();
	return (
		<SidePanel
			variant={variant}
			className={`chatStage__panel--${variant}`}
			label={t('chatStage.panel.region', {
				title: t('supervision.panel.title')
			})}
			data-cy="stage-panel"
			header={
				<PanelHeader
					title={t('supervision.panel.title')}
					name={SUPERVISOR_NAME}
					chip={t('supervision.panel.role.supervisor')}
					unreadCount={unread}
					tag={t('supervision.panel.privacyHint')}
					onBack={onBack}
					onClose={onBack ? undefined : noop}
				/>
			}
			banner={
				withReason ? (
					<InfoBanner
						title="Supervisionsgrund"
						text="Wiederholte Vermeidung beim Thema Mahnbescheide; Fallbesprechung zur Gesprächsführung."
					/>
				) : undefined
			}
			timeline={
				<MessageTimeline
					messages={supervisionMessages()}
					renderMode="main"
					threadsEnabled={false}
					clientName={SUPERVISOR_NAME}
					askerMatrixUserIdFor={() => CLIENT_MATRIX_ID}
					isMyMessage={isCounsellorMessage}
					{...handlers}
				/>
			}
			composer={
				<MessageSubmitInterfaceComponent
					placeholder={t('supervision.panel.composer.placeholder', {
						name: SUPERVISOR_NAME
					})}
					targetRoomId={SUPERVISION_ROOM_ID}
					hideSupervisorAudience
					onSendButton={noop}
					isTyping={noop}
					language="de"
				/>
			}
			switcher={switcher}
		/>
	);
}

function ThreadRoom({
	variant,
	onBack,
	switcher
}: {
	variant: 'inside' | 'card' | 'fullscreen';
	onBack?: () => void;
	switcher?: React.ReactNode;
}) {
	const { t } = useTranslation();
	const root = mainChatMessages().find((m) => m._id === THREAD_ROOT_ID)!;
	return (
		<SidePanel
			variant={variant}
			className={`chatStage__panel--${variant}`}
			label={t('chatStage.panel.region', {
				title: t('chatStage.panel.thread.title')
			})}
			data-cy="stage-panel"
			header={
				<PanelHeader
					title={t('chatStage.panel.thread.title')}
					name={CLIENT_NAME}
					tag={t('chatStage.panel.thread.subtitle')}
					onBack={onBack}
					onClose={onBack ? undefined : noop}
				/>
			}
			timeline={
				<MessageTimeline
					messages={[root, ...threadMessages()]}
					renderMode="thread"
					threadsEnabled
					threadRootId={THREAD_ROOT_ID}
					forceShow
					clientName={CLIENT_NAME}
					isMyMessage={isCounsellorMessage}
					{...handlers}
				/>
			}
			composer={
				<MessageSubmitInterfaceComponent
					placeholder={t('message.thread.placeholder')}
					threadRootId={THREAD_ROOT_ID}
					onSendButton={noop}
					isTyping={noop}
					language="de"
				/>
			}
			switcher={switcher}
		/>
	);
}

export function ConsultantSessionStage({
	panel = 'supervision',
	panelVariant = 'inside',
	snapList = false,
	listWidth = 420,
	panelWidth = 400,
	openThreads = 0,
	supervisionUnread = 0,
	threadUnread = 0,
	labelMode = 'person',
	phone,
	withReason = false,
	fabDefaultOpen = false
}: ConsultantSessionStageProps) {
	const { t } = useTranslation();
	const viewportWidth = useViewportWidth();
	useState(() =>
		seedStageMatrixRegistry({
			[CLIENT_ROOM_ID]: 0,
			'!yak-4708:oriso.invalid': 2
		})
	);

	const layout = resolveStageLayout({
		viewportWidth: phone ? 390 : viewportWidth,
		listWidth,
		panelWidth,
		panelOpen: panel !== null
	});
	const single = phone !== undefined || layout.mode === 'single';
	const rail = snapList ? layout.listMode === 'rail' : listWidth <= 80;
	const effectiveListWidth = snapList ? layout.listWidth : listWidth;
	const effectivePanelWidth = snapList
		? layout.panelWidth
		: Math.max(panelWidth, 0);

	// Secondary channels: supervision always, threads as configured.
	const supervisionChannel: SecondaryChannel = {
		id: 'supervision',
		kind: 'supervision',
		label: resolveChannelLabel(
			{
				kind: 'supervision',
				topic: t('supervision.panel.title'),
				person: SUPERVISOR_NAME
			},
			labelMode
		),
		unread: supervisionUnread
	};
	const threadChannels: SecondaryChannel[] = Array.from(
		{ length: openThreads },
		(_, index) => ({
			id: index === 0 ? THREAD_ROOT_ID : `$thread-${index + 1}`,
			kind: 'thread' as const,
			label: resolveChannelLabel(
				{
					kind: 'thread',
					topic:
						index === 0
							? threadRootExcerpt()
							: `Thread #${index + 1}`,
					person: CLIENT_NAME
				},
				labelMode
			),
			unread: index === 0 ? threadUnread : 0
		})
	);
	// Newest thread on top, supervision right above the FAB (Figma order).
	const channels: SecondaryChannel[] = [
		...[...threadChannels].reverse(),
		supervisionChannel
	];

	const shownChannelId =
		panel === 'supervision'
			? 'supervision'
			: panel === 'thread'
				? THREAD_ROOT_ID
				: undefined;

	// Phone, inside a side room: the FAB switches back (and offers the rest).
	const backFab = (
		<ChannelSwitcherFab
			channels={channels}
			activeChannelId={shownChannelId}
			onSelect={noop}
			onBack={noop}
			defaultOpen={fabDefaultOpen}
		/>
	);

	// On the desktop the FAB is only useful when a channel is NOT on screen.
	const desktopFabChannels = channels.filter(
		(channel) => channel.id !== shownChannelId
	);
	const desktopFab =
		desktopFabChannels.length > 0 ? (
			<ChannelSwitcherFab
				channels={desktopFabChannels}
				onSelect={noop}
				defaultOpen={fabDefaultOpen}
			/>
		) : undefined;

	if (single) {
		const showSecondary = phone === 'secondary' && panel !== null;
		return (
			<ChatStageProviders>
				<div
					className="chatStage chatStage--single"
					data-cy="chat-stage"
					data-mode="single"
				>
					<div className="chatStage__detail session__wrapper">
						{showSecondary ? (
							panel === 'thread' ? (
								<ThreadRoom
									variant="fullscreen"
									onBack={noop}
									switcher={backFab}
								/>
							) : (
								<SupervisionRoom
									variant="fullscreen"
									unread={supervisionUnread}
									withReason={withReason}
									onBack={noop}
									switcher={backFab}
								/>
							)
						) : (
							<div
								className="session"
								tabIndex={-1}
								onMouseDown={focusSessionChromeOnPointerDown}
							>
								<MainChat
									fab={
										<ChannelSwitcherFab
											channels={channels}
											onSelect={noop}
											defaultOpen={fabDefaultOpen}
										/>
									}
									threadReplies={
										openThreads > 0
											? threadMessages().length
											: 0
									}
								/>
							</div>
						)}
					</div>
					<nav
						className="chatStage__bottomNav"
						aria-label="Navigation (Platzhalter)"
					>
						<span className="chatStage__bottomNavItem chatStage__bottomNavItem--active">
							Beratungen
						</span>
						<span className="chatStage__bottomNavItem">
							Anfragen
						</span>
						<span className="chatStage__bottomNavItem">Profil</span>
					</nav>
				</div>
			</ChatStageProviders>
		);
	}

	const secondary =
		panel === 'thread' ? (
			<ThreadRoom variant={panelVariant} />
		) : panel === 'supervision' ? (
			<SupervisionRoom
				variant={panelVariant}
				unread={supervisionUnread}
				withReason={withReason}
			/>
		) : null;

	return (
		<ChatStageProviders>
			<div
				className="chatStage"
				data-cy="chat-stage"
				data-mode="split"
				data-panel-variant={panelVariant}
			>
				<ListColumn width={effectiveListWidth} rail={rail} />
				<div className="chatStage__detail session__wrapper">
					{panelVariant === 'inside' ? (
						<div
							className={`session chatStage__card${
								secondary ? ' chatStage__card--split' : ''
							}`}
							tabIndex={-1}
							onMouseDown={focusSessionChromeOnPointerDown}
						>
							<MainChat
								fab={desktopFab}
								threadReplies={
									openThreads > 0
										? threadMessages().length
										: 0
								}
							/>
							{secondary && (
								<div
									className="chatStage__panel"
									style={{ width: effectivePanelWidth }}
									data-cy="stage-panel-slot"
								>
									{secondary}
								</div>
							)}
						</div>
					) : (
						<>
							<div
								className="session"
								tabIndex={-1}
								onMouseDown={focusSessionChromeOnPointerDown}
							>
								<MainChat
									fab={desktopFab}
									threadReplies={
										openThreads > 0
											? threadMessages().length
											: 0
									}
								/>
							</div>
							{secondary && (
								<div
									className="chatStage__panel chatStage__panel--card"
									style={{ width: effectivePanelWidth }}
									data-cy="stage-panel-slot"
								>
									{secondary}
								</div>
							)}
						</>
					)}
				</div>
			</div>
		</ChatStageProviders>
	);
}

export { STAGE_LAYOUT };
