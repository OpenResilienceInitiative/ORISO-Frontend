/**
 * Selection reply, shown in the real chat card: `SessionHeaderComponent`,
 * `MessageTimeline` (the real `MessageItemComponent`), the real composer and,
 * for "Thread starten", the real `SidePanel` + `PanelHeader`. Mark text in a
 * message, then reply (text or voice note), collect the answer in the
 * composer or send it at once, or open a thread on that passage. A sent
 * answer quotes the passage; clicking the quote jumps back to it.
 */
import * as React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { useTranslation } from 'react-i18next';

import { SelectionReplyLayer } from './SelectionReplyLayer';
import type {
	SelectionAnswer,
	SelectionVoiceRecorder
} from './SelectionReplyLayer';
import type { SelectionReplyVoice } from './SelectionReplyPopover';
import { anchorFor, type MarkedPassage } from './useMessageSelection';
import type { MessageSelection } from './useMessageSelection';
import {
	findMessageBubble,
	findPassageRange,
	jumpToPassage,
	paintLivePassage,
	THREAD_HIGHLIGHT
} from './passageRange';
import { SessionHeaderComponent } from '../sessionHeader/SessionHeaderComponent';
import { MessageTimeline } from '../session/MessageTimeline';
import { MessageSubmitInterfaceComponent } from '../messageSubmitInterface/messageSubmitInterfaceComponent';
import type { ComposerPendingQuote } from '../messageSubmitInterface/ComposerPendingQuotes';
import type { PassageReply } from './PassageReplyBlocks';
import { SidePanel } from '../chatStage/SidePanel';
import { PanelHeader } from '../chatStage/PanelHeader';
import { focusSessionChromeOnPointerDown } from '../session/focusSessionChrome';
import { mockE2eeParams } from '../message/MessageItemComponent.mocks';
import type { MessageItem } from '../message/MessageItemComponent';
import type { StackParticipant } from '../message/participantStack';
import { phone390Globals } from '../message/messageStoryShell';
import { createSilentWavUrl } from '../voicePlayer/__storybook__/silentAudio';
import { toMessagePreviewText } from '../../utils/messagePreviewText';
import { ChatStageProviders } from '../chatStage/__storybook__/ChatStageProviders';
import {
	CLIENT_MATRIX_ID,
	CLIENT_NAME,
	CLIENT_ROOM_ID,
	COUNSELLOR_MATRIX_ID,
	COUNSELLOR_NAME,
	isCounsellorMessage,
	mainChatMessages,
	SESSION_ID,
	stageRoute
} from '../chatStage/__storybook__/chatStageFixtures';
import '../message/message.styles.scss';
import '../messageSubmitInterface/messageSubmitInterface.styles.scss';
import '../session/session.styles.scss';
import '../chatStage/chatStage.styles.scss';
import '../chatStage/sidePanel.styles.scss';
import './selectionReply.styles.scss';
import { actWarnings, suspendedInAct } from '../../../.storybook/actWarnings';

const noop = () => {};
const timelineHandlers = {
	handleDecryptionErrors: noop,
	handleDecryptionSuccess: noop,
	e2eeParams: mockE2eeParams()
};

const clientParticipant: StackParticipant = {
	userId: CLIENT_MATRIX_ID,
	username: 'sonnenblume_47',
	displayName: CLIENT_NAME,
	isAsker: true
};
const counsellorParticipant: StackParticipant = {
	userId: COUNSELLOR_MATRIX_ID,
	username: 'mona.s@oriso.invalid',
	displayName: COUNSELLOR_NAME
};

/** The two passages the stories mark. Both are real text of the fixtures. */
const LETTERS_PASSAGE =
	'Es sind ein paar Briefe gekommen, die ich nicht aufgemacht habe.';
const SLEEP_PASSAGE = 'Ich schlafe kaum noch.';
const CONTRACT_PASSAGE = 'Mein Vertrag läuft im Oktober aus';

/** A long client message (seven lines on desktop) for the multi-answer story. */
const LONG_MESSAGE_ID = '$m7';
const LONG_MESSAGE =
	'Ich habe gestern Abend noch einmal alles durchgesehen. Da sind drei Mahnungen vom Inkassobüro, eine vom Stromanbieter und ein Brief vom Amtsgericht, den ich überhaupt nicht verstehe. Ich habe Angst, dass sie mir das Konto sperren, weil mein Lohn darauf eingeht und die Miete am Monatsanfang abgebucht wird. Meine Schwester sagt, ich soll einfach alles auf einmal bezahlen, aber das Geld reicht nicht für alles gleichzeitig. Ich weiß nicht, womit ich anfangen soll. Nachts liege ich wach und rechne immer wieder nach, ob es nicht doch irgendwie aufgeht.';

/** The four answers of the multi-answer story, in the order they are given. */
const LONG_ANSWERS = {
	/** Four lines marked, answered with a voice note, sent at once. */
	debts: 'Da sind drei Mahnungen vom Inkassobüro, eine vom Stromanbieter und ein Brief vom Amtsgericht, den ich überhaupt nicht verstehe. Ich habe Angst, dass sie mir das Konto sperren, weil mein Lohn darauf eingeht und die Miete am Monatsanfang abgebucht wird.',
	/** Answered in text, sent at once. */
	court: 'ein Brief vom Amtsgericht, den ich überhaupt nicht verstehe',
	courtAnswer:
		'Den Brief vom Amtsgericht schauen wir uns zuerst an. Bitte bringen Sie ihn zum Termin mit.',
	/** Answered with a voice note, collected in the composer. */
	sister: 'Meine Schwester sagt, ich soll einfach alles auf einmal bezahlen, aber das Geld reicht nicht für alles gleichzeitig.',
	/** Answered in text, collected; the composer sends both. */
	night: 'Nachts liege ich wach und rechne immer wieder nach',
	nightAnswer:
		'Das klingt erschöpfend. Wir machen zusammen einen Plan, damit Sie nachts nicht mehr rechnen müssen.'
};

/** Recorded lengths the stand-in microphone reports, one per take. */
const LONG_STORY_VOICE_LENGTHS = [48, 35];

const longClientMessage = (): MessageItem => ({
	_id: LONG_MESSAGE_ID,
	message: LONG_MESSAGE,
	messageDate: { str: '', date: null } as MessageItem['messageDate'],
	messageTime: String(new Date('2026-09-04T09:22:00+02:00').getTime()),
	askerMatrixUserId: CLIENT_MATRIX_ID,
	isNotRead: false,
	t: null,
	rid: CLIENT_ROOM_ID,
	displayName: CLIENT_NAME,
	username: 'sonnenblume_47',
	userId: CLIENT_MATRIX_ID
});

/**
 * "Thread starten" opens a thread on the marked message; its composer reads
 * that thread's (empty) draft.
 */
const THREAD_DRAFT_SCOPES = ['$m1', '$m2', '$m4', '$m5', '$m6', '$m7'].flatMap(
	(id) => [
		`scope:${CLIENT_ROOM_ID}|thread:${id}`,
		`scope:${SESSION_ID}|thread:${id}`
	]
);

const at = (hhmm: string) =>
	String(new Date(`2026-09-04T${hhmm}:00+02:00`).getTime());

const nowTime = () => String(Date.now());

/**
 * A counsellor message that answers one or more marked passages, one block
 * each, plus optional free text after them.
 */
const answerMessage = ({
	id,
	replies,
	text,
	time
}: {
	id: string;
	replies: PassageReply[];
	text: string;
	time: string;
}): MessageItem => ({
	_id: id,
	message: text,
	messageDate: { str: '', date: null } as MessageItem['messageDate'],
	messageTime: time,
	askerMatrixUserId: CLIENT_MATRIX_ID,
	isNotRead: false,
	t: null,
	rid: CLIENT_ROOM_ID,
	displayName: COUNSELLOR_NAME,
	username: 'mona.s@oriso.invalid',
	userId: COUNSELLOR_MATRIX_ID,
	passageReplies: replies
});

const replyOf = (answer: SelectionAnswer): PassageReply => ({
	eventId: answer.passage.eventId,
	author: answer.passage.author,
	excerpt: answer.passage.text,
	text: answer.text || undefined,
	voice: answer.voice
});

/**
 * Storybook has no microphone: a stand-in that "records" silence of the
 * same length, so the real VoiceNoteRow and VoicePlayer have audio to play.
 */
const useStoryRecorder = (lengths?: number[]): SelectionVoiceRecorder => {
	const startedAt = useRef(0);
	const take = useRef(0);
	return useMemo(
		() => ({
			start: () => {
				startedAt.current = Date.now();
			},
			stop: async () => {
				// Stories that script takes report fixed lengths; otherwise the
				// take lasts as long as it was held.
				const scripted = lengths?.[take.current++];
				const durationSec =
					scripted ??
					Math.max(
						1,
						Math.round((Date.now() - startedAt.current) / 1000)
					);
				return { src: createSilentWavUrl(durationSec), durationSec };
			},
			cancel: noop
		}),
		// The lengths are fixed per story.
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[]
	);
};

type Preset = {
	eventId: string;
	text: string;
	mode: 'toolbar' | 'popover';
	voice?: SelectionReplyVoice;
};

type StageProps = {
	/** Opens with this passage already marked. */
	preset?: Preset;
	/** Answers already collected in the composer. */
	pending?: ComposerPendingQuote[];
	/** A thread on this passage is open. */
	threadOn?: MarkedPassage;
	/** The chat opens on an earlier answer: passage + voice note. */
	withSentAnswer?: boolean;
	/** The client's last message is a long one (seven lines). */
	withLongMessage?: boolean;
	/** Lengths the stand-in microphone reports, one per take. */
	voiceLengths?: number[];
	height?: number | string;
};

/** The chat card with the selection reply wired in. */
function SelectionReplyStage({
	preset,
	pending: initialPending = [],
	threadOn,
	withSentAnswer = true,
	withLongMessage = false,
	voiceLengths,
	height = '100vh'
}: StageProps) {
	const { t } = useTranslation();
	const recorder = useStoryRecorder(voiceLengths);
	const contentRef = useRef<HTMLDivElement | null>(null);
	const panelRef = useRef<HTMLDivElement | null>(null);
	const sentVoice = useMemo(
		() => ({ src: createSilentWavUrl(42), durationSec: 42 }),
		[]
	);
	const [messages, setMessages] = useState<MessageItem[]>(() => [
		...mainChatMessages(),
		...(withSentAnswer
			? [
					answerMessage({
						id: '$a1',
						replies: [
							{
								eventId: '$m3',
								author: CLIENT_NAME,
								excerpt: LETTERS_PASSAGE,
								voice: sentVoice
							}
						],
						text: '',
						time: at('09:20')
					})
				]
			: []),
		...(withLongMessage ? [longClientMessage()] : [])
	]);
	const [pending, setPending] =
		useState<ComposerPendingQuote[]>(initialPending);
	const [voiceTakes, setVoiceTakes] = useState<
		Record<string, { src: string; durationSec: number }>
	>({});
	const [thread, setThread] = useState<MarkedPassage | null>(
		threadOn || null
	);
	const [presetSelection, setPresetSelection] =
		useState<MessageSelection | null>(null);

	const authorFor = useCallback(
		(eventId: string) =>
			messages.find((m) => m._id === eventId)?.displayName || '',
		[messages]
	);
	const resolveReplyQuote = useCallback(
		(eventId?: string | null) => {
			const quoted = messages.find((m) => m._id === eventId);
			return quoted
				? {
						author: quoted.displayName || '',
						text: toMessagePreviewText(quoted.message)
					}
				: null;
		},
		[messages]
	);

	// The app opens a conversation at its newest message.
	useEffect(() => {
		const content = contentRef.current;
		if (!content) {
			return undefined;
		}
		const toBottom = () => {
			content.scrollTop = content.scrollHeight;
		};
		toBottom();
		const timer = window.setTimeout(toBottom, 350);
		return () => window.clearTimeout(timer);
	}, [messages.length]);

	// Story presets: mark the passage once the rows have settled.
	useEffect(() => {
		if (!preset) {
			return undefined;
		}
		const timer = window.setTimeout(() => {
			const layer = contentRef.current?.querySelector<HTMLElement>(
				'[data-cy="selection-reply-layer"]'
			);
			const bubble = layer && findMessageBubble(layer, preset.eventId);
			const range = bubble && findPassageRange(bubble, preset.text);
			if (!layer || !range) {
				return;
			}
			bubble!.scrollIntoView({ block: 'center' });
			setPresetSelection({
				passage: {
					eventId: preset.eventId,
					author: authorFor(preset.eventId),
					text: preset.text
				},
				anchor: anchorFor(range.getBoundingClientRect(), layer),
				range
			});
		}, 1000);
		return () => window.clearTimeout(timer);
		// The preset is fixed per story.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	// In the thread, the passage stays painted on the root message.
	useEffect(() => {
		if (!thread) {
			return undefined;
		}
		let clear = noop;
		const timer = window.setTimeout(() => {
			if (panelRef.current) {
				clear = paintLivePassage(
					THREAD_HIGHLIGHT,
					panelRef.current,
					thread,
					null
				);
			}
		}, 400);
		return () => {
			window.clearTimeout(timer);
			clear();
		};
	}, [thread]);

	// Sent from the answer field: it takes everything collected so far
	// along, so the answers still leave as one message.
	const sendAnswer = (answer: SelectionAnswer) => {
		sendReplies([...pending.map(collectedReply), replyOf(answer)], '');
	};

	const collectAnswer = (answer: SelectionAnswer) => {
		const id = `q${Date.now()}`;
		if (answer.voice) {
			setVoiceTakes((takes) => ({ ...takes, [id]: answer.voice! }));
		}
		setPending((rows) => [
			...rows,
			{
				id,
				eventId: answer.passage.eventId,
				author: answer.passage.author,
				excerpt: answer.passage.text,
				replyText: answer.text || undefined,
				voiceDurationSec: answer.voice?.durationSec ?? null
			}
		]);
	};

	const collectedReply = (quote: ComposerPendingQuote): PassageReply => ({
		eventId: quote.eventId,
		author: quote.author,
		excerpt: quote.excerpt,
		text: quote.replyText,
		voice: voiceTakes[quote.id] || null
	});

	const sendReplies = (replies: PassageReply[], text: string) => {
		setMessages((rows) => [
			...rows,
			answerMessage({
				id: `$a${rows.length + 1}`,
				replies,
				text,
				time: nowTime()
			})
		]);
		setPending([]);
	};

	// The composer's send: all collected answers and the typed text leave
	// as ONE message.
	const sendCollected = (typedText: string) => {
		if (pending.length) {
			sendReplies(pending.map(collectedReply), typedText);
		}
	};

	const jumpBack = (reply: PassageReply) => {
		if (contentRef.current) {
			jumpToPassage(contentRef.current, reply.eventId, reply.excerpt);
		}
	};

	const threadRoot = thread
		? messages.find((m) => m._id === thread.eventId)
		: undefined;

	return (
		<ChatStageProviders extraEmptyDraftScopes={THREAD_DRAFT_SCOPES}>
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
							thread ? ' chatStage__card--split' : ''
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
									onAddToComposer={collectAnswer}
									onSendNow={sendAnswer}
									onStartThread={setThread}
									recorder={recorder}
									initialSelection={presetSelection}
									initialMode={preset?.mode}
									initialVoice={preset?.voice}
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
										onOpenThread={(message) =>
											setThread({
												eventId: message._id,
												author:
													message.displayName || '',
												text: toMessagePreviewText(
													message.message
												)
											})
										}
										resolveReplyQuote={resolveReplyQuote}
										onJumpToPassage={jumpBack}
										{...timelineHandlers}
									/>
								</SelectionReplyLayer>
							</div>
							<MessageSubmitInterfaceComponent
								placeholder={t(
									'enquiry.write.input.placeholder.consultant'
								)}
								hideSupervisorAudience
								compactHeight={Boolean(thread)}
								flushCorner={thread ? 'bottom-left' : undefined}
								pendingQuotes={pending}
								onRemovePendingQuote={(id) =>
									setPending((rows) =>
										rows.filter((row) => row.id !== id)
									)
								}
								onSendPendingQuotes={sendCollected}
								isTyping={noop}
								language="de"
							/>
						</div>
						{thread && threadRoot && (
							<div
								className="chatStage__panel"
								style={{ width: 400 }}
								ref={panelRef}
							>
								<SidePanel
									variant="inside"
									className="chatStage__panel--inside"
									label={t('chatStage.panel.region', {
										title: t('chatStage.panel.thread.title')
									})}
									data-cy="selection-thread-panel"
									header={
										<PanelHeader
											kind="thread"
											title={t(
												'chatStage.panel.thread.title'
											)}
											name={CLIENT_NAME}
											participants={[
												clientParticipant,
												counsellorParticipant
											]}
											channels={[]}
											activeChannelId={thread.eventId}
											onSelectChannel={noop}
											onClose={() => setThread(null)}
										/>
									}
									timeline={
										<MessageTimeline
											messages={[threadRoot]}
											renderMode="thread"
											threadsEnabled
											threadRootId={thread.eventId}
											forceShow
											clientName={CLIENT_NAME}
											isMyMessage={isCounsellorMessage}
											{...timelineHandlers}
										/>
									}
									composer={
										<MessageSubmitInterfaceComponent
											placeholder={t(
												'message.thread.placeholder'
											)}
											threadRootId={thread.eventId}
											threadParentPreview={thread.text}
											compactHeight
											flushCorner="bottom-right"
											onSendButton={noop}
											isTyping={noop}
											language="de"
										/>
									}
								/>
							</div>
						)}
					</div>
				</div>
			</div>
		</ChatStageProviders>
	);
}

const meta = {
	title: 'Components/Chat/SelectionReply',
	component: SelectionReplyStage,
	parameters: {
		layout: 'fullscreen',
		router: { initialPath: stageRoute },
		docs: {
			description: {
				component:
					'Markieren und gezielt antworten. Text in einer Nachricht markieren → Leiste „Antworten · Sprachnachricht · Thread starten“. Das Antwort-Feld zeigt die markierte Stelle; Enter legt die Antwort als eigene, nummerierte Antwort-Leiste in die Eingabe, Cmd/Strg + Enter sendet sofort. Sprachnachrichten werden nicht transkribiert. Die gesendete Antwort zitiert die Stelle; ein Klick auf das Zitat springt zurück und lässt die Stelle kurz aufleuchten. Gebaut aus den echten Organismen: MessageTimeline, Composer (ComposerContextBar), VoiceNoteRow, SendButton, SidePanel.'
			}
		}
	}
} satisfies Meta<typeof SelectionReplyStage>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Zum Durchklicken: markieren, antworten, sammeln, senden, zurückspringen. */
export const Experience: Story = {
	name: 'Erlebnis — markieren, antworten, zurückspringen'
};

/** 1 · Text markiert: die Leiste steht über der Stelle, Thread zuletzt. */
export const Toolbar: Story = {
	name: '1 · Leiste über der markierten Stelle',
	args: {
		preset: { eventId: '$m5', text: SLEEP_PASSAGE, mode: 'toolbar' }
	},
	play: async ({ canvasElement }) => {
		const bar = await waitFor(
			() => {
				const found = canvasElement.querySelector<HTMLElement>(
					'[data-cy="selection-reply-toolbar"]'
				);
				if (!found) {
					throw new Error('toolbar not shown');
				}
				return found;
			},
			{ timeout: 3000 }
		);
		const buttons = within(bar).getAllByRole('button');
		await expect(buttons[0]).toHaveTextContent('Antworten');
		await expect(buttons[buttons.length - 1]).toHaveTextContent(
			'Thread starten'
		);
	}
};

/** 2 · Antwort-Feld: Zitat, Eingabe, Mikrofon, zur Eingabe (↵) und Senden (⌘↵). */
export const Popover: Story = {
	name: '2 · Antwort-Feld unter der Stelle',
	args: {
		preset: { eventId: '$m5', text: SLEEP_PASSAGE, mode: 'popover' }
	}
};

/** 3 · Mit Sprachnachricht antworten: Aufnahme läuft im Antwort-Feld. */
export const PopoverRecording: Story = {
	name: '3 · Sprachnachricht — Aufnahme läuft',
	args: {
		preset: {
			eventId: '$m5',
			text: SLEEP_PASSAGE,
			mode: 'popover',
			voice: { mode: 'recording', durationSec: 7 }
		}
	}
};

/** 4 · Aufnahme gestoppt: anhören, verwerfen, Text optional dazu. */
export const PopoverVoiceReview: Story = {
	name: '4 · Sprachnachricht — prüfen, dann senden',
	args: {
		preset: {
			eventId: '$m5',
			text: SLEEP_PASSAGE,
			mode: 'popover',
			voice: {
				mode: 'review',
				src: createSilentWavUrl(7),
				durationSec: 7
			}
		}
	}
};

/** 5 · Zwei Antworten gesammelt: je eine nummerierte Antwort-Leiste in der Eingabe. */
export const CollectedInComposer: Story = {
	name: '5 · Eingabe sammelt zwei Antworten',
	args: {
		pending: [
			{
				id: 'q1',
				eventId: '$m5',
				author: CLIENT_NAME,
				excerpt: CONTRACT_PASSAGE,
				replyText: 'Wissen Sie, wer im Betrieb das entscheidet?'
			},
			{
				id: 'q2',
				eventId: '$m5',
				author: CLIENT_NAME,
				excerpt: SLEEP_PASSAGE,
				voiceDurationSec: 18
			}
		]
	},
	play: async ({ canvasElement }) => {
		const stack = await waitFor(() => {
			const found = canvasElement.querySelector<HTMLElement>(
				'[data-cy="composer-pending-quotes"]'
			);
			if (!found) {
				throw new Error('pending quotes not shown');
			}
			return found;
		});
		const bars = stack.querySelectorAll('.messageSubmit__contextBar');
		await expect(bars).toHaveLength(2);
		// The editor starts below the last bar, never under it.
		const editor = canvasElement.querySelector<HTMLElement>(
			'.chatStage__mainPane .textarea__input'
		)!;
		await waitFor(() =>
			expect(bars[1].getBoundingClientRect().bottom).toBeLessThanOrEqual(
				editor.getBoundingClientRect().top + 1
			)
		);
	}
};

/** 6 · Gesendet: das Zitat steht über der Sprachnachricht; Klick springt zur Stelle. */
export const JumpBack: Story = {
	name: '6 · Zitat anklicken springt zur Stelle',
	play: async ({ canvasElement }) => {
		const quote = await waitFor(() => {
			const found = canvasElement.querySelector<HTMLElement>(
				'[data-cy="reply-quote-jump"]'
			);
			if (!found) {
				throw new Error('quote button not shown');
			}
			return found;
		});
		// Let the stage settle on the newest message first, as a reader would.
		await new Promise((resolve) => window.setTimeout(resolve, 800));
		await userEvent.click(quote);
		await waitFor(() =>
			expect(
				canvasElement.querySelector(
					'[data-message-id="$m3"] .messageItem__message--jumpTarget'
				)
			).toBeTruthy()
		);
	}
};

/** 7 · Thread starten: der Thread öffnet rechts, die Stelle bleibt markiert. */
export const ThreadFromPassage: Story = {
	name: '7 · Thread aus der markierten Stelle',
	args: {
		threadOn: { eventId: '$m5', author: CLIENT_NAME, text: SLEEP_PASSAGE }
	}
};

/** Telefon: Leiste und Antwort-Feld passen in 390 px. */
export const PhonePopover: Story = {
	name: 'Telefon 390 — Antwort-Feld',
	globals: phone390Globals,
	args: {
		preset: { eventId: '$m5', text: SLEEP_PASSAGE, mode: 'popover' }
	}
};

/* ---------------------------------------------------------------------------
 * Four answers to one long message, driven through the real flow: mark text
 * (a native selection in the bubble), the bar, the answer field, the stand-in
 * microphone, "Zur Eingabe" and both send paths.
 * ------------------------------------------------------------------------- */

/** Waits until `find` returns an element, then hands it back. */
const waitForElement = async <T extends Element>(
	find: () => T | null | undefined,
	what: string
): Promise<T> => {
	await waitFor(
		() => {
			if (!find()) {
				throw new Error(`${what} not shown`);
			}
		},
		{ timeout: 4000 }
	);
	return find()!;
};

/** Marks `text` in message `eventId` the way a mouse drag does. */
const markPassage = async (
	canvasElement: HTMLElement,
	eventId: string,
	text: string
) => {
	const layer = canvasElement.querySelector<HTMLElement>(
		'[data-cy="selection-reply-layer"]'
	)!;
	const bubble = await waitForElement(
		() => findMessageBubble(layer, eventId),
		`message ${eventId}`
	);
	// Long messages arrive shortened; the reader opens them before marking.
	const expand = bubble.querySelector<HTMLButtonElement>(
		'.messageItem__expandBtn[aria-expanded="false"]'
	);
	if (expand && !findPassageRange(bubble, text)) {
		expand.click();
	}
	await waitFor(() =>
		expect(
			findPassageRange(bubble, text),
			`passage in ${eventId}`
		).toBeTruthy()
	);
	bubble.scrollIntoView({ block: 'center' });
	const range = findPassageRange(bubble, text);
	const selection = window.getSelection()!;
	selection.removeAllRanges();
	selection.addRange(range!);
	layer.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
	return waitForElement(
		() =>
			canvasElement.querySelector<HTMLElement>(
				'[data-cy="selection-reply-toolbar"]'
			),
		'selection bar'
	);
};

const openAnswerField = (canvasElement: HTMLElement) =>
	waitForElement(
		() =>
			canvasElement.querySelector<HTMLElement>(
				'[data-cy="selection-reply-popover"]'
			),
		'answer field'
	);

/** Records a take in the open answer field and stops it. */
const recordTake = async (field: HTMLElement) => {
	const stop = await waitForElement(
		() =>
			field.querySelector<HTMLButtonElement>(
				'.voiceRecordingBar button, .voicePlayer--composer button'
			),
		'stop button'
	);
	stop.click();
	await waitForElement(() => field.querySelector('audio'), 'voice review');
};

const answerRows = (canvasElement: HTMLElement) =>
	Array.from(
		canvasElement.querySelectorAll<HTMLElement>(
			'.chatStage__mainPane [data-message-id^="$a"]'
		)
	);

/**
 * 8 · Vier Stellen, eine Nachricht: four passages of one long message are
 * marked and commented one after another (voice, text, voice, text) and
 * leave together as ONE message.
 */
export const FourAnswersLongMessage: Story = {
	name: '8 · Vier Stellen, eine Nachricht',
	args: {
		withSentAnswer: false,
		withLongMessage: true,
		voiceLengths: LONG_STORY_VOICE_LENGTHS
	},
	parameters: {
		verification: {
			// The composer re-reads its audience (who can see the message)
			// each time a passage joins it, outside act(): once per passage.
			// Browser behaviour, counted exactly so any further warning
			// still fails.
			expectedErrors: [
				...actWarnings({ MessageSubmitInterfaceComponent: 4 }),
				// A lazily loaded piece of the sent answer mounts once.
				...suspendedInAct(1)
			]
		}
	},
	play: async ({ canvasElement }) => {
		await playFourPassages(canvasElement);
	}
};

const pressAnswer = (bar: HTMLElement) =>
	within(bar)
		.getByRole('button', { name: /Antworten/ })
		.click();

const pressVoice = (bar: HTMLElement) =>
	within(bar)
		.getByRole('button', { name: 'Mit Sprachnachricht antworten' })
		.click();

const collectFromField = async (field: HTMLElement) => {
	await userEvent.click(
		field.querySelector<HTMLButtonElement>(
			'[data-cy="selection-reply-collect"]'
		)!
	);
};

const collectedBars = (canvasElement: HTMLElement) =>
	canvasElement.querySelectorAll(
		'[data-cy="composer-pending-quotes"] .messageSubmit__contextBar'
	);

const playFourPassages = async (canvasElement: HTMLElement) => {
	// Let the stage settle first: the composer refreshes its audience
	// 0.7 s and 1.8 s after it opens (messageSubmitInterfaceComponent).
	await new Promise((resolve) => window.setTimeout(resolve, 2000));

	// 1 · Four lines (opens the shortened message) → voice note → "+".
	let field = await markPassage(
		canvasElement,
		LONG_MESSAGE_ID,
		LONG_ANSWERS.debts
	).then(async (bar) => {
		pressVoice(bar);
		return openAnswerField(canvasElement);
	});
	await recordTake(field);
	await collectFromField(field);
	await waitFor(() => expect(collectedBars(canvasElement)).toHaveLength(1));

	// 2 · A short passage → text → Enter.
	pressAnswer(
		await markPassage(canvasElement, LONG_MESSAGE_ID, LONG_ANSWERS.court)
	);
	field = await openAnswerField(canvasElement);
	await userEvent.type(
		within(field).getByRole('textbox'),
		`${LONG_ANSWERS.courtAnswer}{Enter}`
	);
	await waitFor(() => expect(collectedBars(canvasElement)).toHaveLength(2));

	// 3 · Voice note → "+".
	pressVoice(
		await markPassage(canvasElement, LONG_MESSAGE_ID, LONG_ANSWERS.sister)
	);
	field = await openAnswerField(canvasElement);
	await recordTake(field);
	await collectFromField(field);
	await waitFor(() => expect(collectedBars(canvasElement)).toHaveLength(3));

	// 4 · Text → Enter.
	pressAnswer(
		await markPassage(canvasElement, LONG_MESSAGE_ID, LONG_ANSWERS.night)
	);
	field = await openAnswerField(canvasElement);
	await userEvent.type(
		within(field).getByRole('textbox'),
		`${LONG_ANSWERS.nightAnswer}{Enter}`
	);
	await waitFor(() => expect(collectedBars(canvasElement)).toHaveLength(4));
	await expect(answerRows(canvasElement)).toHaveLength(0);

	// One send: all four leave together.
	const composerSend = canvasElement.querySelector<HTMLButtonElement>(
		'.chatStage__mainPane .textarea__buttons button'
	)!;
	await waitFor(() => expect(composerSend).toBeEnabled());
	await userEvent.click(composerSend);
	await waitFor(() => expect(answerRows(canvasElement)).toHaveLength(1));
	await expect(collectedBars(canvasElement)).toHaveLength(0);

	// The one message holds the four passages in order, each with its
	// voice note or text.
	const blocks = Array.from(
		answerRows(canvasElement)[0].querySelectorAll<HTMLElement>(
			'[data-cy="passage-reply"]'
		)
	);
	await expect(blocks).toHaveLength(4);
	const expected = [
		{ passage: LONG_ANSWERS.debts, voice: true, text: '' },
		{
			passage: LONG_ANSWERS.court,
			voice: false,
			text: LONG_ANSWERS.courtAnswer
		},
		{ passage: LONG_ANSWERS.sister, voice: true, text: '' },
		{
			passage: LONG_ANSWERS.night,
			voice: false,
			text: LONG_ANSWERS.nightAnswer
		}
	];
	for (const [index, block] of blocks.entries()) {
		const quote = block.querySelector<HTMLElement>(
			'[data-cy="reply-quote-jump"]'
		);
		await expect(quote?.textContent).toContain(
			expected[index].passage.slice(0, 30)
		);
		await expect(Boolean(block.querySelector('audio'))).toBe(
			expected[index].voice
		);
		if (expected[index].text) {
			await expect(block.textContent).toContain(expected[index].text);
		}
	}

	// Four marked lines stay a two-line quote.
	const longQuote = blocks[0].querySelector<HTMLElement>(
		'.messageItem__replyQuoteText'
	)!;
	await expect(longQuote.scrollHeight).toBeGreaterThan(
		longQuote.clientHeight + 1
	);

	// Fold the long message again, as after a reload: the first quote
	// still finds its four lines and opens the message for them.
	findMessageBubble(canvasElement, LONG_MESSAGE_ID)!
		.querySelector<HTMLButtonElement>(
			'.messageItem__expandBtn[aria-expanded="true"]'
		)
		?.click();
	await waitFor(() =>
		expect(
			findPassageRange(
				findMessageBubble(canvasElement, LONG_MESSAGE_ID)!,
				LONG_ANSWERS.debts
			)
		).toBeNull()
	);
	blocks[0]
		.querySelector<HTMLElement>('[data-cy="reply-quote-jump"]')!
		.click();
	await waitFor(() =>
		expect(
			canvasElement.querySelector(
				`[data-message-id="${LONG_MESSAGE_ID}"] .messageItem__message--jumpTarget`
			)
		).toBeTruthy()
	);
	await waitFor(() =>
		expect(
			findPassageRange(
				findMessageBubble(canvasElement, LONG_MESSAGE_ID)!,
				LONG_ANSWERS.debts
			)
		).toBeTruthy()
	);
};

/**
 * 9 · Sofort senden nimmt Gesammeltes mit: with two answers already
 * collected, Cmd/Ctrl + Enter in the answer field sends all three together
 * as one message.
 */
export const SendNowTakesCollected: Story = {
	name: '9 · Sofort senden nimmt Gesammeltes mit',
	args: {
		withSentAnswer: false,
		pending: CollectedInComposer.args!.pending
	},
	parameters: {
		verification: {
			// Same composer audience refresh as in story 8.
			expectedErrors: [
				...actWarnings({ MessageSubmitInterfaceComponent: 2 })
			]
		}
	},
	play: async ({ canvasElement }) => {
		await new Promise((resolve) => window.setTimeout(resolve, 2000));
		await waitFor(() =>
			expect(collectedBars(canvasElement)).toHaveLength(2)
		);
		pressAnswer(await markPassage(canvasElement, '$m3', LETTERS_PASSAGE));
		const field = await openAnswerField(canvasElement);
		await userEvent.type(
			within(field).getByRole('textbox'),
			'Die Briefe sortieren wir am Donnerstag.{Meta>}{Enter}{/Meta}'
		);
		await waitFor(() => expect(answerRows(canvasElement)).toHaveLength(1));
		await expect(collectedBars(canvasElement)).toHaveLength(0);
		const blocks = answerRows(canvasElement)[0].querySelectorAll(
			'[data-cy="passage-reply"]'
		);
		await expect(blocks).toHaveLength(3);
		await expect(blocks[2].textContent).toContain(
			'Die Briefe sortieren wir am Donnerstag.'
		);
	}
};
