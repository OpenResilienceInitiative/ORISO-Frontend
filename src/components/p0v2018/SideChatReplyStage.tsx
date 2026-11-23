/**
 * FE#2494 *7 (+ *8) — design stage for "P0 v2.0.18": reply to marked
 * passages of the client chat INTO a side chat (Supervision or the enquiry's
 * team chat), never into the client chat by mistake. Marking, replying and
 * collecting also work INSIDE each side chat and a thread (Frank, 23 Nov).
 *
 * Built only from the real organisms: `SessionHeaderComponent`,
 * `SelectionReplyLayer` (+ `SelectionReplyToolbar`), `MessageTimeline`
 * (`PassageReplyBlocks` for the quotes), `MessageSubmitInterfaceComponent`
 * with `ComposerPendingQuotes`, `SidePanel`, `PanelHeader`,
 * `PanelCallActions`. The state below is story state only; the app wiring
 * follows after Frank approves the look.
 */
import * as React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
	SelectionReplyLayer,
	type SelectionAnswer,
	type SelectionVoiceRecorder
} from '../selectionReply/SelectionReplyLayer';
import { createSilentWavUrl } from '../voicePlayer/__storybook__/silentAudio';
import {
	anchorFor,
	type MessageSelection
} from '../selectionReply/useMessageSelection';
import {
	findMessageBubble,
	findPassageRange,
	jumpToPassage
} from '../selectionReply/passageRange';
import type { PassageReply } from '../selectionReply/PassageReplyBlocks';
import { SessionHeaderComponent } from '../sessionHeader/SessionHeaderComponent';
import { MessageTimeline } from '../session/MessageTimeline';
import { MessageSubmitInterfaceComponent } from '../messageSubmitInterface/messageSubmitInterfaceComponent';
import type { ComposerPendingQuote } from '../messageSubmitInterface/ComposerPendingQuotes';
import { SidePanel, InfoBanner } from '../chatStage/SidePanel';
import { PanelHeader } from '../chatStage/PanelHeader';
import {
	PanelCallActions,
	type PanelMenuItem
} from '../chatStage/PanelCallActions';
import { teamCopy } from '../chatStage/teamChannelCopy';
import { focusSessionChromeOnPointerDown } from '../session/focusSessionChrome';
import { mockE2eeParams } from '../message/MessageItemComponent.mocks';
import type { MessageItem } from '../message/MessageItemComponent';
import type { StackParticipant } from '../message/participantStack';
import { ChatStageProviders } from '../chatStage/__storybook__/ChatStageProviders';
import {
	CLIENT_MATRIX_ID,
	CLIENT_NAME,
	COUNSELLOR_MATRIX_ID,
	COUNSELLOR_NAME,
	isCounsellorMessage,
	mainChatMessages,
	SUPERVISION_ROOM_ID,
	SUPERVISOR_MATRIX_ID,
	SUPERVISOR_NAME,
	supervisionMessages,
	TEAM_MATE_A_MATRIX_ID,
	TEAM_MATE_A_NAME,
	TEAM_MATE_B_MATRIX_ID,
	TEAM_MATE_B_NAME,
	TEAM_ROOM_ID,
	teamMessages,
	THREAD_ROOT_ID,
	threadMessages,
	CLIENT_ROOM_ID
} from '../chatStage/__storybook__/chatStageFixtures';
import '../message/message.styles.scss';
import '../messageSubmitInterface/messageSubmitInterface.styles.scss';
import { ReactComponent as SupervisionIcon } from '../../resources/img/icons/supervision_nocirc_400_24px.svg';
import { ReactComponent as CalendarPlusIcon } from '../../resources/img/icons/calendar-plus.svg';
import '../session/session.styles.scss';
import '../chatStage/chatStage.styles.scss';
import '../chatStage/sidePanel.styles.scss';
import '../chatStage/panelCallActions.styles.scss';
import '../selectionReply/selectionReply.styles.scss';

export type SideRoom = 'supervision' | 'team' | 'thread';

/** Three passages of the fixture client chat (real text of $m3 / $m5). */
export const P7_PASSAGES = {
	letters: {
		eventId: '$m3',
		excerpt:
			'Es sind ein paar Briefe gekommen, die ich nicht aufgemacht habe.'
	},
	contract: {
		eventId: '$m5',
		excerpt: 'Mein Vertrag läuft im Oktober aus'
	},
	sleep: { eventId: '$m5', excerpt: 'Ich schlafe kaum noch.' },
	/** In the Supervision: the supervisor's advice ($s2). */
	supervisorAdvice: {
		eventId: '$s2',
		excerpt: 'Vermeidung ist hier oft Scham.'
	},
	/** In the team chat: a colleague's message ($t2). */
	teamAdvice: {
		eventId: '$t2',
		excerpt: 'die Fachstelle Wohnen Vorrang'
	},
	/** In the thread: the client's reply ($t2 of the thread). */
	threadReply: {
		eventId: '$t2',
		excerpt: 'Vielleicht nächste Woche'
	}
} as const;

export type PassageRef = {
	eventId: string;
	excerpt: string;
	/** Who wrote the passage (default: the advice seeker). */
	author?: string;
	/** The answer written to it, if any. */
	replyText?: string;
	/** FE#2494: a voice answer to it, played in the sent message. */
	voice?: { src: string; durationSec: number } | null;
};

const noop = () => {};
const handlers = {
	handleDecryptionErrors: noop,
	handleDecryptionSuccess: noop,
	e2eeParams: mockE2eeParams()
};

const counsellor: StackParticipant = {
	userId: COUNSELLOR_MATRIX_ID,
	username: 'mona.s@oriso.invalid',
	displayName: COUNSELLOR_NAME
};
const supervisor: StackParticipant = {
	userId: SUPERVISOR_MATRIX_ID,
	username: 'bettina.b@oriso.invalid',
	displayName: SUPERVISOR_NAME
};
const teamMateA: StackParticipant = {
	userId: TEAM_MATE_A_MATRIX_ID,
	username: 'jonas.k',
	displayName: TEAM_MATE_A_NAME
};
const teamMateB: StackParticipant = {
	userId: TEAM_MATE_B_MATRIX_ID,
	username: 'aylin.d',
	displayName: TEAM_MATE_B_NAME
};

/** Storybook has no microphone: a stand-in that "records" silence. */
const storyRecorder: SelectionVoiceRecorder = {
	start: noop,
	stop: async () => ({ src: createSilentWavUrl(12), durationSec: 12 }),
	pause: noop,
	resume: noop,
	cancel: noop
};

const toQuote = (passage: PassageRef, index: number): ComposerPendingQuote => ({
	id: `${passage.eventId}-${index}-${passage.excerpt.length}`,
	eventId: passage.eventId,
	author: passage.author ?? CLIENT_NAME,
	excerpt: passage.excerpt
});

const roomIdOf = (room: SideRoom) =>
	room === 'supervision'
		? SUPERVISION_ROOM_ID
		: room === 'team'
			? TEAM_ROOM_ID
			: CLIENT_ROOM_ID;

/** One message in the side room carrying every collected passage. */
const stackedReply = (
	room: SideRoom,
	passages: PassageRef[],
	text: string,
	time: string
): MessageItem => ({
	_id: `$${room}-stack-${time}`,
	message: text,
	messageDate: { str: '', date: null } as MessageItem['messageDate'],
	messageTime: time,
	askerMatrixUserId: CLIENT_MATRIX_ID,
	isNotRead: false,
	t: null,
	rid: roomIdOf(room),
	...(room === 'thread' ? { threadRootEventId: THREAD_ROOT_ID } : {}),
	displayName: COUNSELLOR_NAME,
	username: 'mona.s@oriso.invalid',
	userId: COUNSELLOR_MATRIX_ID,
	passageReplies: passages.map(
		(passage): PassageReply => ({
			eventId: passage.eventId,
			author: passage.author ?? CLIENT_NAME,
			excerpt: passage.excerpt,
			text: passage.replyText,
			voice: passage.voice ?? null
		})
	)
});

export interface SideChatReplyStageProps {
	/** Opens with this passage marked and the bar shown over it. */
	preset?: PassageRef;
	/** What shows over the preset passage: the bar or the reply field. */
	presetMode?: 'toolbar' | 'popover';
	/** The preset reply field is already aimed at this side chat. */
	presetTarget?: 'supervision' | 'team' | null;
	/** Where the preset passage is marked (default: the client chat). */
	presetRoom?: 'main' | SideRoom;
	/** Today's bar over the passage, or the variant: handle + bubble menu. */
	menu?: 'toolbar' | 'bubble';
	/** Variant: the side-chat badge hangs on the grey quote. */
	badgeOn?: 'bubble' | 'quote';
	/** The side chat that is open on load. */
	openRoom?: SideRoom | null;
	/** Passages already waiting in the open side chat's reply field. */
	collected?: PassageRef[];
	/** The open side chat already shows a sent stacked reply. */
	sent?: { passages: PassageRef[]; text: string } | null;
	/** The enquiry has a team chat (#2491 can switch it off). */
	withTeam?: boolean;
	/** The case is under supervision. */
	withSupervision?: boolean;
	/** Side chat width; the call buttons fold into ⋮ when it is narrow. */
	panelWidth?: number;
	height?: number | string;
}

export function SideChatReplyStage({
	preset,
	presetMode = 'toolbar',
	presetRoom = 'main',
	presetTarget = null,
	menu = 'toolbar',
	badgeOn = 'bubble',
	openRoom = null,
	collected = [],
	sent = null,
	withTeam = true,
	withSupervision = true,
	panelWidth = 440,
	height = '100vh'
}: SideChatReplyStageProps) {
	const { t } = useTranslation();
	const copy = teamCopy(t);
	const contentRef = useRef<HTMLDivElement | null>(null);
	const sideRef = useRef<HTMLDivElement | null>(null);
	const [room, setRoom] = useState<SideRoom | null>(openRoom);
	const [pending, setPending] = useState<
		Record<SideRoom, ComposerPendingQuote[]>
	>(() => ({
		supervision: openRoom === 'supervision' ? collected.map(toQuote) : [],
		team: openRoom === 'team' ? collected.map(toQuote) : [],
		thread: openRoom === 'thread' ? collected.map(toQuote) : []
	}));
	const voiceByQuote = useRef(
		new Map<string, { src: string; durationSec: number }>()
	);
	const [sideMessages, setSideMessages] = useState<
		Record<SideRoom, MessageItem[]>
	>(() => {
		const sentRow = (target: SideRoom) =>
			sent && openRoom === target
				? [
						stackedReply(
							target,
							sent.passages,
							sent.text,
							String(Date.now())
						)
					]
				: [];
		return {
			supervision: [...supervisionMessages(), ...sentRow('supervision')],
			team: [...teamMessages(), ...sentRow('team')],
			thread: [
				mainChatMessages().find((m) => m._id === THREAD_ROOT_ID)!,
				...threadMessages(),
				...sentRow('thread')
			]
		};
	});
	const [presetSelection, setPresetSelection] =
		useState<MessageSelection | null>(null);
	const [sidePresetSelection, setSidePresetSelection] =
		useState<MessageSelection | null>(null);
	const messages = mainChatMessages();

	const authorFor = useCallback(
		(eventId: string) =>
			messages.find((m) => m._id === eventId)?.displayName || '',
		[messages]
	);

	// The app opens a conversation at its newest message.
	useEffect(() => {
		if (preset || !contentRef.current) {
			return undefined;
		}
		const content = contentRef.current;
		const timer = window.setTimeout(() => {
			content.scrollTop = content.scrollHeight;
		}, 350);
		return () => window.clearTimeout(timer);
		// Once per story.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	// The bar over the preset passage, once the rows have settled.
	useEffect(() => {
		if (!preset) {
			return undefined;
		}
		const inSide = presetRoom !== 'main';
		const timer = window.setTimeout(() => {
			const layer = (
				inSide ? sideRef : contentRef
			).current?.querySelector<HTMLElement>(
				'[data-cy="selection-reply-layer"]'
			);
			const bubble = layer && findMessageBubble(layer, preset.eventId);
			const range = bubble && findPassageRange(bubble, preset.excerpt);
			if (!layer || !range) {
				return;
			}
			bubble!.scrollIntoView({ block: 'center' });
			(inSide ? setSidePresetSelection : setPresetSelection)({
				passage: {
					eventId: preset.eventId,
					author: inSide
						? sideAuthorFor(preset.eventId)
						: authorFor(preset.eventId),
					text: preset.excerpt
				},
				anchor: anchorFor(range.getBoundingClientRect(), layer),
				range
			});
		}, 1000);
		return () => window.clearTimeout(timer);
		// The preset is fixed per story.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	const sendCollected = (target: SideRoom) => (typedText: string) => {
		// FE#2494 *3: each stacked answer keeps its text and voice note.
		const quotes = pending[target].map((quote) => ({
			...quote,
			voice: voiceByQuote.current.get(quote.id) ?? null
		}));
		setSideMessages((all) => ({
			...all,
			[target]: [
				...all[target],
				stackedReply(target, quotes, typedText, String(Date.now()))
			]
		}));
		setPending((all) => ({ ...all, [target]: [] }));
	};

	const removePending = (target: SideRoom) => (id: string) =>
		setPending((all) => ({
			...all,
			[target]: all[target].filter((q) => q.id !== id)
		}));

	/**
	 * The answer joins that chat's composer as one stacked quote — from a
	 * marking inside the chat, or from the client chat via
	 * "In Supervision / Im Team-Chat antworten" (which opens that chat).
	 */
	const collectInSide = (target: SideRoom) => (answer: SelectionAnswer) =>
		setPending((all) => {
			const quote = toQuote(
				{
					eventId: answer.passage.eventId,
					excerpt: answer.passage.text,
					author: answer.passage.author
				},
				all[target].length
			);
			if (answer.voice) {
				voiceByQuote.current.set(quote.id, answer.voice);
			}
			return {
				...all,
				[target]: [
					...all[target],
					{
						...quote,
						replyText: answer.text || undefined,
						voiceDurationSec: answer.voice?.durationSec ?? null
					}
				]
			};
		});

	const sendInSide = (target: SideRoom) => (answer: SelectionAnswer) =>
		setSideMessages((all) => ({
			...all,
			[target]: [
				...all[target],
				stackedReply(
					target,
					[
						{
							eventId: answer.passage.eventId,
							excerpt: answer.passage.text,
							author: answer.passage.author,
							replyText: answer.text,
							voice: answer.voice
						}
					],
					'',
					String(Date.now())
				)
			]
		}));

	function sideAuthorFor(eventId: string) {
		return room
			? sideMessages[room].find((m) => m._id === eventId)?.displayName ||
					''
			: '';
	}

	/**
	 * A quote jumps back to its passage: in the side chat itself when it was
	 * marked there, else in the client chat.
	 */
	const jumpBack = (reply: PassageReply) => {
		const inSide =
			room && sideMessages[room].some((m) => m._id === reply.eventId);
		const target = inSide ? sideRef.current : contentRef.current;
		if (target) {
			jumpToPassage(target, reply.eventId, reply.excerpt, reply.start);
		}
	};

	// *3 (Frank, 24.11.): the Supervision ⋮ also changes the supervisor
	// and books an appointment with them (calendar popup: own session).
	const supervisionMenu: PanelMenuItem[] = [
		{
			'id': 'change',
			'icon': <SupervisionIcon aria-hidden />,
			'title': t('supervision.panel.changeSupervisor'),
			'onClick': noop,
			'data-cy': 'panel-menu-change-supervisor'
		},
		{
			'id': 'appointment',
			'icon': <CalendarPlusIcon aria-hidden />,
			'title': t('supervision.panel.bookAppointment'),
			'onClick': noop,
			'data-cy': 'panel-menu-book-appointment'
		}
	];

	const callActions = (participants: number, menuItems?: PanelMenuItem[]) => (
		<PanelCallActions
			menuItems={menuItems}
			onStartCall={noop}
			participantCount={participants}
			width={panelWidth}
			copy={{
				video: t('videoCall.button.startVideoCall'),
				audio: t('videoCall.button.startCall'),
				menu: t('app.menu'),
				participants: t('chatStage.panel.participantCount', {
					count: participants
				})
			}}
		/>
	);

	const supervisionTitle = t('supervision.panel.title');
	const teamTitle = copy('chatStage.panel.team.title');
	const threadTitle = t('chatStage.panel.thread.title');
	const titleOf = (target: SideRoom) =>
		target === 'supervision'
			? supervisionTitle
			: target === 'team'
				? teamTitle
				: threadTitle;

	const sidePanel = room && (
		<div
			className="chatStage__panel"
			style={{ width: panelWidth }}
			data-side-room={room}
			ref={sideRef}
		>
			<SidePanel
				variant="inside"
				className="chatStage__panel--inside"
				label={t('chatStage.panel.region', { title: titleOf(room) })}
				data-cy="stage-panel"
				header={
					room === 'supervision' ? (
						<PanelHeader
							kind="supervision"
							title={supervisionTitle}
							name={SUPERVISOR_NAME}
							participants={[counsellor, supervisor]}
							actions={callActions(2, supervisionMenu)}
							channels={[]}
							onSelectChannel={noop}
							onClose={() => setRoom(null)}
						/>
					) : room === 'thread' ? (
						<PanelHeader
							kind="thread"
							title={threadTitle}
							name={CLIENT_NAME}
							participants={[counsellor]}
							channels={[]}
							onSelectChannel={noop}
							onClose={() => setRoom(null)}
						/>
					) : (
						<PanelHeader
							kind="team"
							title={teamTitle}
							name={CLIENT_NAME}
							chip={copy('chatStage.panel.team.onlyMarker')}
							participants={[counsellor, teamMateA, teamMateB]}
							// New for *7: group call from the team side chat,
							// the same component as in Supervision.
							actions={callActions(3)}
							channels={[]}
							onSelectChannel={noop}
							onClose={() => setRoom(null)}
						/>
					)
				}
				banner={
					room === 'team' ? (
						<InfoBanner
							title={teamTitle}
							text={copy('chatStage.panel.team.systemNotice')}
						/>
					) : undefined
				}
				timeline={
					// Mark, reply and collect work in every side chat and
					// in a thread too — the same layer as the client chat.
					<SelectionReplyLayer
						key={room}
						authorFor={sideAuthorFor}
						onAddToComposer={collectInSide(room)}
						onSendNow={sendInSide(room)}
						collectedCount={() => pending[room].length}
						recorder={storyRecorder}
						voiceInToolbar={false}
						menu={menu}
						badgeOn={badgeOn}
						initialSelection={sidePresetSelection}
						initialMode={presetMode}
					>
						<MessageTimeline
							keyPrefix={`${room}-`}
							messages={sideMessages[room]}
							renderMode={room === 'thread' ? 'thread' : 'main'}
							threadsEnabled={room === 'thread'}
							threadRootId={
								room === 'thread' ? THREAD_ROOT_ID : undefined
							}
							forceShow={room === 'thread'}
							clientName={
								room === 'supervision'
									? SUPERVISOR_NAME
									: CLIENT_NAME
							}
							askerMatrixUserIdFor={() => CLIENT_MATRIX_ID}
							isMyMessage={isCounsellorMessage}
							onJumpToPassage={jumpBack}
							{...handlers}
						/>
					</SelectionReplyLayer>
				}
				composer={
					<MessageSubmitInterfaceComponent
						key={room}
						placeholder={
							room === 'supervision'
								? t('supervision.panel.composer.placeholder', {
										name: SUPERVISOR_NAME
									})
								: room === 'team'
									? copy(
											'chatStage.panel.team.composer.placeholder'
										)
									: t('message.thread.placeholder')
						}
						targetRoomId={
							room === 'thread' ? undefined : roomIdOf(room)
						}
						threadRootId={
							room === 'thread' ? THREAD_ROOT_ID : undefined
						}
						targetChannelKind={room === 'team' ? 'team' : undefined}
						teamDiscussion={room === 'team'}
						hideSupervisorAudience
						compactHeight
						flushCorner="bottom-right"
						accent={room === 'thread' ? undefined : room}
						pendingQuotes={pending[room]}
						onRemovePendingQuote={removePending(room)}
						onSendPendingQuotes={sendCollected(room)}
						onSendButton={noop}
						isTyping={noop}
						language="de"
					/>
				}
			/>
		</div>
	);

	return (
		<ChatStageProviders>
			<div
				style={{
					height,
					display: 'flex',
					boxSizing: 'border-box',
					background: 'var(--m3-surface-container-high, #eae7e8)'
				}}
			>
				<div
					className="chatStage__detail session__wrapper"
					style={{ flex: 1, display: 'flex', minWidth: 0 }}
				>
					<div
						className={`session chatStage__card${
							room ? ' chatStage__card--split' : ''
						}`}
						tabIndex={-1}
						onMouseDown={focusSessionChromeOnPointerDown}
					>
						<div
							className="chatStage__mainPane"
							data-cy="stage-main"
						>
							<div>
								<SessionHeaderComponent bannedUsers={[]} />
							</div>
							<div
								className="session__content"
								id="session-scroll-container"
								ref={contentRef}
							>
								<SelectionReplyLayer
									authorFor={authorFor}
									onAddToComposer={noop}
									onSendNow={noop}
									onStartThread={() => setRoom('thread')}
									menu={menu}
									badgeOn={badgeOn}
									onReplyInSideRoom={{
										supervision: withSupervision
											? {
													onCollect: (answer) => {
														setRoom('supervision');
														collectInSide(
															'supervision'
														)(answer);
													},
													onSend: (answer) => {
														setRoom('supervision');
														sendInSide(
															'supervision'
														)(answer);
													}
												}
											: undefined,
										team: withTeam
											? {
													onCollect: (answer) => {
														setRoom('team');
														collectInSide('team')(
															answer
														);
													},
													onSend: (answer) => {
														setRoom('team');
														sendInSide('team')(
															answer
														);
													}
												}
											: undefined
									}}
									collectedCount={(target) =>
										target ? pending[target].length : 0
									}
									// *8: the microphone lives in the reply
									// field, the bar drops its voice entry.
									recorder={storyRecorder}
									voiceInToolbar={false}
									initialSelection={presetSelection}
									initialMode={presetMode}
									initialTarget={presetTarget}
								>
									<MessageTimeline
										messages={messages}
										renderMode="main"
										clientName={CLIENT_NAME}
										askerMatrixUserIdFor={() =>
											CLIENT_MATRIX_ID
										}
										isMyMessage={isCounsellorMessage}
										threadsEnabled
										{...handlers}
									/>
								</SelectionReplyLayer>
							</div>
							<MessageSubmitInterfaceComponent
								placeholder={t(
									'enquiry.write.input.placeholder.consultant'
								)}
								hideSupervisorAudience
								compactHeight={Boolean(room)}
								flushCorner={room ? 'bottom-left' : undefined}
								isTyping={noop}
								language="de"
							/>
						</div>
						{sidePanel}
					</div>
				</div>
			</div>
		</ChatStageProviders>
	);
}
