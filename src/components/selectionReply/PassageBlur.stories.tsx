/**
 * Blur a passage (moderators). Mark text in a message → the selection bar
 * offers "Schwärzen" next to reply, voice and thread. The passage turns
 * into blurred random characters for everyone; the real words are no longer
 * in the page. A moderator clicks the blurred passage → "Wieder lesbar
 * machen". Built from the real organisms: MessageTimeline,
 * SelectionReplyLayer and its bar, in the real chat card.
 *
 * Storybook only so far: the blur will be a Matrix annotation event next to
 * the message (decided 12 Nov 2026), wired once the quote reply is live.
 */
import * as React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';

import { SelectionReplyLayer } from './SelectionReplyLayer';
import { anchorFor, type MessageSelection } from './useMessageSelection';
import { findMessageBubble, findPassageRange } from './passageRange';
import type { PassageBlur } from './passageBlur';
import { SessionHeaderComponent } from '../sessionHeader/SessionHeaderComponent';
import { MessageTimeline } from '../session/MessageTimeline';
import { mockE2eeParams } from '../message/MessageItemComponent.mocks';
import type { MessageItem } from '../message/MessageItemComponent';
import { phone390Globals } from '../message/messageStoryShell';
import { ChatStageProviders } from '../chatStage/__storybook__/ChatStageProviders';
import {
	CLIENT_MATRIX_ID,
	CLIENT_NAME,
	CLIENT_ROOM_ID,
	COUNSELLOR_NAME,
	isCounsellorMessage,
	mainChatMessages,
	stageRoute
} from '../chatStage/__storybook__/chatStageFixtures';
import '../message/message.styles.scss';
import '../session/session.styles.scss';
import '../chatStage/chatStage.styles.scss';
import './selectionReply.styles.scss';

const noop = () => {};
/** Storybook has no microphone; the bar only needs one to show the button. */
const storyRecorder = {
	start: noop,
	stop: async () => ({ src: '', durationSec: 1 }),
	cancel: noop
};
const timelineHandlers = {
	handleDecryptionErrors: noop,
	handleDecryptionSuccess: noop,
	e2eeParams: mockE2eeParams()
};

/** A client message with details that should not stay readable. */
const SENSITIVE_ID = '$b1';
const SENSITIVE_MESSAGE =
	'Ich heiße Anna Berger und wohne in der Lindenstraße 4 in Freiburg, meine Handynummer ist 0171 2345678. Bitte rufen Sie mich nicht vor 18 Uhr an, mein Mann darf davon nichts wissen.';
const SENSITIVE_PASSAGE =
	'Anna Berger und wohne in der Lindenstraße 4 in Freiburg, meine Handynummer ist 0171 2345678';
const SECOND_PASSAGE = 'mein Mann darf davon nichts wissen';

const sensitiveMessage = (): MessageItem => ({
	_id: SENSITIVE_ID,
	message: SENSITIVE_MESSAGE,
	messageDate: { str: '', date: null } as MessageItem['messageDate'],
	messageTime: String(new Date('2026-09-04T09:24:00+02:00').getTime()),
	askerMatrixUserId: CLIENT_MATRIX_ID,
	isNotRead: false,
	t: null,
	rid: CLIENT_ROOM_ID,
	displayName: CLIENT_NAME,
	username: 'sonnenblume_47',
	userId: CLIENT_MATRIX_ID
});

/** A blur over `passage` of a plain-text fixture message. */
const blurOver = (text: string, passage: string, id: string): PassageBlur => {
	const collapsed = text.replace(/\s+/g, ' ').trim();
	return { id, start: collapsed.indexOf(passage), length: passage.length };
};

type StageProps = {
	/** The viewer may blur and remove blurs (counsellor / group moderator). */
	moderator?: boolean;
	/** Passages blurred when the story opens. */
	blurred?: string[];
	/** Opens with this passage marked and the bar showing. */
	markPassage?: string;
	/** Opens with the moderator's bar on the first blurred passage. */
	openRemoveBar?: boolean;
	height?: number | string;
};

/** The chat card with blur wired in. */
function PassageBlurStage({
	moderator = true,
	blurred = [],
	markPassage,
	openRemoveBar = false,
	height = '100vh'
}: StageProps) {
	const contentRef = useRef<HTMLDivElement | null>(null);
	// Blurs per message, like the annotations collected per event id.
	const [blursById, setBlursById] = useState<Record<string, PassageBlur[]>>(
		() => ({
			[SENSITIVE_ID]: blurred.map((passage, index) =>
				blurOver(SENSITIVE_MESSAGE, passage, `blur-${index + 1}`)
			)
		})
	);
	const blurs = blursById[SENSITIVE_ID] ?? [];
	const [preset, setPreset] = useState<MessageSelection | null>(null);
	const messages: MessageItem[] = [
		...mainChatMessages(),
		sensitiveMessage()
	].map((message) => ({
		...message,
		passageBlurs: blursById[message._id] ?? null
	}));

	const authorFor = useCallback(
		(eventId: string) =>
			messages.find((m) => m._id === eventId)?.displayName || '',
		// Authors never change in this story.
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[]
	);

	// The app opens a conversation at its newest message.
	useEffect(() => {
		const content = contentRef.current;
		if (content) {
			content.scrollTop = content.scrollHeight;
		}
	}, []);

	// Story preset: mark the passage once the rows have settled.
	useEffect(() => {
		if (!markPassage) {
			return undefined;
		}
		const timer = window.setTimeout(() => {
			const layer = contentRef.current?.querySelector<HTMLElement>(
				'[data-cy="selection-reply-layer"]'
			);
			const bubble = layer && findMessageBubble(layer, SENSITIVE_ID);
			const range = bubble && findPassageRange(bubble, markPassage);
			if (!layer || !range) {
				return;
			}
			bubble!.scrollIntoView({ block: 'center' });
			setPreset({
				passage: {
					eventId: SENSITIVE_ID,
					author: CLIENT_NAME,
					text: markPassage
				},
				anchor: anchorFor(range.getBoundingClientRect(), layer),
				range
			});
		}, 800);
		return () => window.clearTimeout(timer);
	}, [markPassage]);

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
					<div className="session chatStage__card" tabIndex={-1}>
						<div className="chatStage__mainPane">
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
									onStartThread={noop}
									recorder={storyRecorder}
									onBlurPassage={
										moderator
											? (passage, position) => {
													setPreset(null);
													setBlursById((rows) => ({
														...rows,
														[passage.eventId]: [
															...(rows[
																passage.eventId
															] ?? []),
															{
																id: `blur-${Date.now()}`,
																...position
															}
														]
													}));
												}
											: undefined
									}
									onRemoveBlur={
										moderator
											? (eventId, blurId) =>
													setBlursById((rows) => ({
														...rows,
														[eventId]: (
															rows[eventId] ?? []
														).filter(
															(row) =>
																row.id !==
																blurId
														)
													}))
											: undefined
									}
									blurredByFor={() => COUNSELLOR_NAME}
									initialSelection={preset}
									initialMode="toolbar"
									initialBlurTarget={
										openRemoveBar && blurs[0]
											? {
													eventId: SENSITIVE_ID,
													blurId: blurs[0].id
												}
											: null
									}
								>
									<MessageTimeline
										messages={messages}
										renderMode="main"
										clientName={CLIENT_NAME}
										askerMatrixUserIdFor={() =>
											CLIENT_MATRIX_ID
										}
										isMyMessage={isCounsellorMessage}
										canRemovePassageBlur={moderator}
										{...timelineHandlers}
									/>
								</SelectionReplyLayer>
							</div>
						</div>
					</div>
				</div>
			</div>
		</ChatStageProviders>
	);
}

const meta = {
	title: 'Components/Chat/SelectionReply/Blur',
	component: PassageBlurStage,
	parameters: {
		layout: 'fullscreen',
		router: { initialPath: stageRoute },
		docs: {
			description: {
				component:
					'Stellen schwärzen (nur Moderation: Beratende im Einzelchat, Moderierende im Gruppenchat). Text markieren → Leiste mit Symbolen „Antworten · Sprachnachricht · Thread | Schwärzen“; der Name steht beim Hovern oder Fokussieren darüber. Die Stelle wird für alle zu verwischtem Zahlensalat: die echten Wörter stehen nicht mehr in der Seite. Moderierende klicken die Stelle an → „Schwärzung aufheben“. Gespeichert wird nur die Position, nie der Text (Matrix-Ereignis neben der Nachricht, entschieden am 12.11.2026).'
			}
		}
	}
} satisfies Meta<typeof PassageBlurStage>;

export default meta;
type Story = StoryObj<typeof meta>;

const TOOLBAR = {
	de: 'Aktionen für die markierte Stelle',
	en: 'Actions for the marked passage'
};
const BLUR_BAR = {
	de: 'Aktionen für die geschwärzte Stelle',
	en: 'Actions for the blurred passage'
};
const WAIT = { timeout: 3000 };

const blurredPieces = (canvasElement: HTMLElement) =>
	Array.from(
		canvasElement.querySelectorAll<HTMLElement>(
			`[data-message-id="${SENSITIVE_ID}"] .passageBlur`
		)
	);

const bubbleText = (canvasElement: HTMLElement) =>
	canvasElement.querySelector(
		`[data-message-id="${SENSITIVE_ID}"] .messageItem__message`
	)?.textContent || '';

/** Zum Durchklicken: markieren, schwärzen, Schwärzung aufheben. */
export const Experience: Story = {
	name: 'Erlebnis — markieren, schwärzen, aufheben'
};

/** 1 · Text markiert: Symbole Antworten · Sprachnachricht · Thread · Schwärzen; der Name erscheint beim Hovern. */
export const MenuWithBlur: Story = {
	name: '1 · Leiste mit „Schwärzen“',
	args: { markPassage: SENSITIVE_PASSAGE },
	play: async ({ canvasElement }) => {
		const bar = await within(canvasElement).findByRole(
			'toolbar',
			{ name: TOOLBAR.de },
			WAIT
		);
		const buttons = within(bar).getAllByRole('button');
		await expect(buttons[buttons.length - 1]).toHaveAccessibleName(
			'Schwärzen'
		);
		await expect(
			bar.querySelector('.selectionReply__blurIcon')
		).not.toBeNull();
	}
};

/** 2 · Geschwärzt: so sehen es alle. Die Wörter sind nicht mehr in der Seite. */
export const BlurredForEveryone: Story = {
	name: '2 · Geschwärzte Stelle — so sehen es alle',
	args: { moderator: false, blurred: [SENSITIVE_PASSAGE] },
	play: async ({ canvasElement }) => {
		await waitFor(
			() =>
				expect(blurredPieces(canvasElement).length).toBeGreaterThan(0),
			WAIT
		);
		const pieces = blurredPieces(canvasElement);
		const text = bubbleText(canvasElement);
		await expect(text).not.toContain('Lindenstraße');
		await expect(text).not.toContain('0171');
		await expect(text).toContain('Bitte rufen Sie mich');
		pieces.forEach((piece) =>
			expect(piece).toHaveAttribute('aria-hidden', 'true')
		);
		// Readers get one label instead of the salad; no remove action.
		await expect(
			canvasElement.querySelector('.passageBlur__srLabel')
		).toHaveTextContent('Geschwärzte Stelle');
		await expect(
			canvasElement.querySelector('.passageBlur--removable')
		).toBeNull();
	}
};

/** 3 · Zwei Stellen in einer Nachricht. */
export const TwoPassages: Story = {
	name: '3 · Zwei Stellen in einer Nachricht',
	args: { moderator: false, blurred: [SENSITIVE_PASSAGE, SECOND_PASSAGE] },
	play: async ({ canvasElement }) => {
		await waitFor(
			() =>
				expect(blurredPieces(canvasElement).length).toBeGreaterThan(0),
			WAIT
		);
		await expect(bubbleText(canvasElement)).not.toContain('mein Mann');
		await expect(
			canvasElement.querySelectorAll('.passageBlur__srLabel')
		).toHaveLength(2);
	}
};

/** 4 · Moderation: Stelle anklicken → „Wieder lesbar machen“. */
export const ModeratorRemoves: Story = {
	name: '4 · Moderation hebt die Schwärzung auf',
	args: { blurred: [SENSITIVE_PASSAGE], openRemoveBar: true },
	play: async ({ canvasElement }) => {
		const bar = await within(canvasElement).findByRole(
			'toolbar',
			{ name: BLUR_BAR.de },
			WAIT
		);
		await expect(bar).toHaveTextContent(
			`Geschwärzt von ${COUNSELLOR_NAME}`
		);
		await expect(
			within(bar).getByRole('button', { name: 'Schwärzung aufheben' })
		).toBeVisible();
	}
};

/** Der ganze Weg als Test: Leiste → schwärzen → anklicken → aufheben. */
export const FullFlow: Story = {
	name: '5 · Ablauf: schwärzen und wieder aufheben',
	args: { markPassage: SENSITIVE_PASSAGE },
	play: async ({ canvasElement }) => {
		const bar = await within(canvasElement).findByRole(
			'toolbar',
			{ name: TOOLBAR.de },
			WAIT
		);
		await userEvent.click(
			within(bar).getByRole('button', { name: 'Schwärzen' })
		);
		await waitFor(
			() =>
				expect(blurredPieces(canvasElement).length).toBeGreaterThan(0),
			WAIT
		);
		const pieces = blurredPieces(canvasElement);
		await expect(bubbleText(canvasElement)).not.toContain('Anna Berger');

		// Keyboard: the blurred passage is a button for moderators.
		await expect(pieces[0]).toHaveAttribute('role', 'button');
		// Hover must not unblur it: the global [role=button]:hover colour
		// once painted the salad sharp and red. Play events cannot enter
		// :hover, so a rule like it is forced on: the fill must stay clear.
		const hoverColour = document.createElement('style');
		hoverColour.textContent =
			'.passageBlur[role="button"] { color: #a31816 !important; }';
		document.head.appendChild(hoverColour);
		try {
			await expect(
				getComputedStyle(pieces[0]).getPropertyValue(
					'-webkit-text-fill-color'
				)
			).toBe('rgba(0, 0, 0, 0)');
		} finally {
			hoverColour.remove();
		}
		await userEvent.click(pieces[0]);
		const removeBar = await within(canvasElement).findByRole(
			'toolbar',
			{ name: BLUR_BAR.de },
			WAIT
		);
		await userEvent.click(
			within(removeBar).getByRole('button', {
				name: 'Schwärzung aufheben'
			})
		);
		await waitFor(() =>
			expect(bubbleText(canvasElement)).toContain('Anna Berger')
		);
		await expect(
			canvasElement.querySelector('[data-cy="passage-blur-bar"]')
		).toBeNull();
	}
};

/* ── 390 px, dark, English ──────────────────────────────────────────── */

export const PhoneMenu: Story = {
	name: 'Telefon 390 — Leiste',
	args: { markPassage: SENSITIVE_PASSAGE },
	globals: phone390Globals,
	play: async ({ canvasElement }) => {
		const bar = await within(canvasElement).findByRole(
			'toolbar',
			{ name: TOOLBAR.de },
			WAIT
		);
		const blur = within(bar).getByRole('button', {
			name: 'Schwärzen'
		});
		const box = bar.getBoundingClientRect();
		await expect(box.left).toBeGreaterThanOrEqual(0);
		await expect(box.right).toBeLessThanOrEqual(
			canvasElement.ownerDocument.documentElement.clientWidth
		);
		await expect(blur).toBeVisible();
	}
};

export const PhoneBlurred: Story = {
	name: 'Telefon 390 — geschwärzte Stelle',
	args: { moderator: false, blurred: [SENSITIVE_PASSAGE] },
	globals: phone390Globals
};

export const PhoneModeratorRemoves: Story = {
	name: 'Telefon 390 — Moderation hebt auf',
	args: { blurred: [SENSITIVE_PASSAGE], openRemoveBar: true },
	globals: phone390Globals,
	play: async ({ canvasElement }) => {
		const bar = await within(canvasElement).findByRole(
			'toolbar',
			{ name: BLUR_BAR.de },
			WAIT
		);
		const box = bar.getBoundingClientRect();
		await expect(box.left).toBeGreaterThanOrEqual(0);
		await expect(box.right).toBeLessThanOrEqual(
			canvasElement.ownerDocument.documentElement.clientWidth
		);
	}
};

export const DarkMenu: Story = {
	name: 'Dunkel — Leiste',
	args: { markPassage: SENSITIVE_PASSAGE },
	globals: { scheme: 'dark' }
};

export const DarkBlurred: Story = {
	name: 'Dunkel — geschwärzte Stelle',
	args: { moderator: false, blurred: [SENSITIVE_PASSAGE, SECOND_PASSAGE] },
	globals: { scheme: 'dark' }
};

export const DarkPhoneModerator: Story = {
	name: 'Dunkel · Telefon 390 — Moderation hebt auf',
	args: { blurred: [SENSITIVE_PASSAGE], openRemoveBar: true },
	globals: { scheme: 'dark', ...phone390Globals }
};

export const EnglishMenu: Story = {
	name: 'English — bar with “Blur”',
	args: { markPassage: SENSITIVE_PASSAGE },
	globals: { locale: 'en' },
	play: async ({ canvasElement }) => {
		const bar = await within(canvasElement).findByRole(
			'toolbar',
			{ name: TOOLBAR.en },
			WAIT
		);
		await expect(
			within(bar).getByRole('button', { name: 'Blur' })
		).toBeVisible();
	}
};

export const EnglishModerator: Story = {
	name: 'English — moderator removes the blur',
	args: { blurred: [SENSITIVE_PASSAGE], openRemoveBar: true },
	globals: { locale: 'en' }
};

export const EnglishPhoneDark: Story = {
	name: 'English · dark · 390 — blurred passage',
	args: { moderator: false, blurred: [SENSITIVE_PASSAGE] },
	globals: { locale: 'en', scheme: 'dark', ...phone390Globals }
};
