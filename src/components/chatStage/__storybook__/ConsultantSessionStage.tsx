/**
 * `ConsultantSessionStage` — the wired view as a story composition
 * (inventory §3.4, feedback "Storybook-first = the wired view").
 *
 * Real organisms only: `SessionsListToolbar` + `SessionListItemComponent`
 * rows + `ResizableHandle` (list column and, T2, the panel edge),
 * `SessionHeaderComponent`, `MessageTimeline`, `MessageSubmitInterfaceComponent`
 * (main chat), `SidePanel` (secondary), `ChannelSwitcherFab` and, on the
 * phone, the app's `NavigationBar` (T10). Layout decisions come from
 * `resolveStageLayout` / `clampPanelWidth`; nothing here paints bubbles or
 * composers.
 */
import * as React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SessionsListToolbar } from '../../sessionsList/SessionsListToolbar';
import { ResizableHandle } from '../../sessionsList/ResizableHandle';
import { SessionListItemComponent } from '../../sessionsListItem/SessionListItemComponent';
import { SessionHeaderComponent } from '../../sessionHeader/SessionHeaderComponent';
import { MessageTimeline } from '../../session/MessageTimeline';
import { MessageSubmitInterfaceComponent } from '../../messageSubmitInterface/messageSubmitInterfaceComponent';
import { focusSessionChromeOnPointerDown } from '../../session/focusSessionChrome';
import { mockE2eeParams } from '../../message/MessageItemComponent.mocks';
import type { StackParticipant } from '../../message/participantStack';
import { NavigationBar } from '../../app/NavigationBar';
import { RouterConfigConsultant } from '../../app/RouterConfig';
import {
	NavigationStoryProviders,
	storybookSettings
} from '../../app/navigationStoryHelpers';
import { config } from '../../../resources/scripts/config';
import { SidePanel, InfoBanner } from '../SidePanel';
import { PanelHeader } from '../PanelHeader';
import { ChannelSwitcherFab } from '../ChannelSwitcherFab';
import {
	resolveChannelLabel,
	type ChannelLabelMode,
	type SecondaryChannel
} from '../channelSwitcherState';
import {
	clampPanelWidth,
	readPanelWidth,
	resolveStageLayout,
	STAGE_LAYOUT,
	writePanelWidth
} from '../stageLayout';
import { useDockedComposerOffset } from '../useDockedComposerOffset';
import {
	computeThreadSummaries,
	formatThreadEntryPreview
} from '../../../utils/threadSummaries';
import { toMessagePreviewText } from '../../../utils/messagePreviewText';
import { useComposerFocus } from '../useComposerFocus';
import {
	ChatStageProviders,
	ListRowSession,
	seedStageMatrixRegistry
} from './ChatStageProviders';
import {
	CLIENT_MATRIX_ID,
	CLIENT_NAME,
	CLIENT_ROOM_ID,
	COUNSELLOR_MATRIX_ID,
	COUNSELLOR_NAME,
	isCounsellorMessage,
	mainChatMessages,
	SESSION_ID,
	stageListItems,
	SUPERVISION_ROOM_ID,
	SUPERVISOR_MATRIX_ID,
	SUPERVISOR_NAME,
	supervisionMessages,
	supervisionSystemNotice,
	THREAD_ROOT_ID,
	threadMessages
} from './chatStageFixtures';
import '../../sessionsList/sessionsList.styles.scss';
import '../../sessionsListItem/sessionsListItem.styles.scss';
import '../../sessionHeader/sessionHeader.styles.scss';
import '../../message/message.styles.scss';
import '../../messageSubmitInterface/messageSubmitInterface.styles.scss';
import '../../session/session.styles.scss';
import '../../app/authenticatedApp.styles.scss';
import '../../app/navigation.styles.scss';
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
	/** T1: hide the FAB while a panel is open (its header offers the channels). */
	fabHidden?: boolean;
	/** T27: show the supervision on/off switch in the channel card. */
	supervisionToggle?: boolean;
}

const noop = () => {};
const handlers = {
	handleDecryptionErrors: noop,
	handleDecryptionSuccess: noop,
	e2eeParams: mockE2eeParams()
};

/** The three people on stage, as the avatar stacks see them. */
const clientParticipant: StackParticipant = {
	userId: CLIENT_MATRIX_ID,
	username: 'sonnenblume_47',
	displayName: CLIENT_NAME,
	isAsker: true
};
const counsellorParticipant: StackParticipant = {
	userId: COUNSELLOR_MATRIX_ID,
	username: 'mona.s@oriso.invalid',
	displayName: COUNSELLOR_NAME,
	firstName: 'Mona',
	lastName: 'Sommer'
};
const supervisorParticipant: StackParticipant = {
	userId: SUPERVISOR_MATRIX_ID,
	username: 'bettina.b@oriso.invalid',
	displayName: SUPERVISOR_NAME,
	firstName: 'Bettina',
	lastName: 'Berg'
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

/** T21: the thread entry's "N replies" + "Author: last reply…" from the real summary code. */
const threadEntrySummary = (threadReplies: number) => {
	const root = mainChatMessages().find((m) => m._id === THREAD_ROOT_ID)!;
	const summary = computeThreadSummaries([
		root,
		...threadMessages().slice(0, threadReplies)
	]).get(THREAD_ROOT_ID)!;
	return {
		replyCount: summary.replyCount,
		lastReplyText: formatThreadEntryPreview(summary)
	};
};

/** T20: the newest message of a channel — orders the menu, feeds the preview. */
const lastMessageOf = (messages: ReturnType<typeof threadMessages>) => {
	const last = messages[messages.length - 1];
	return {
		author: last.displayName,
		text: toMessagePreviewText(last.message),
		ts: Number(last.messageTime)
	};
};

const threadRoot = () =>
	mainChatMessages().find((m) => m._id === THREAD_ROOT_ID)!;

const threadRootExcerpt = () => `${threadRoot().message.slice(0, 28)}…`;

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
				data-cy="stage-list-handle"
			/>
		</div>
	);
}

function MainChat({
	fab,
	threadReplies,
	hideFabWhileComposing = false,
	onBack
}: {
	fab?: React.ReactNode;
	threadReplies: number;
	/** Phone: the FAB steps back while the composer has focus (T10). */
	hideFabWhileComposing?: boolean;
	/** Phone: the composer's back arrow leaves the chat (T16). */
	onBack?: () => void;
}) {
	const { t } = useTranslation();
	const paneRef = useRef<HTMLDivElement | null>(null);
	const fabOffset = useDockedComposerOffset(paneRef);
	const composing = useComposerFocus(paneRef);
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
							? threadEntrySummary(threadReplies)
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
				onMobileNavigateBack={onBack}
			/>
			{React.isValidElement(fab)
				? React.cloneElement(fab as React.ReactElement<any>, {
						bottomOffset: fabOffset,
						// Only override the element's own `fabHidden` while
						// composing; the desktop FAB manages it itself (T1).
						...(hideFabWhileComposing && composing
							? { fabHidden: true }
							: {})
					})
				: fab}
		</div>
	);
}

interface RoomProps {
	variant: 'inside' | 'card' | 'fullscreen';
	onBack?: () => void;
	onClose?: () => void;
	switcher?: React.ReactNode;
	/** All secondary channels, listed under the header's channel icon (T1/T15). */
	channels: SecondaryChannel[];
	activeChannelId: string;
	onSelectChannel: (channelId: string) => void;
	/** Review v6: the channel was picked from the FAB — the header takes focus. */
	focusChannelButton?: boolean;
	/** T27: supervision on/off switch in the card. */
	supervisionActive?: boolean;
	onToggleSupervision?: (active: boolean) => void;
}

function SupervisionRoom({
	variant,
	unread,
	withReason,
	onBack,
	onClose,
	switcher,
	channels,
	activeChannelId,
	onSelectChannel,
	focusChannelButton,
	supervisionActive,
	onToggleSupervision
}: RoomProps & { unread: number; withReason: boolean }) {
	const { t } = useTranslation();
	// T7: the system notice opens the side room (frontend-rendered for now).
	const messages = useMemo(
		() => [
			supervisionSystemNotice(
				t('supervision.panel.title'),
				t('supervision.panel.systemNotice', { name: SUPERVISOR_NAME })
			),
			...supervisionMessages()
		],
		[t]
	);
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
					kind="supervision"
					title={t('supervision.panel.title')}
					name={SUPERVISOR_NAME}
					participants={[
						counsellorParticipant,
						supervisorParticipant
					]}
					unreadCount={unread}
					channels={channels}
					activeChannelId={activeChannelId}
					onSelectChannel={onSelectChannel}
					supervisionActive={supervisionActive}
					onToggleSupervision={onToggleSupervision}
					autoFocusChannelButton={focusChannelButton}
					onBack={onBack}
					onClose={onBack ? undefined : onClose}
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
					messages={messages}
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
					onMobileNavigateBack={onBack}
				/>
			}
			switcher={switcher}
		/>
	);
}

function ThreadRoom({
	variant,
	onBack,
	onClose,
	switcher,
	channels,
	activeChannelId,
	onSelectChannel,
	focusChannelButton,
	supervisionActive,
	onToggleSupervision
}: RoomProps) {
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
					kind="thread"
					title={t('chatStage.panel.thread.title')}
					name={CLIENT_NAME}
					participants={[clientParticipant, counsellorParticipant]}
					channels={channels}
					activeChannelId={activeChannelId}
					onSelectChannel={onSelectChannel}
					supervisionActive={supervisionActive}
					onToggleSupervision={onToggleSupervision}
					autoFocusChannelButton={focusChannelButton}
					onBack={onBack}
					onClose={onBack ? undefined : onClose}
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
					onMobileNavigateBack={onBack}
				/>
			}
			switcher={switcher}
		/>
	);
}

/** T10: the app's own bottom navigation under the phone stage. */
function PhoneBottomNav() {
	const routerConfig = useMemo(
		() => RouterConfigConsultant({ ...config, ...storybookSettings }),
		[]
	);
	return (
		<NavigationStoryProviders role="consultant">
			<div
				className="app__wrapper chatStage__bottomNav"
				data-cy="stage-bottom-nav"
			>
				<NavigationBar routerConfig={routerConfig} onLogout={noop} />
			</div>
		</NavigationStoryProviders>
	);
}

/** T2: the side panel's width — dragged, clamped, persisted. */
function usePanelWidth(initial: number, cardWidth: number) {
	const [width, setWidth] = useState(() => readPanelWidth(initial));
	const resize = useCallback(
		(requested: number) => {
			const next = clampPanelWidth(requested, cardWidth);
			setWidth(next);
			writePanelWidth(next);
		},
		[cardWidth]
	);
	return { width: clampPanelWidth(width, cardWidth), resize };
}

function DesktopPanelSlot({
	width,
	cardWidth,
	onResize,
	className,
	children
}: {
	width: number;
	cardWidth: number;
	onResize: (width: number) => void;
	className?: string;
	children: React.ReactNode;
}) {
	const { t } = useTranslation();
	return (
		<div
			className={['chatStage__panel', className]
				.filter(Boolean)
				.join(' ')}
			style={{ width }}
			data-cy="stage-panel-slot"
		>
			<ResizableHandle
				anchor="start"
				snapping={false}
				currentWidth={width}
				onResize={onResize}
				minWidth={STAGE_LAYOUT.MIN_PANE_WIDTH}
				maxWidth={Math.max(
					STAGE_LAYOUT.MIN_PANE_WIDTH,
					cardWidth - STAGE_LAYOUT.MIN_PANE_WIDTH
				)}
				ariaLabel={t('supervision.panel.stage.divider')}
				className="chatStage__panelHandle"
				data-cy="stage-panel-handle"
			/>
			{children}
		</div>
	);
}

/** T15: a channel id from the menu → the panel that shows it. */
export const panelForChannel = (channelId: string): StagePanel =>
	channelId === 'supervision' ? 'supervision' : 'thread';

export function ConsultantSessionStage({
	panel: initialPanel = 'supervision',
	panelVariant = 'inside',
	snapList = false,
	listWidth = 420,
	panelWidth = 400,
	openThreads = 0,
	supervisionUnread = 0,
	threadUnread = 0,
	labelMode = 'person',
	phone: initialPhone,
	withReason = false,
	fabDefaultOpen = false,
	fabHidden = true,
	supervisionToggle = false
}: ConsultantSessionStageProps) {
	const { t } = useTranslation();
	const viewportWidth = useViewportWidth();
	// T15: the stage switches its side room when a channel is picked — from
	// the panel header's menu, the FAB or the phone's back switcher.
	const [panel, setPanel] = useState<StagePanel>(initialPanel);
	const [phone, setPhone] = useState(initialPhone);
	// Review v6: a pick from the FAB hands focus to the panel header's
	// channel button (the FAB is gone once the panel is open).
	const [focusHeader, setFocusHeader] = useState(false);
	// T27: the card's supervision switch (presentational; B2 wires it).
	const [supervisionActive, setSupervisionActive] = useState(true);
	const onToggleSupervision = supervisionToggle
		? setSupervisionActive
		: undefined;
	useEffect(() => setPanel(initialPanel), [initialPanel]);
	useEffect(() => setPhone(initialPhone), [initialPhone]);
	const selectChannel = useCallback(
		(channelId: string, source: 'fab' | 'header' = 'header') => {
			setFocusHeader(source === 'fab');
			setPanel(panelForChannel(channelId));
			setPhone((view) => (view === undefined ? view : 'secondary'));
		},
		[]
	);
	const selectFromHeader = useCallback(
		(channelId: string) => selectChannel(channelId, 'header'),
		[selectChannel]
	);
	const selectFromFab = useCallback(
		(channelId: string) => selectChannel(channelId, 'fab'),
		[selectChannel]
	);
	const backToMain = useCallback(
		() => setPhone((view) => (view === undefined ? view : 'main')),
		[]
	);
	const closePanel = useCallback(() => {
		setFocusHeader(false);
		setPanel(null);
	}, []);
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
	const cardWidth = Math.max(
		0,
		viewportWidth - effectiveListWidth - 2 * STAGE_LAYOUT.CARD_MARGIN
	);
	const dragged = usePanelWidth(
		snapList ? layout.panelWidth : Math.max(panelWidth, 0),
		cardWidth
	);

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
		unread: supervisionUnread,
		lastMessage: lastMessageOf(supervisionMessages())
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
			unread: index === 0 ? threadUnread : 0,
			// The first thread is the real one — started first, so it is
			// "Thread #1" for good (review v6); every further one was started
			// a minute later (#2, #3 …).
			createdTs: Number(threadRoot().messageTime) + index * 60_000,
			// … but each further one has a NEWER last message, so it ranks
			// above the real one in the menu.
			lastMessage:
				index === 0
					? lastMessageOf(threadMessages())
					: {
							author: COUNSELLOR_NAME,
							text: 'Ich schicke Ihnen die Checkliste für das Gespräch mit der Personalabteilung.',
							ts:
								lastMessageOf(threadMessages()).ts +
								index * 5 * 60_000
						}
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

	// Channels not on screen — the FAB (desktop, while no panel is open)
	// offers these; the panel header's menu lists all of them (T15).
	const otherChannels = channels.filter(
		(channel) => channel.id !== shownChannelId
	);
	const activeChannelId = shownChannelId ?? '';

	// Phone, inside a side room: the FAB switches back (and offers the rest).
	const backFab = (
		<ChannelSwitcherFab
			channels={channels}
			activeChannelId={shownChannelId}
			onSelect={selectFromFab}
			onBack={backToMain}
			defaultOpen={fabDefaultOpen}
			supervisionActive={supervisionActive}
			onToggleSupervision={onToggleSupervision}
		/>
	);

	const desktopFab =
		otherChannels.length > 0 ? (
			<ChannelSwitcherFab
				channels={channels}
				activeChannelId={shownChannelId}
				onSelect={selectFromFab}
				defaultOpen={fabDefaultOpen}
				fabHidden={fabHidden && panel !== null}
				supervisionActive={supervisionActive}
				onToggleSupervision={onToggleSupervision}
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
									onBack={backToMain}
									switcher={backFab}
									channels={channels}
									activeChannelId={activeChannelId}
									onSelectChannel={selectFromHeader}
									focusChannelButton={focusHeader}
									supervisionActive={supervisionActive}
									onToggleSupervision={onToggleSupervision}
								/>
							) : (
								<SupervisionRoom
									variant="fullscreen"
									unread={supervisionUnread}
									withReason={withReason}
									onBack={backToMain}
									switcher={backFab}
									channels={channels}
									activeChannelId={activeChannelId}
									onSelectChannel={selectFromHeader}
									focusChannelButton={focusHeader}
									supervisionActive={supervisionActive}
									onToggleSupervision={onToggleSupervision}
								/>
							)
						) : (
							<div
								className="session"
								tabIndex={-1}
								onMouseDown={focusSessionChromeOnPointerDown}
							>
								<MainChat
									hideFabWhileComposing
									onBack={noop}
									fab={
										<ChannelSwitcherFab
											channels={channels}
											onSelect={selectFromFab}
											defaultOpen={fabDefaultOpen}
											supervisionActive={
												supervisionActive
											}
											onToggleSupervision={
												onToggleSupervision
											}
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
					<PhoneBottomNav />
				</div>
			</ChatStageProviders>
		);
	}

	const secondary =
		panel === 'thread' ? (
			<ThreadRoom
				variant={panelVariant}
				channels={channels}
				activeChannelId={activeChannelId}
				onSelectChannel={selectFromHeader}
				focusChannelButton={focusHeader}
				supervisionActive={supervisionActive}
				onToggleSupervision={onToggleSupervision}
				onClose={closePanel}
			/>
		) : panel === 'supervision' ? (
			<SupervisionRoom
				variant={panelVariant}
				unread={supervisionUnread}
				withReason={withReason}
				channels={channels}
				activeChannelId={activeChannelId}
				onSelectChannel={selectFromHeader}
				focusChannelButton={focusHeader}
				supervisionActive={supervisionActive}
				onToggleSupervision={onToggleSupervision}
				onClose={closePanel}
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
								<DesktopPanelSlot
									width={dragged.width}
									cardWidth={cardWidth}
									onResize={dragged.resize}
								>
									{secondary}
								</DesktopPanelSlot>
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
								<DesktopPanelSlot
									width={dragged.width}
									cardWidth={cardWidth}
									onResize={dragged.resize}
									className="chatStage__panel--card"
								>
									{secondary}
								</DesktopPanelSlot>
							)}
						</>
					)}
				</div>
			</div>
		</ChatStageProviders>
	);
}

export { STAGE_LAYOUT };
