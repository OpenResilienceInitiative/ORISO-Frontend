/**
 * The intro notice at the top of a side chat (Teamberatung, Supervision) with
 * its "Nicht mehr einblenden" button. The notice is the Erstantwort organism
 * the side room already used (T49); the button is that organism's own action
 * pill, put in through its `slots`. Dismissing it hides the notice for this
 * counsellor in both rooms of that kind, and the choice is kept
 * (`sideChatIntroPreference`, per user, read back after a reload).
 *
 * The timeline here is built exactly as in `SessionItemComponent`:
 * `buildSupervisionTimeline` with `dismissKind` and the hook's `dismissed`.
 */
import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { useTranslation } from 'react-i18next';
import { MessageTimeline } from '../session/MessageTimeline';
import { buildSupervisionTimeline } from '../session/sessionHelpers';
import { mockE2eeParams } from '../message/MessageItemComponent.mocks';
import { ChatStageProviders } from './__storybook__/ChatStageProviders';
import {
	CLIENT_MATRIX_ID,
	counsellorUserData,
	isCounsellorMessage,
	SUPERVISION_ROOM_ID,
	SUPERVISOR_NAME,
	supervisionMessages,
	TEAM_ROOM_ID,
	teamMessages,
	stageRoute
} from './__storybook__/chatStageFixtures';
import { teamCopy } from './teamChannelCopy';
import {
	SIDE_CHAT_INTRO_STORAGE_KEY,
	type SideChatIntroKind,
	isSideChatIntroDismissed,
	setSideChatIntroDismissed,
	useSideChatIntroDismissed
} from './sideChatIntroPreference';
import '../message/message.styles.scss';
import '../session/session.styles.scss';
import './sidePanel.styles.scss';

const noop = () => {};

function SideChatTimeline({ kind }: { kind: SideChatIntroKind }) {
	const { t } = useTranslation();
	const [dismissed] = useSideChatIntroDismissed(kind);
	const messages = React.useMemo(
		() =>
			kind === 'team'
				? buildSupervisionTimeline(teamMessages(), {
						roomId: TEAM_ROOM_ID,
						title: teamCopy(t)('chatStage.panel.team.title'),
						description: teamCopy(t)(
							'chatStage.panel.team.systemNotice'
						),
						dismissKind: 'team',
						dismissed
					})
				: buildSupervisionTimeline(supervisionMessages(), {
						roomId: SUPERVISION_ROOM_ID,
						title: t('supervision.panel.title'),
						description: t('supervision.panel.systemNotice', {
							name: SUPERVISOR_NAME
						}),
						dismissKind: 'supervision',
						dismissed
					}),
		[t, kind, dismissed]
	);
	return (
		<MessageTimeline
			messages={messages}
			renderMode="main"
			threadsEnabled={false}
			askerMatrixUserIdFor={() => CLIENT_MATRIX_ID}
			isMyMessage={isCounsellorMessage}
			handleDecryptionErrors={noop}
			handleDecryptionSuccess={noop}
			e2eeParams={mockE2eeParams()}
		/>
	);
}

function Host({ kind }: { kind: SideChatIntroKind }) {
	return (
		<ChatStageProviders>
			<div
				data-cy="side-chat-intro-host"
				style={{
					width: 480,
					maxWidth: '100%',
					padding: 24,
					boxSizing: 'border-box',
					background: 'var(--m3-surface-container-high, #eae7e8)'
				}}
			>
				<SideChatTimeline kind={kind} />
			</div>
		</ChatStageProviders>
	);
}

const resetPreference = () => {
	window.localStorage.removeItem(SIDE_CHAT_INTRO_STORAGE_KEY);
	return resetPreference;
};

const presetDismissed = (kind: SideChatIntroKind) => () => {
	resetPreference();
	setSideChatIntroDismissed(counsellorUserData.userId, kind, true);
	return resetPreference;
};

const NOTICE = '[data-message-id="$supervision-system-notice"]';

const meta = {
	title: 'Components/Session/SideChatIntroNotice',
	component: Host,
	parameters: {
		layout: 'fullscreen',
		router: { initialPath: stageRoute },
		docs: {
			description: {
				component:
					'Intro notice of the Teamberatung and Supervision side chats with "Nicht mehr einblenden". The choice is saved per counsellor; once dismissed the room starts with its first message.'
			}
		}
	}
} satisfies Meta<typeof Host>;

export default meta;
type Story = StoryObj<typeof meta>;

const dismissFlow =
	(kind: SideChatIntroKind, noticeText: RegExp) =>
	async ({ canvasElement }: { canvasElement: HTMLElement }) => {
		const canvas = within(canvasElement);
		await waitFor(() =>
			expect(canvasElement.querySelector(NOTICE)).not.toBeNull()
		);
		await expect(canvasElement.querySelector(NOTICE)!.textContent).toMatch(
			noticeText
		);
		const button = canvas.getByRole('button', {
			name: 'Nicht mehr einblenden'
		});
		await userEvent.click(button);
		await waitFor(() =>
			expect(canvasElement.querySelector(NOTICE)).toBeNull()
		);
		// Saved for this counsellor — a reload reads it back.
		await expect(
			isSideChatIntroDismissed(counsellorUserData.userId, kind)
		).toBe(true);
		// The room keeps its messages, and its first one keeps the day pill.
		await expect(
			canvasElement.querySelectorAll('.messageItem[data-message-id]')
				.length
		).toBeGreaterThan(0);
	};

const expectShown =
	(noticeText: RegExp) =>
	async ({ canvasElement }: { canvasElement: HTMLElement }) => {
		await waitFor(() =>
			expect(canvasElement.querySelector(NOTICE)).not.toBeNull()
		);
		await expect(canvasElement.querySelector(NOTICE)!.textContent).toMatch(
			noticeText
		);
		await waitFor(() =>
			expect(
				within(canvasElement).getByRole('button', {
					name: 'Nicht mehr einblenden'
				})
			).toBeVisible()
		);
	};

const expectDismissed = async ({
	canvasElement
}: {
	canvasElement: HTMLElement;
}) => {
	await waitFor(() =>
		expect(
			canvasElement.querySelectorAll('.messageItem[data-message-id]')
				.length
		).toBeGreaterThan(0)
	);
	await expect(canvasElement.querySelector(NOTICE)).toBeNull();
	await expect(
		within(canvasElement).queryByRole('button', {
			name: 'Nicht mehr einblenden'
		})
	).toBeNull();
};

export const TeamShown: Story = {
	name: 'Teamberatung — intro shown',
	args: { kind: 'team' },
	beforeEach: resetPreference,
	play: expectShown(/läuft parallel zur Beratung/)
};

export const TeamDismissClick: Story = {
	name: 'Teamberatung — "Nicht mehr einblenden" hides and saves',
	args: { kind: 'team' },
	beforeEach: resetPreference,
	play: dismissFlow('team', /läuft parallel zur Beratung/)
};

export const TeamDismissed: Story = {
	name: 'Teamberatung — intro dismissed',
	args: { kind: 'team' },
	beforeEach: presetDismissed('team'),
	play: expectDismissed
};

export const SupervisionShown: Story = {
	name: 'Supervision — intro shown',
	args: { kind: 'supervision' },
	beforeEach: resetPreference,
	play: expectShown(/Supervision durch/)
};

export const SupervisionDismissClick: Story = {
	name: 'Supervision — "Nicht mehr einblenden" hides and saves',
	args: { kind: 'supervision' },
	beforeEach: resetPreference,
	play: dismissFlow('supervision', /Supervision durch/)
};

export const SupervisionDismissed: Story = {
	name: 'Supervision — intro dismissed',
	args: { kind: 'supervision' },
	beforeEach: presetDismissed('supervision'),
	play: expectDismissed
};
