import * as React from 'react';
import type { Decorator, Meta, StoryObj } from '@storybook/react-vite';
import { useTranslation } from 'react-i18next';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { a11yExcept } from '../../../.storybook/a11yExceptions';
import { setMatrixClientServiceRef } from '../../services/matrixClientRegistry';
import { MessageContextShell } from '../message/messageStoryShell';
import {
	buildMockActiveSession,
	ComposerStoryDecorator
} from '../messageSubmitInterface/__storybook__/composerStoryDecorator';
import { ActivityEventBar } from './ActivityEventBar';
import { ConversationPreview } from './ConversationPreview';
import { installActiveViewWatcher } from './activeViewWatcher';
import { getEventDescriptor } from './eventDescriptors';
import { getEventIcon } from './eventDescriptors/icons';
import type { PreviewCapabilities } from './previewCapabilities';
import { formatAbsoluteTime } from './timelineTime';
import './notificationsCenter.styles.scss';

/**
 * #2226 (Frank, 2026-11-12): a call or appointment entry in the Activity
 * Timeline shows the conversation it belongs to — the same preview as a
 * message entry — under a compact bar with the title, the time and the Join
 * button. Selecting the entry never joins and never marks the conversation
 * read; joining happens only through the button.
 */

const ROOM = '!preview:oriso';
const openedAt = Date.parse('2026-11-11T14:57:00+01:00');

const fakeEvent = (id: string, sender: string, body: string, ts: number) => ({
	getType: () => 'm.room.message',
	getClearContent: () => ({ msgtype: 'm.text', body }),
	getContent: () => ({ msgtype: 'm.text', body }),
	getSender: () => sender,
	getTs: () => ts,
	getId: () => id
});

const NAMES: Record<string, string> = {
	'@lisa:oriso': 'Neugieriger Fuchs 42',
	'@marge:oriso': 'Marge Bouvier'
};

/* Every write the real chat performs on open; the play test proves the
   preview performs none (#1824 rule 2). */
const writeCalls: string[] = [];
const activeViewCalls: string[] = [];
const recordWrite = (name: string) => () => {
	writeCalls.push(name);
	return Promise.resolve({});
};

const seedConversation = () => {
	writeCalls.length = 0;
	const room = {
		roomId: ROOM,
		getMember: (senderId: string) => ({ name: NAMES[senderId] || senderId })
	};
	setMatrixClientServiceRef({
		getClient: () => ({
			getUserId: () => '@marge:oriso',
			getRoom: () => room,
			on: () => undefined,
			off: () => undefined,
			removeListener: () => undefined,
			sendReadReceipt: recordWrite('sendReadReceipt'),
			sendReceipt: recordWrite('sendReceipt'),
			setRoomReadMarkers: recordWrite('setRoomReadMarkers'),
			sendEvent: recordWrite('sendEvent')
		}),
		getRoomMessages: () => [
			fakeEvent(
				'$1',
				'@marge:oriso',
				'Willkommen in der Gruppe Schulden. Wir starten heute um 15 Uhr online.',
				openedAt - 60 * 60 * 1000
			),
			fakeEvent(
				'$2',
				'@lisa:oriso',
				'Danke! Ich bin dabei, komme vielleicht ein paar Minuten später.',
				openedAt - 20 * 60 * 1000
			),
			fakeEvent(
				'$3',
				'@marge:oriso',
				'Kein Problem. Der Raum ist jetzt offen.',
				openedAt - 60 * 1000
			)
		]
	} as any);
};

const capabilities: PreviewCapabilities = {
	composer: true,
	react: true,
	manageOwn: true,
	threadReply: true,
	readOnlyReason: null,
	contentHidden: false
};

const onJoin = fn();

interface CallEntryPreviewProps {
	eventType: 'group_chat.opened' | 'call.started' | 'call.missed';
}

/** The detail pane of the Timeline as NotificationsCenter renders it. */
const CallEntryPreview = ({ eventType }: CallEntryPreviewProps) => {
	const { t, i18n } = useTranslation();
	const descriptor = getEventDescriptor(eventType);
	const joins = eventType !== 'call.missed';
	return (
		<div className="notificationsCenter__detailCard notificationsCenter__detailCard--embedded">
			<ActivityEventBar
				icon={getEventIcon(descriptor.icon)}
				title={t(descriptor.titleTemplate)}
				time={formatAbsoluteTime(
					new Date(openedAt).toISOString(),
					i18n.language
				)}
				actionLabel={t(
					joins
						? 'notifications.center.join'
						: 'notifications.center.open'
				)}
				onAction={onJoin}
			/>
			<ConversationPreview
				roomId={ROOM}
				access={{ capabilities, session: buildMockActiveSession() }}
			/>
		</div>
	);
};

const pane =
	(width: number | string): Decorator =>
	(StoryComponent) => {
		seedConversation();
		return (
			<ComposerStoryDecorator
				activeSession={buildMockActiveSession()}
				emptyDraftScopes={[`scope:${ROOM}|thread:main`]}
			>
				<div
					style={{
						height: 720,
						width,
						maxWidth: '100%',
						display: 'flex',
						padding: 16,
						boxSizing: 'border-box',
						background: 'var(--m3-surface-container, #eae7e8)'
					}}
				>
					<StoryComponent />
				</div>
			</ComposerStoryDecorator>
		);
	};

const meta: Meta<typeof CallEntryPreview> = {
	title: 'Organisms/NotificationsCenter/CallEntryPreview',
	component: CallEntryPreview,
	args: { eventType: 'group_chat.opened' },
	beforeEach: () => {
		onJoin.mockClear();
		return installActiveViewWatcher(activeViewCalls);
	},
	decorators: [
		(StoryComponent) => (
			<MessageContextShell>
				<StoryComponent />
			</MessageContextShell>
		)
	],
	parameters: {
		layout: 'fullscreen',
		a11y: a11yExcept({
			'scrollable-region-focusable': ['.conversationPreview__messages']
		}),
		docs: {
			description: {
				component:
					'#2226: a call or appointment entry shows its conversation under a compact bar (title, time, Join). Selecting never joins and never marks the conversation read; only the button joins.'
			}
		}
	}
};
export default meta;

type Story = StoryObj<typeof CallEntryPreview>;

const JOIN = /^(Beitreten|Join)$/;

/** Shows the conversation, writes nothing, and joins only on the button. */
const expectConversationThenJoin = async (canvasElement: HTMLElement) => {
	const canvas = within(canvasElement);
	await waitFor(() =>
		expect(canvasElement.querySelector('.messageItem')).not.toBeNull()
	);
	await expect(
		canvasElement.querySelector('[data-cy="activity-event-bar"]')
	).not.toBeNull();
	// Opening the preview does not mark the conversation read (#1824 D2) and
	// never registers the active view.
	await expect(writeCalls).toEqual([]);
	await expect(activeViewCalls).toEqual([]);
	await expect(onJoin).not.toHaveBeenCalled();
	await userEvent.click(canvas.getByRole('button', { name: JOIN }));
	await expect(onJoin).toHaveBeenCalledOnce();
	await expect(writeCalls).toEqual([]);
};

export const AppointmentOpenDesktop: Story = {
	name: 'Online appointment open — desktop, light, de',
	decorators: [pane(1100)],
	globals: { viewport: { value: 'desktop1440' }, locale: 'de' },
	play: async ({ canvasElement }) => expectConversationThenJoin(canvasElement)
};

export const AppointmentOpenDesktopDarkEnglish: Story = {
	name: 'Online appointment open — desktop, dark, en',
	decorators: [pane(1100)],
	globals: {
		viewport: { value: 'desktop1440' },
		locale: 'en',
		scheme: 'dark'
	},
	play: async ({ canvasElement }) => expectConversationThenJoin(canvasElement)
};

export const AppointmentOpenPhone: Story = {
	name: 'Online appointment open — 390 px, light, de',
	decorators: [pane('100%')],
	globals: { viewport: { value: 'phone390' }, locale: 'de' },
	play: async ({ canvasElement }) => {
		await expectConversationThenJoin(canvasElement);
		const bar = canvasElement.querySelector<HTMLElement>(
			'[data-cy="activity-event-bar"]'
		)!;
		// Nothing is cut off at 390 px.
		await expect(bar.scrollWidth).toBeLessThanOrEqual(bar.clientWidth + 1);
	}
};

export const AppointmentOpenPhoneDarkEnglish: Story = {
	name: 'Online appointment open — 390 px, dark, en',
	decorators: [pane('100%')],
	globals: { viewport: { value: 'phone390' }, locale: 'en', scheme: 'dark' },
	play: async ({ canvasElement }) => expectConversationThenJoin(canvasElement)
};

export const CallOngoingDesktop: Story = {
	name: 'Call ongoing — desktop, light, de',
	args: { eventType: 'call.started' },
	decorators: [pane(1100)],
	globals: { viewport: { value: 'desktop1440' }, locale: 'de' },
	play: async ({ canvasElement }) => expectConversationThenJoin(canvasElement)
};

export const MissedCallDesktop: Story = {
	name: 'Missed call — desktop, light, de (opens the chat)',
	args: { eventType: 'call.missed' },
	decorators: [pane(1100)],
	globals: { viewport: { value: 'desktop1440' }, locale: 'de' },
	play: async ({ canvasElement }) => {
		await waitFor(() =>
			expect(canvasElement.querySelector('.messageItem')).not.toBeNull()
		);
		await expect(
			within(canvasElement).getByRole('button', {
				name: /^(Chat öffnen|Open chat)$/
			})
		).toBeInTheDocument();
	}
};
