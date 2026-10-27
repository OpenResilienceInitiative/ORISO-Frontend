import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { useTranslation } from 'react-i18next';
import { MessageItemComponent } from '../message/MessageItemComponent';
import {
	MOCK_ASKER_MATRIX_ID,
	MOCK_CONSULTANT_MATRIX_ID,
	mockMessageItemComponentProps
} from '../message/MessageItemComponent.mocks';
import {
	desktop1440Globals,
	MessageContextShell,
	phone390Globals
} from '../message/messageStoryShell';
import '../message/message.styles.scss';
import { GuestRetentionChip } from './GuestRetentionChip';
import { KeepMessagesDialog } from './KeepMessagesDialog';
import { MessageRetention } from './messageRetention';

/**
 * #1869 — Storybook design only, nothing is wired into the app yet.
 * The platform setting (ORISO-Admin#1241) decides per temporary account:
 * always temporary, the guest decides, or always kept.
 */
/** Only the dialog stories use these; the others ignore args. */
type DialogStoryArgs = {
	onConfirm: (choice: MessageRetention) => void;
	onCancel: () => void;
};

const meta = {
	title: 'Components/Chat/Temporary account',
	parameters: { layout: 'fullscreen' },
	args: { onConfirm: fn(), onCancel: fn() }
} satisfies Meta<DialogStoryArgs>;

export default meta;
type Story = StoryObj<DialogStoryArgs>;

const GUEST = 'eule_mika_4821';

const at = (hhmm: string) =>
	String(new Date(`2026-10-27T${hhmm}:00`).getTime());

const guestMessage = (
	id: string,
	message: string,
	time: string,
	extra: Partial<React.ComponentProps<typeof MessageItemComponent>> = {}
) =>
	mockMessageItemComponentProps({
		_id: id,
		message,
		messageTime: at(time),
		isMyMessage: false,
		userId: MOCK_ASKER_MATRIX_ID,
		askerMatrixUserId: MOCK_ASKER_MATRIX_ID,
		displayName: GUEST,
		username: GUEST,
		clientName: GUEST,
		...extra
	});

const counsellorMessage = (id: string, message: string, time: string) =>
	mockMessageItemComponentProps({
		_id: id,
		message,
		messageTime: at(time),
		isMyMessage: true,
		userId: MOCK_CONSULTANT_MATRIX_ID,
		askerMatrixUserId: MOCK_ASKER_MATRIX_ID,
		displayName: 'Karina P.',
		username: 'karina.p',
		clientName: GUEST
	});

/** Stand-in for the conversation header: name plus the retention chip. */
const HeaderStandIn = ({
	name,
	retention
}: {
	name: string;
	retention?: MessageRetention;
}) => (
	<div
		style={{
			display: 'flex',
			alignItems: 'center',
			flexWrap: 'wrap',
			gap: 8,
			paddingBottom: 12,
			marginBottom: 12,
			borderBottom: '1px solid var(--m3-outline-variant, #c4c7c5)'
		}}
	>
		<strong>{name}</strong>
		{retention && <GuestRetentionChip retention={retention} />}
	</div>
);

const Timeline = ({
	compact,
	retention
}: {
	compact?: boolean;
	retention: MessageRetention;
}) => {
	const temporary = retention === 'delete';
	return (
		<MessageContextShell compact={compact}>
			<HeaderStandIn name={GUEST} retention={retention} />
			<MessageItemComponent
				{...guestMessage(
					'g1',
					'Hallo, wir hatten heute Morgen telefoniert.',
					'10:02',
					{ isTemporary: temporary }
				)}
			/>
			<MessageItemComponent
				{...counsellorMessage(
					'c1',
					'Schön, dass Sie da sind. Erzählen Sie gern, was Sie beschäftigt.',
					'10:03'
				)}
			/>
			<MessageItemComponent
				{...guestMessage(
					'g2',
					'Es geht um die Mahnung, die ich letzte Woche bekommen habe.',
					'10:05',
					{ isTemporary: temporary }
				)}
			/>
		</MessageContextShell>
	);
};

export const TemporaryMessage: Story = {
	name: 'Temporary message — label next to the time',
	render: () => (
		<MessageContextShell>
			<MessageItemComponent
				{...guestMessage(
					'g1',
					'Hallo, wir hatten heute Morgen telefoniert.',
					'10:02',
					{ isTemporary: true }
				)}
			/>
		</MessageContextShell>
	),
	play: async ({ canvasElement }) => {
		const marker = await within(canvasElement).findByTestId(
			'temporary-message-marker'
		);
		await expect(marker).toHaveTextContent('Temporär');
		await expect(marker).toHaveAttribute(
			'title',
			'Wird mit dem Gastkonto gelöscht'
		);
	}
};

export const TimelineTemporary: Story = {
	name: 'Timeline — guest messages are temporary',
	render: () => <Timeline retention="delete" />,
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		// Only the guest's two messages carry the label, the counsellor's not.
		await waitFor(() =>
			expect(
				canvas.getAllByTestId('temporary-message-marker')
			).toHaveLength(2)
		);
		await expect(
			canvas.getByTestId('guest-retention-chip')
		).toHaveTextContent('Nachrichten temporär');
	}
};

export const TimelineTemporaryPhone: Story = {
	name: 'Timeline — temporary, phone 390',
	globals: phone390Globals,
	render: () => <Timeline compact retention="delete" />
};

export const TimelineKept: Story = {
	name: 'Timeline — guest chose to keep the messages',
	render: () => <Timeline retention="keep" />,
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(
			canvas.queryByTestId('temporary-message-marker')
		).toBeNull();
		await expect(
			canvas.getByTestId('guest-retention-chip')
		).toHaveTextContent('Nachrichten bleiben');
	}
};

const DeletedGuestTimeline = () => {
	const { t } = useTranslation();
	const deleted = t('temporaryAccount.deletedGuest');
	return (
		<MessageContextShell>
			<HeaderStandIn name={deleted} retention="keep" />
			<MessageItemComponent
				{...guestMessage(
					'g1',
					'Es geht um die Mahnung, die ich letzte Woche bekommen habe.',
					'10:05',
					{
						displayName: deleted,
						username: deleted,
						clientName: deleted
					}
				)}
			/>
			<MessageItemComponent
				{...counsellorMessage(
					'c1',
					'Danke, ich schaue mir das bis morgen an.',
					'10:07'
				)}
			/>
		</MessageContextShell>
	);
};

export const GuestDeletedMessagesKept: Story = {
	name: 'After deletion — kept messages show "Gast (gelöscht)"',
	render: () => <DeletedGuestTimeline />,
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await waitFor(() =>
			expect(
				canvas.getAllByText('Gast (gelöscht)').length
			).toBeGreaterThan(0)
		);
	}
};

export const RetentionChips: Story = {
	name: 'Header chip — both outcomes',
	render: () => (
		<div style={{ display: 'flex', gap: 12, padding: 24 }}>
			<GuestRetentionChip retention="delete" />
			<GuestRetentionChip retention="keep" />
		</div>
	)
};

export const KeepMessagesDesktop: Story = {
	name: '"Keep my messages?" — desktop dialog',
	globals: desktop1440Globals,
	render: (args) => (
		<KeepMessagesDialog
			sheet={false}
			onConfirm={args.onConfirm}
			onCancel={args.onCancel}
		/>
	),
	play: async ({ args }) => {
		const { onConfirm } = args;
		const body = within(document.body);
		const dialog = await body.findByTestId('keep-messages-dialog');
		const confirm = within(dialog).getByRole('button', { name: 'Weiter' });
		// Nothing is preselected: the person has to choose.
		await expect(confirm).toBeDisabled();
		await userEvent.click(
			within(dialog).getByRole('radio', { name: /Nachrichten behalten/ })
		);
		await expect(confirm).toBeEnabled();
		await userEvent.click(confirm);
		await expect(onConfirm).toHaveBeenCalledWith('keep');
	}
};

export const KeepMessagesPhone: Story = {
	name: '"Keep my messages?" — phone bottom sheet 390',
	globals: phone390Globals,
	render: (args) => (
		<KeepMessagesDialog
			sheet
			onConfirm={args.onConfirm}
			onCancel={args.onCancel}
		/>
	)
};

export const KeepMessagesEscapeDecidesNothing: Story = {
	name: '"Keep my messages?" — Escape cancels, never decides',
	render: (args) => (
		<KeepMessagesDialog
			sheet={false}
			onConfirm={args.onConfirm}
			onCancel={args.onCancel}
		/>
	),
	play: async ({ args }) => {
		const { onConfirm, onCancel } = args;
		const dialog = await within(document.body).findByTestId(
			'keep-messages-dialog'
		);
		await userEvent.click(
			within(dialog).getByRole('radio', { name: /Mit dem Konto löschen/ })
		);
		await userEvent.keyboard('{Escape}');
		await expect(onCancel).toHaveBeenCalled();
		await expect(onConfirm).not.toHaveBeenCalled();
	}
};
