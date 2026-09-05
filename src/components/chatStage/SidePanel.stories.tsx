/**
 * The side room built from real chat organisms only: `PanelHeader` (room
 * header tokens) · `MessageTimeline` (the real `MessageItemComponent`) ·
 * the real `MessageSubmitInterfaceComponent` with `targetRoomId`.
 */
import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { useTranslation } from 'react-i18next';
import { SidePanel, InfoBanner, type SidePanelVariant } from './SidePanel';
import { PanelHeader } from './PanelHeader';
import { ChannelSwitcherFab } from './ChannelSwitcherFab';
import { MessageTimeline } from '../session/MessageTimeline';
import { buildSupervisionTimeline } from '../session/sessionHelpers';
import { MessageSubmitInterfaceComponent } from '../messageSubmitInterface/messageSubmitInterfaceComponent';
import { mockE2eeParams } from '../message/MessageItemComponent.mocks';
import { phone390Globals } from '../message/messageStoryShell';
import { ChatStageProviders } from './__storybook__/ChatStageProviders';
import type { SecondaryChannel } from './channelSwitcherState';
import type { StackParticipant } from '../message/participantStack';
import {
	CLIENT_NAME,
	CLIENT_MATRIX_ID,
	COUNSELLOR_MATRIX_ID,
	COUNSELLOR_NAME,
	isCounsellorMessage,
	SUPERVISION_ROOM_ID,
	SUPERVISOR_MATRIX_ID,
	SUPERVISOR_NAME,
	supervisionMessages,
	supervisionSystemNotice,
	THREAD_ROOT_ID,
	threadMessages,
	mainChatMessages,
	stageRoute
} from './__storybook__/chatStageFixtures';
import '../message/message.styles.scss';
import '../messageSubmitInterface/messageSubmitInterface.styles.scss';
import '../session/session.styles.scss';
import './sidePanel.styles.scss';

const CHAT_ROOM_FIGMA_URL =
	'https://www.figma.com/design/L2mOFNSGdxPPx1XA4HFAog/App.Oriso?node-id=1320-38278';

const noop = () => {};
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
const supervisorParticipant: StackParticipant = {
	userId: SUPERVISOR_MATRIX_ID,
	username: 'bettina.b@oriso.invalid',
	displayName: SUPERVISOR_NAME
};
/** The other channel each side room offers under its header icon (T1). */
const THREAD_CHANNEL: SecondaryChannel = {
	id: THREAD_ROOT_ID,
	kind: 'thread',
	label: 'Es sind ein paar Briefe gekommen…',
	createdTs: Number(threadMessages()[0].messageTime),
	lastMessage: {
		author: CLIENT_NAME,
		text: 'Okay. Vielleicht nächste Woche, wenn ich weiß, wie es mit dem Vertrag weitergeht.',
		ts: Number(threadMessages()[1].messageTime)
	}
};
const SUPERVISION_CHANNEL: SecondaryChannel = {
	id: 'supervision',
	kind: 'supervision',
	label: SUPERVISOR_NAME,
	unread: 1,
	lastMessage: {
		author: COUNSELLOR_NAME,
		text: 'Danke, das hilft. Ich formuliere es so und melde mich nach dem nächsten Kontakt.',
		ts: Number(supervisionMessages()[3].messageTime)
	}
};
const timelineHandlers = {
	handleDecryptionErrors: noop,
	handleDecryptionSuccess: noop,
	e2eeParams: mockE2eeParams()
};

function Host({
	children,
	width = 480,
	height = 680
}: {
	children: React.ReactNode;
	width?: number | string;
	height?: number | string;
}) {
	return (
		<ChatStageProviders>
			<div
				style={{
					width,
					height,
					maxWidth: '100%',
					padding: 24,
					boxSizing: 'border-box',
					display: 'flex',
					background: 'var(--m3-surface-container-high, #eae7e8)'
				}}
			>
				{children}
			</div>
		</ChatStageProviders>
	);
}

function SupervisionSideRoom({
	variant = 'card',
	withBanner = false,
	empty = false,
	firstVisit = false,
	unread = 0,
	onBack,
	switcher
}: {
	variant?: SidePanelVariant;
	withBanner?: boolean;
	empty?: boolean;
	/** N-2: the app path — notice built over a side room with zero messages. */
	firstVisit?: boolean;
	unread?: number;
	onBack?: () => void;
	switcher?: React.ReactNode;
}) {
	const { t } = useTranslation();
	return (
		<SidePanel
			variant={variant}
			label={t('chatStage.panel.region', {
				title: t('supervision.panel.title')
			})}
			data-cy="supervision-side-panel"
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
					channels={[THREAD_CHANNEL, SUPERVISION_CHANNEL]}
					activeChannelId={SUPERVISION_CHANNEL.id}
					onSelectChannel={noop}
					onBack={onBack}
					onClose={onBack ? undefined : noop}
				/>
			}
			banner={
				withBanner ? (
					<InfoBanner
						title="Supervisionsgrund"
						text="Wiederholte Vermeidung beim Thema Mahnbescheide; Fallbesprechung zur Gesprächsführung."
					/>
				) : undefined
			}
			timeline={
				empty ? null : (
					<MessageTimeline
						messages={
							firstVisit
								? buildSupervisionTimeline([], {
										roomId: SUPERVISION_ROOM_ID,
										title: t('supervision.panel.title'),
										description: t(
											'supervision.panel.systemNotice',
											{ name: SUPERVISOR_NAME }
										),
										askerMatrixUserId: CLIENT_MATRIX_ID
									})
								: [
										supervisionSystemNotice(
											t('supervision.panel.title'),
											t(
												'supervision.panel.systemNotice',
												{
													name: SUPERVISOR_NAME
												}
											)
										),
										...supervisionMessages()
									]
						}
						renderMode="main"
						threadsEnabled={false}
						clientName={SUPERVISOR_NAME}
						askerMatrixUserIdFor={() => CLIENT_MATRIX_ID}
						isMyMessage={isCounsellorMessage}
						{...timelineHandlers}
					/>
				)
			}
			emptyState={
				<div style={{ textAlign: 'center', padding: '48px 16px' }}>
					<p
						style={{
							margin: 0,
							font: '500 14px/20px var(--m3-body-font-family, sans-serif)',
							color: 'var(--m3-on-surface, #1a1c1e)'
						}}
					>
						{t('supervision.panel.empty.title')}
					</p>
					<p
						style={{
							margin: '4px 0 0',
							font: '12px/16px var(--m3-body-font-family, sans-serif)',
							color: 'var(--m3-on-surface-variant, #444748)'
						}}
					>
						{t('supervision.panel.empty.hint', {
							name: SUPERVISOR_NAME
						})}
					</p>
				</div>
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

function ThreadSideRoom({ onBack }: { onBack?: () => void }) {
	const { t } = useTranslation();
	const root = mainChatMessages().find((m) => m._id === THREAD_ROOT_ID)!;
	return (
		<SidePanel
			variant="card"
			label={t('chatStage.panel.region', {
				title: t('chatStage.panel.thread.title')
			})}
			data-cy="thread-side-panel"
			header={
				<PanelHeader
					kind="thread"
					title={t('chatStage.panel.thread.title')}
					name={CLIENT_NAME}
					participants={[clientParticipant, counsellorParticipant]}
					channels={[SUPERVISION_CHANNEL, THREAD_CHANNEL]}
					activeChannelId={THREAD_ROOT_ID}
					onSelectChannel={noop}
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
					{...timelineHandlers}
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
		/>
	);
}

const meta = {
	title: 'Components/Session/SidePanel',
	component: SidePanel,
	tags: ['autodocs'],
	parameters: {
		layout: 'fullscreen',
		router: { initialPath: stageRoute },
		design: { type: 'figma', url: CHAT_ROOM_FIGMA_URL },
		docs: {
			description: {
				component:
					'A side room is a second "Chat Room Desktop" in narrow: PanelHeader (room-header tokens) + MessageTimeline (real MessageItemComponent) + the real composer with `targetRoomId`. No bubble or composer CSS of its own.'
			}
		}
	}
} satisfies Meta<typeof SidePanel>;

export default meta;
type Story = StoryObj<typeof meta>;

const expectRealChatParts = async (
	canvasElement: HTMLElement,
	messageCount: number
) => {
	await waitFor(() => {
		expect(
			canvasElement.querySelectorAll('.messageItem').length
		).toBeGreaterThanOrEqual(messageCount);
		expect(
			canvasElement.querySelector('.textarea__wrapper-send-message')
		).not.toBeNull();
	});
};

export const Supervision: Story = {
	name: 'Supervision — consultant view',
	args: { header: null, label: 'Supervision' },
	render: () => (
		<Host>
			<SupervisionSideRoom unread={2} />
		</Host>
	),
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expectRealChatParts(canvasElement, 4);
		await expect(
			canvas.getByText(SUPERVISOR_NAME, {
				selector: '.panelHeader__titleName'
			})
		).toBeVisible();
		const panel = canvasElement.querySelector(
			'[data-cy="supervision-side-panel"]'
		)!;
		// Client name never appears inside the side room.
		await expect(panel.textContent ?? '').not.toContain(CLIENT_NAME);
		await expect(
			panel.querySelector('[data-cy="panel-header-unread"]')?.textContent
		).toBe('2');
		// T26: the name is the title; the channel word "Supervision" sits
		// UNDER the hairline (the main chat's topic-tag slot), is the menu
		// button, and the chevron follows the word directly. No explanatory
		// sentence anywhere in the header. The privacy banner is gone; the
		// timeline opens with the system notice bubble (T7).
		const kindLabelEl = panel.querySelector<HTMLElement>(
			'[data-cy="panel-header-kind-label"]'
		)!;
		await expect(kindLabelEl.textContent).toBe('Supervision');
		const hairline = panel.querySelector<HTMLElement>(
			'.panelHeader__divider'
		)!;
		await expect(
			kindLabelEl.getBoundingClientRect().top
		).toBeGreaterThanOrEqual(hairline.getBoundingClientRect().top);
		await expect(
			panel
				.querySelector('[data-cy="panel-header-name"]')!
				.getBoundingClientRect().bottom
		).toBeLessThanOrEqual(hairline.getBoundingClientRect().top + 1);
		const chevronEl = panel.querySelector<HTMLElement>(
			'[data-cy="panel-header-kind-chevron"]'
		)!;
		await expect(
			chevronEl.getBoundingClientRect().left -
				kindLabelEl.getBoundingClientRect().right
		).toBeLessThanOrEqual(6);
		await expect(
			panel.querySelector('[data-cy="panel-header-tag"]')
		).toBeNull();
		await expect(
			panel.querySelector('.panelHeader')!.textContent
		).not.toMatch(/Antworten auf|Replies to/);
		await expect(
			panel.querySelector(
				'.messageItem .messageItem__message--systemNotification'
			)
		).not.toBeNull();
		await expect(
			panel.querySelector('[data-cy="side-panel-timeline"] .messageItem')
				?.textContent
		).toContain('Supervision durch');
		// T1: hover on a participant avatar shows the display name …
		const avatars = panel.querySelectorAll<HTMLElement>(
			'[data-cy="panel-header-participants"] [data-cy="participant-avatar"]'
		);
		await expect(avatars).toHaveLength(2);
		// T14/T17: the same 40 px / 28 px stack as the room header (Figma
		// 1320:38281), the title text 6 px after it.
		const a0 = avatars[0].getBoundingClientRect();
		const a1 = avatars[1].getBoundingClientRect();
		await expect(Math.round(a0.width)).toBe(40);
		await expect(Math.round(a1.left - a0.left)).toBe(28);
		const stackBox = panel
			.querySelector('[data-cy="panel-header-participants"]')!
			.getBoundingClientRect();
		const nameBox = panel
			.querySelector('[data-cy="panel-header-name"]')!
			.getBoundingClientRect();
		await expect(Math.round(nameBox.left - stackBox.right)).toBe(6);
		await userEvent.hover(avatars[1]);
		await waitFor(() =>
			expect(
				canvas.getByText(SUPERVISOR_NAME, {
					selector: '[role="tooltip"]'
				})
			).toBeVisible()
		);
		await userEvent.unhover(avatars[1]);
		// … and the channel icon opens the same channel options as the FAB.
		const options = panel.querySelector<HTMLButtonElement>(
			'[data-cy="panel-header-channel-options"]'
		)!;
		await expect(options).toHaveAttribute('aria-haspopup', 'menu');
		await userEvent.click(options);
		const menu = await canvas.findByRole('menu');
		const items = within(menu).getAllByRole('menuitem');
		// T15/T20: every secondary channel of the session, supervision
		// first, the shown one marked; the card sits below the hairline.
		await expect(items).toHaveLength(2);
		await expect(items[0]).toHaveAttribute(
			'data-channel-id',
			'supervision'
		);
		await expect(items[0]).toHaveAttribute('aria-current', 'true');
		await expect(items[0].textContent).toContain('Supervisionschat');
		await expect(items[1]).toHaveAttribute(
			'data-channel-id',
			THREAD_ROOT_ID
		);
		await expect(items[1]).not.toHaveAttribute('aria-current');
		await expect(items[1].textContent).toContain('Thread #1');
		await expect(
			items[1].querySelector('[data-cy="channel-menu-preview"]')
				?.textContent
		).toContain(`${CLIENT_NAME}:`);
		await expect(
			panel
				.querySelector('[data-cy="panel-header-channel-menu"]')!
				.getBoundingClientRect().top
		).toBeGreaterThanOrEqual(
			panel
				.querySelector('.panelHeader__divider')!
				.getBoundingClientRect().bottom - 1
		);
		// T19: the chevron marks the word as a menu button.
		await expect(
			options.querySelector('[data-cy="panel-header-kind-chevron"]')
		).not.toBeNull();
		await userEvent.keyboard('{Escape}');
		await waitFor(() =>
			expect(canvasElement.querySelector('[role="menu"]')).toBeNull()
		);
		// Room to spare: the channel word, not the count.
		await expect(
			panel.querySelector('[data-cy="panel-header-kind-label"]')
		).toHaveAttribute('data-mode', 'label');
	}
};

/**
 * T15: with little room in the channel line the word gives way to the
 * participant count — the same rule as the room header's "+N". Since T26
 * the line spans the panel, so only a very narrow panel (here 152 px)
 * reaches the threshold.
 */
export const NarrowHeaderShowsParticipantCount: Story = {
	name: 'Narrow panel — participant count instead of the channel word (T15)',
	args: { header: null, label: 'Supervision' },
	render: () => (
		<Host width={200}>
			<SupervisionSideRoom />
		</Host>
	),
	play: async ({ canvasElement }) => {
		await expectRealChatParts(canvasElement, 4);
		const label = canvasElement.querySelector<HTMLElement>(
			'[data-cy="panel-header-kind-label"]'
		)!;
		await waitFor(() =>
			expect(label).toHaveAttribute('data-mode', 'count')
		);
		await expect(label.textContent).toBe('2');
		const options = canvasElement.querySelector<HTMLButtonElement>(
			'[data-cy="panel-header-channel-options"]'
		)!;
		// The word and the count stay available to assistive tech.
		await expect(options.getAttribute('aria-label')).toContain(
			'Supervision'
		);
		await expect(options.getAttribute('aria-label')).toContain('2');
	}
};

export const Thread: Story = {
	name: 'Thread — root + replies',
	args: { header: null, label: 'Thread' },
	render: () => (
		<Host>
			<ThreadSideRoom />
		</Host>
	),
	play: async ({ canvasElement }) => {
		await expectRealChatParts(canvasElement, 3);
		// T26: the thread is named with its card number, under the hairline,
		// and the old explanatory sentence is gone.
		const panel = canvasElement.querySelector<HTMLElement>(
			'[data-cy="thread-side-panel"]'
		)!;
		await expect(
			panel.querySelector('[data-cy="panel-header-kind-label"]')
				?.textContent
		).toBe('Thread #1');
		await expect(
			panel.querySelector('[data-cy="panel-header-name"]')?.textContent
		).toBe(CLIENT_NAME);
		await expect(
			panel.querySelector('.panelHeader')!.textContent
		).not.toMatch(/Antworten auf|Replies to/);
	}
};

export const Empty: Story = {
	name: 'Supervision — no messages yet',
	args: { header: null, label: 'Supervision' },
	render: () => (
		<Host>
			<SupervisionSideRoom empty />
		</Host>
	),
	play: async ({ canvasElement }) => {
		await waitFor(() =>
			expect(
				canvasElement.querySelector('.textarea__wrapper-send-message')
			).not.toBeNull()
		);
		await expect(
			canvasElement.querySelectorAll('.messageItem').length
		).toBe(0);
	}
};

export const EmptyWithSupervisionNotice: Story = {
	name: 'Supervision — first visit, empty side room with notice',
	args: { header: null, label: 'Supervision' },
	render: () => (
		<Host>
			<SupervisionSideRoom firstVisit />
		</Host>
	),
	play: async ({ canvasElement }) => {
		// N-2: the notice is the only item and must not throw on a missing
		// `messageDate` — this is what a freshly assigned standing supervisor
		// (and the counsellor) see before anyone has written.
		await waitFor(() =>
			expect(
				canvasElement.querySelector('.textarea__wrapper-send-message')
			).not.toBeNull()
		);
		await expect(
			canvasElement.querySelectorAll('.messageItem').length
		).toBe(1);
		await expect(canvasElement.textContent).toContain(SUPERVISOR_NAME);
		// No date pill: the app hands the notice an empty `PrettyDate`.
		await expect(
			canvasElement.querySelector('.messageDateDivider')
		).toBeNull();
	}
};

export const WithBanner: Story = {
	name: 'Supervision — with reason banner (no letter-wrapping)',
	args: { header: null, label: 'Supervision' },
	render: () => (
		<Host width={400}>
			<SupervisionSideRoom withBanner />
		</Host>
	),
	play: async ({ canvasElement }) => {
		await expectRealChatParts(canvasElement, 4);
		const title =
			canvasElement.querySelector<HTMLElement>('.infoBanner__title')!;
		// One line: the title must not wrap letter by letter in a narrow pane.
		await expect(title.getBoundingClientRect().height).toBeLessThan(24);
	}
};

export const Phone390: Story = {
	name: 'Phone 390 — fullscreen with back + FAB switcher',
	globals: phone390Globals,
	args: { header: null, label: 'Supervision' },
	render: () => (
		<ChatStageProviders>
			<div style={{ width: 390, height: 844, display: 'flex' }}>
				<SupervisionSideRoom
					variant="fullscreen"
					onBack={noop}
					switcher={
						<ChannelSwitcherFab
							channels={[
								{
									id: 'supervision',
									kind: 'supervision',
									label: SUPERVISOR_NAME
								}
							]}
							activeChannelId="supervision"
							onSelect={noop}
							onBack={noop}
							bottomOffset={16}
						/>
					}
				/>
			</div>
		</ChatStageProviders>
	),
	play: async ({ canvasElement }) => {
		await expectRealChatParts(canvasElement, 4);
		await expect(
			canvasElement.querySelector('[data-cy="panel-header-back"]')
		).not.toBeNull();
		await expect(
			canvasElement.querySelector('[data-cy="channel-switcher-fab"]')
		).not.toBeNull();
	}
};
