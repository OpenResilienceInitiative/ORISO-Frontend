/**
 * `Chat/Organisms/MessageTimeline` — the organism the whole chat hangs from.
 *
 * It is the only place that turns a list of `MessageItem`s into rendered
 * rows: the main chat (`SessionItemComponent`), the thread panel and the
 * supervision side room all mount THIS component, so a change here changes
 * all three rooms at once. Until now it could only be seen by opening the
 * 910-line stage; these stories give it a place of its own.
 *
 * The host mirrors the app: `.session > .session__content` is the scroll
 * container the timeline is placed *into* (the organism renders a fragment
 * on purpose), and the outgoing-send failure card is a SIBLING of the
 * timeline — exactly as `SessionItemComponent` composes it.
 */
import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, waitFor } from 'storybook/test';
import { MessageTimeline } from './MessageTimeline';
import { buildSupervisionTimeline } from './sessionHelpers';
import type { MessageItem } from '../message/MessageItemComponent';
import { FailedSendTimelineEntry } from '../message/FailedSendTimelineEntry';
import { mockE2eeParams } from '../message/MessageItemComponent.mocks';
import {
	BUBBLE_MAX_WIDTH,
	desktop1440Globals,
	phone390Globals
} from '../message/messageStoryShell';
import { ChatStageProviders } from '../chatStage/__storybook__/ChatStageProviders';
import {
	CLIENT_MATRIX_ID,
	CLIENT_NAME,
	CLIENT_ROOM_ID,
	COUNSELLOR_MATRIX_ID,
	COUNSELLOR_NAME,
	isCounsellorMessage,
	stageRoute,
	SUPERVISION_ROOM_ID,
	SUPERVISOR_NAME
} from '../chatStage/__storybook__/chatStageFixtures';
import '../message/message.styles.scss';
import './session.styles.scss';

const CHAT_ROOM_FIGMA_URL =
	'https://www.figma.com/design/L2mOFNSGdxPPx1XA4HFAog/App.Oriso?node-id=1320-38278';

const noop = () => {};

const timelineHandlers = {
	handleDecryptionErrors: noop,
	handleDecryptionSuccess: noop,
	e2eeParams: mockE2eeParams()
};

const emptyDate = { str: '', date: null } as MessageItem['messageDate'];
const dayPill = (label: string) =>
	({ str: label, date: null }) as MessageItem['messageDate'];

const at = (iso: string) => String(new Date(iso).getTime());

const row = (
	id: string,
	who: 'client' | 'counsellor',
	body: string,
	time: string,
	overrides: Partial<MessageItem> = {}
): MessageItem => ({
	_id: id,
	message: body,
	messageDate: emptyDate,
	messageTime: at(time),
	askerMatrixUserId: CLIENT_MATRIX_ID,
	isNotRead: false,
	t: null,
	rid: CLIENT_ROOM_ID,
	...(who === 'client'
		? {
				displayName: CLIENT_NAME,
				username: 'sonnenblume_47',
				userId: CLIENT_MATRIX_ID
			}
		: {
				displayName: COUNSELLOR_NAME,
				username: 'mona.s@oriso.invalid',
				userId: COUNSELLOR_MATRIX_ID
			}),
	...overrides
});

/** One message — the smallest thing the organism can render. */
const oneMessage = (): MessageItem[] => [
	row(
		'$one',
		'client',
		'Hallo, ich weiß nicht so recht, wo ich anfangen soll. Es ist gerade alles ein bisschen viel.',
		'2026-09-04T08:58:00+02:00',
		{ messageDate: dayPill('Heute') }
	)
];

/**
 * Three days in one room. The stream stamps the first message of a day with
 * a `messageDate`; every other row carries an empty one — so the number of
 * date pills equals the number of days, and the organism must not invent a
 * fourth.
 */
const DAY_LABELS = ['2. September', 'Gestern', 'Heute'];

const threeDays = (): MessageItem[] => [
	row(
		'$d1a',
		'client',
		'Es sind ein paar Briefe gekommen, die ich nicht aufgemacht habe. Mahnbescheide, glaube ich.',
		'2026-09-02T09:07:00+02:00',
		{ messageDate: dayPill(DAY_LABELS[0]) }
	),
	row(
		'$d1b',
		'counsellor',
		'Beides darf hier Platz haben. Wenn Sie mögen, erzählen Sie mir zuerst, was bei der Arbeit gerade passiert.',
		'2026-09-02T09:09:00+02:00'
	),
	row(
		'$d2a',
		'client',
		'Mein Vertrag läuft im Oktober aus und niemand sagt mir, ob er verlängert wird. Ich schlafe kaum noch.',
		'2026-09-03T09:14:00+02:00',
		{ messageDate: dayPill(DAY_LABELS[1]) }
	),
	row(
		'$d2b',
		'counsellor',
		'Das klingt nach einer sehr belastenden Ungewissheit. Lassen Sie uns gemeinsam sortieren, was Sie jetzt beeinflussen können und was nicht.',
		'2026-09-03T09:18:00+02:00'
	),
	row(
		'$d3a',
		'client',
		'Ich habe die Briefe heute morgen aufgemacht. Es waren zwei Mahnungen.',
		'2026-09-04T08:41:00+02:00',
		{ messageDate: dayPill(DAY_LABELS[2]) }
	),
	row(
		'$d3b',
		'counsellor',
		'Das war ein großer Schritt. Wollen wir gemeinsam schauen, was jetzt als Erstes dran ist?',
		'2026-09-04T08:46:00+02:00'
	)
];

/**
 * T49: the side room's first item is the app's own supervision notice —
 * built by `buildSupervisionTimeline`, so the story cannot drift from the
 * app's `[SYSTEM_NOTIFICATION]` payload.
 */
const withSystemNotice = (): MessageItem[] =>
	buildSupervisionTimeline(
		[
			row(
				'$n1',
				'counsellor',
				'Die Ratsuchende hat heute zum zweiten Mal Mahnbescheide erwähnt, geht aber jedes Mal sofort auf ein anderes Thema.',
				'2026-09-04T09:12:00+02:00',
				{ messageDate: dayPill('Heute'), rid: SUPERVISION_ROOM_ID }
			)
		],
		{
			roomId: SUPERVISION_ROOM_ID,
			title: 'Supervision',
			description: `Supervision durch ${SUPERVISOR_NAME} ist aktiv.`,
			askerMatrixUserId: CLIENT_MATRIX_ID
		}
	);

/** Two incoming messages this client could not decrypt (UTD). */
const BROKEN_SHOWN = '$broken-shown';
const BROKEN_SUPPRESSED = '$broken-quiet';

const withFailures = (): MessageItem[] => [
	row(
		'$f1',
		'client',
		'Ich habe die Unterlagen jetzt zusammen.',
		'2026-09-04T09:31:00+02:00',
		{ messageDate: dayPill('Heute') }
	),
	row(BROKEN_SHOWN, 'client', '…', '2026-09-04T09:33:00+02:00'),
	row(BROKEN_SUPPRESSED, 'client', '…', '2026-09-04T09:34:00+02:00'),
	row(
		'$f2',
		'counsellor',
		'Danke — ich sehe hier leider nur eine leere Nachricht. Mögen Sie sie noch einmal senden?',
		'2026-09-04T09:36:00+02:00'
	)
];

/** The outgoing send the server rejected — a SIBLING of the timeline. */
const failedSend = {
	id: 'failed-1',
	message:
		'Ich schlage Ihnen für nächste Woche einen Termin zur Schuldenaufstellung vor.',
	ts: new Date('2026-09-04T09:38:00+02:00').getTime(),
	transportMessage: '',
	isAside: false,
	mentionedUserIds: [] as string[]
};

function Host({
	children,
	width = 900,
	height = 620
}: {
	children: React.ReactNode;
	width?: number | string;
	height?: number | string;
}) {
	return (
		<ChatStageProviders>
			<div
				className="session"
				style={{
					width,
					height,
					maxWidth: '100%',
					display: 'flex',
					flexDirection: 'column',
					background: 'var(--m3-surface-container-lowest, #fff)'
				}}
			>
				<div
					className="session__content"
					style={{ flex: '1 1 auto', overflowY: 'auto' }}
					data-cy="timeline-host"
				>
					{children}
				</div>
			</div>
		</ChatStageProviders>
	);
}

const Timeline = ({
	messages,
	...rest
}: Partial<React.ComponentProps<typeof MessageTimeline>> & {
	messages: MessageItem[];
}) => (
	<MessageTimeline
		messages={messages}
		renderMode="main"
		threadsEnabled={false}
		clientName={CLIENT_NAME}
		isMyMessage={isCounsellorMessage}
		{...timelineHandlers}
		{...rest}
	/>
);

/** Every story renders its own composition; args exist for the docs table. */
const baseArgs = {
	messages: [] as MessageItem[],
	clientName: CLIENT_NAME,
	isMyMessage: isCounsellorMessage,
	...timelineHandlers
};

const meta = {
	title: 'Chat/Organisms/MessageTimeline',
	component: MessageTimeline,
	tags: ['autodocs'],
	parameters: {
		layout: 'fullscreen',
		router: { initialPath: stageRoute },
		design: { type: 'figma', url: CHAT_ROOM_FIGMA_URL },
		docs: {
			description: {
				component:
					'The chat timeline organism: the single place that turns `MessageItem`s into rendered rows. ' +
					'Main chat, thread panel and supervision side room all mount it, so these states are the states of all three rooms. ' +
					'It renders a fragment — the scroll container, the typing indicator and the failed-send card belong to the caller.'
			}
		}
	}
} satisfies Meta<typeof MessageTimeline>;

export default meta;
type Story = StoryObj<typeof meta>;

const host = (canvasElement: HTMLElement) =>
	canvasElement.querySelector<HTMLElement>('[data-cy="timeline-host"]')!;

const rowsOf = (canvasElement: HTMLElement) =>
	Array.from(host(canvasElement).children) as HTMLElement[];

/**
 * Nothing to show: the organism renders a fragment, so the caller's scroll
 * container stays completely empty — no placeholder row, no wrapper element
 * the caller would have to style around.
 */
export const Empty: Story = {
	name: 'Empty — no messages at all',
	args: baseArgs,
	render: () => (
		<Host height={240}>
			<Timeline messages={[]} />
		</Host>
	),
	play: async ({ canvasElement }) => {
		await waitFor(() => expect(host(canvasElement)).not.toBeNull());
		await expect(host(canvasElement).children).toHaveLength(0);
		await expect(
			canvasElement.querySelectorAll('.messageItem')
		).toHaveLength(0);
	}
};

/** One incoming message — the smallest rendered timeline. */
export const SingleMessage: Story = {
	name: 'One message',
	args: { ...baseArgs, messages: oneMessage(), isMyMessage: () => false },
	render: () => (
		<Host height={320}>
			<Timeline messages={oneMessage()} />
		</Host>
	),
	play: async ({ canvasElement }) => {
		await waitFor(() =>
			expect(canvasElement.querySelectorAll('.messageItem')).toHaveLength(
				1
			)
		);
		const item = canvasElement.querySelector<HTMLElement>('.messageItem')!;
		// The client is not the viewer (`isMyMessage` = the counsellor), so
		// the row is an incoming bubble, not a right-aligned own one.
		await expect(item.classList.contains('messageItem--right')).toBe(false);
		await expect(item.textContent).toContain('wo ich anfangen soll');
	}
};

/**
 * A longer history across three days. The date pill belongs to the timeline,
 * not to the room: one pill per day, in order, each one immediately before
 * the first message of its day.
 */
export const DayDividers: Story = {
	name: 'Longer history with day dividers',
	args: { ...baseArgs, messages: threeDays() },
	render: () => (
		<Host>
			<Timeline messages={threeDays()} />
		</Host>
	),
	play: async ({ canvasElement }) => {
		await waitFor(() =>
			expect(canvasElement.querySelectorAll('.messageItem')).toHaveLength(
				6
			)
		);
		const dividers = Array.from(
			canvasElement.querySelectorAll<HTMLElement>('.messageDateDivider')
		);
		// One pill per day — not one per message, not one for the whole list.
		await expect(dividers).toHaveLength(DAY_LABELS.length);
		await expect(
			dividers.map((d) =>
				d
					.querySelector('.messageDateDivider__pill')!
					.textContent?.trim()
			)
		).toEqual(DAY_LABELS);
		// Each pill sits above the first message of its day, in reading order.
		const tops = dividers.map((d) => d.getBoundingClientRect().top);
		await expect(tops[0]).toBeLessThan(tops[1]);
		await expect(tops[1]).toBeLessThan(tops[2]);
		// The pill belongs to the row that opens the day — rows 0, 2 and 4.
		const rows = rowsOf(canvasElement);
		await expect(
			rows.map((r) => Boolean(r.querySelector('.messageDateDivider')))
		).toEqual([true, false, true, false, true, false]);
		// Own messages (the counsellor is the viewer) are right-aligned.
		await expect(
			canvasElement.querySelectorAll('.messageItem--right')
		).toHaveLength(3);
	}
};

/**
 * T49: a system notice in a side room is the SAME Carimat organism the main
 * chat uses (`pseudonymCard`: ringed avatar, name + "Systembenachrichtigung"
 * kicker, no kebab) — never the generic system-notification chrome. The
 * timeline gets it from the app's own builder, so the two cannot drift.
 */
export const WithSystemNotice: Story = {
	name: 'With a system notice (T49)',
	args: {
		...baseArgs,
		messages: withSystemNotice(),
		clientName: SUPERVISOR_NAME
	},
	render: () => (
		<Host height={420}>
			<Timeline
				messages={withSystemNotice()}
				clientName={SUPERVISOR_NAME}
				askerMatrixUserIdFor={() => CLIENT_MATRIX_ID}
			/>
		</Host>
	),
	play: async ({ canvasElement }) => {
		await waitFor(() =>
			expect(
				canvasElement.querySelector('.messageItem.pseudonymCard')
			).not.toBeNull()
		);
		const first = rowsOf(canvasElement)[0];
		// The notice is the first row of the room …
		await expect(
			first.querySelector('.messageItem.pseudonymCard')
		).not.toBeNull();
		await expect(first.textContent).toContain('Supervision durch');
		// … as the Carimat organism, not the generic system chrome, and
		// without a kebab (nothing to act on).
		await expect(
			first.querySelector(
				'.messageItem.pseudonymCard .pseudonymCard__headerName'
			)?.textContent
		).toBe('Supervision');
		await expect(
			canvasElement.querySelector(
				'.messageItem__message--systemNotification'
			)
		).toBeNull();
		await expect(
			first.querySelector('.messageItem__kebabButton')
		).toBeNull();
	}
};

/**
 * Failure, in the two shapes the chat actually has:
 *
 * 1. **Incoming, undecryptable (UTD).** `decryptionFailures` marks the ids;
 *    the timeline flags the bubble AND follows it with the explanation card
 *    — but only where `showDecryptionCardFor` allows it. Both broken rows
 *    are marked; only one gets a card, which is the whole point of the prop.
 * 2. **Outgoing, rejected.** That card is NOT the timeline's: the caller
 *    renders `FailedSendTimelineEntry` after it (exactly as
 *    `SessionItemComponent` does), so it must appear after the last
 *    timeline row, never between two of them.
 */
export const FailedAndUndecryptable: Story = {
	name: 'Failed send + undecryptable message',
	args: { ...baseArgs, messages: withFailures() },
	render: () => (
		<Host>
			<Timeline
				messages={withFailures()}
				decryptionFailures={new Set([BROKEN_SHOWN, BROKEN_SUPPRESSED])}
				showDecryptionCardFor={(message) =>
					message._id === BROKEN_SHOWN
				}
			/>
			<FailedSendTimelineEntry
				failed={failedSend}
				messageProps={{
					clientName: CLIENT_NAME,
					isMyMessage: true,
					isUserBanned: false,
					renderMode: 'main',
					threadsEnabled: false,
					forceShow: true,
					displayName: COUNSELLOR_NAME,
					username: 'mona.s@oriso.invalid',
					userId: COUNSELLOR_MATRIX_ID,
					isNotRead: false,
					t: null,
					rid: CLIENT_ROOM_ID,
					...timelineHandlers
				}}
				onRetry={noop}
			/>
		</Host>
	),
	play: async ({ canvasElement }) => {
		await waitFor(() =>
			expect(
				canvasElement.querySelectorAll('.messageItem--sendFailed')
					.length
			).toBeGreaterThanOrEqual(2)
		);
		const rows = rowsOf(canvasElement);
		// Four messages + one UTD card come from the timeline; the outgoing
		// failure adds the caller's own two rows (bubble + explanation).
		await expect(rows).toHaveLength(7);
		await expect(
			canvasElement.querySelectorAll('.messageItem--sendFailed')
		).toHaveLength(2);
		// The UTD card sits directly after the message it explains …
		await expect(rows[1]).toHaveAttribute('data-message-id', BROKEN_SHOWN);
		await expect(rows[2].classList).toContain('messageItem--sendFailed');
		await expect(
			rows[2].querySelector('.messageItem__sendFailedTitle')?.textContent
		).toContain('entschlüsselt');
		// … and `showDecryptionCardFor` really gates: the second broken
		// message is followed by the next ordinary message, not by a card.
		await expect(rows[3]).toHaveAttribute(
			'data-message-id',
			BROKEN_SUPPRESSED
		);
		await expect(rows[4].classList).not.toContain(
			'messageItem--sendFailed'
		);
		// Both broken bubbles are still MARKED — `decryptionFailures` flags
		// the row, `showDecryptionCardFor` only decides about the card.
		for (const index of [1, 3]) {
			await expect(
				rows[index].querySelector(
					'.messageItem__deliveryStatus--failed'
				)
			).not.toBeNull();
		}
		// The outgoing failure is the LAST row and carries the retry button —
		// the timeline's UTD card never does (there is nothing to retry).
		await expect(
			rows[6].querySelector('.messageItem__sendFailedRetry')
		).not.toBeNull();
		await expect(
			rows[2].querySelector('.messageItem__sendFailedRetry')
		).toBeNull();
	}
};

/** Phone 390: the bubble must never push the scroll container sideways. */
export const Phone390: Story = {
	name: 'Phone 390',
	globals: phone390Globals,
	args: { ...baseArgs, messages: threeDays() },
	render: () => (
		<Host width={390} height={720}>
			<Timeline messages={threeDays()} />
		</Host>
	),
	play: async ({ canvasElement }) => {
		await waitFor(() =>
			expect(canvasElement.querySelectorAll('.messageItem')).toHaveLength(
				6
			)
		);
		const container = host(canvasElement).getBoundingClientRect();
		for (const bubble of Array.from(
			canvasElement.querySelectorAll<HTMLElement>('.messageItem__message')
		)) {
			const box = bubble.getBoundingClientRect();
			await expect(box.right).toBeLessThanOrEqual(container.right + 1);
			await expect(box.left).toBeGreaterThanOrEqual(container.left - 1);
		}
		await expect(host(canvasElement).scrollWidth).toBeLessThanOrEqual(
			host(canvasElement).clientWidth + 1
		);
	}
};

/** Desktop 1440: the bubble stops growing at its own 834 px cap. */
export const Desktop1440: Story = {
	name: 'Desktop 1440',
	globals: desktop1440Globals,
	args: { ...baseArgs, messages: threeDays() },
	render: () => (
		<Host width={1200} height={760}>
			<Timeline messages={threeDays()} />
		</Host>
	),
	play: async ({ canvasElement }) => {
		await waitFor(() =>
			expect(canvasElement.querySelectorAll('.messageItem')).toHaveLength(
				6
			)
		);
		for (const bubble of Array.from(
			canvasElement.querySelectorAll<HTMLElement>('.messageItem__message')
		)) {
			await expect(
				bubble.getBoundingClientRect().width
			).toBeLessThanOrEqual(BUBBLE_MAX_WIDTH + 1);
		}
	}
};
