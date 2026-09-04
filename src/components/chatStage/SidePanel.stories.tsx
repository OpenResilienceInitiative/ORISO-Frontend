/**
 * The side room built from real chat organisms only: `PanelHeader` (room
 * header tokens) · `MessageTimeline` (the real `MessageItemComponent`) ·
 * the real `MessageSubmitInterfaceComponent` with `targetRoomId`.
 */
import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, waitFor, within } from 'storybook/test';
import { useTranslation } from 'react-i18next';
import { SidePanel, InfoBanner, type SidePanelVariant } from './SidePanel';
import { PanelHeader } from './PanelHeader';
import { ChannelSwitcherFab } from './ChannelSwitcherFab';
import { MessageTimeline } from '../session/MessageTimeline';
import { MessageSubmitInterfaceComponent } from '../messageSubmitInterface/messageSubmitInterfaceComponent';
import { mockE2eeParams } from '../message/MessageItemComponent.mocks';
import { phone390Globals } from '../message/messageStoryShell';
import { ChatStageProviders } from './__storybook__/ChatStageProviders';
import {
	CLIENT_NAME,
	CLIENT_MATRIX_ID,
	isCounsellorMessage,
	SUPERVISION_ROOM_ID,
	SUPERVISOR_NAME,
	supervisionMessages,
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
	unread = 0,
	onBack,
	switcher
}: {
	variant?: SidePanelVariant;
	withBanner?: boolean;
	empty?: boolean;
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
						messages={supervisionMessages()}
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
