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
import { GuestRetentionDivider } from './GuestRetentionDivider';
import { KeepMessagesDialog } from './KeepMessagesDialog';
import { MessageRetention } from './messageRetention';

/**
 * #1869 — the platform setting (ORISO-Admin#1241) decides per temporary account:
 * always temporary, the guest decides, or always kept.
 * Marker and divider are the counsellor's view only. The guest gets the
 * normal asker chat, unchanged; only the keep-messages dialog is theirs.
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
			<GuestRetentionDivider retention={retention} />
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
	name: 'Counsellor view — temporary message, own row under the time',
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
	name: 'Counsellor view — guest messages are temporary',
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
			canvas.getByTestId('guest-retention-divider')
		).toHaveTextContent('Gastkonto · Temporär');
	}
};

export const TimelineTemporaryPhone: Story = {
	name: 'Counsellor view — temporary, phone 390',
	globals: phone390Globals,
	render: () => <Timeline compact retention="delete" />
};

export const TimelineKept: Story = {
	name: 'Counsellor view — guest chose to keep the messages',
	render: () => <Timeline retention="keep" />,
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(
			canvas.queryByTestId('temporary-message-marker')
		).toBeNull();
		await expect(
			canvas.getByTestId('guest-retention-divider')
		).toHaveTextContent(/^Gastkonto$/);
	}
};

const DeletedGuestTimeline = () => {
	const { t } = useTranslation();
	const deleted = t('temporaryAccount.deletedGuest');
	return (
		<MessageContextShell>
			<GuestRetentionDivider retention="keep" />
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
	name: 'Counsellor view — after deletion, "Gast (gelöscht)"',
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

export const RetentionDividers: Story = {
	name: 'Counsellor view — divider, both outcomes',
	render: () => (
		<div style={{ maxWidth: 600, padding: 24 }}>
			<GuestRetentionDivider retention="delete" />
			<GuestRetentionDivider retention="keep" />
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
			within(dialog).getByRole('radio', {
				name: /Auch nach dem Löschen behalten/
			})
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

/** The parent closes the dialog on cancel, as the app will. */
const EscapeDialogStory = (args: DialogStoryArgs) => {
	const [open, setOpen] = React.useState(true);
	return (
		<KeepMessagesDialog
			open={open}
			sheet={false}
			onConfirm={args.onConfirm}
			onCancel={() => {
				args.onCancel();
				setOpen(false);
			}}
		/>
	);
};

export const KeepMessagesEscapeDecidesNothing: Story = {
	name: '"Keep my messages?" — Escape cancels, never decides',
	render: (args) => <EscapeDialogStory {...args} />,
	play: async ({ args }) => {
		const { onConfirm, onCancel } = args;
		const body = within(document.body);
		const dialog = await body.findByTestId('keep-messages-dialog');
		await userEvent.click(
			within(dialog).getByRole('radio', {
				name: /^Temporär/
			})
		);
		await userEvent.keyboard('{Escape}');
		await expect(onCancel).toHaveBeenCalled();
		await expect(onConfirm).not.toHaveBeenCalled();
		await waitFor(() =>
			expect(body.queryByTestId('keep-messages-dialog')).toBeNull()
		);
	}
};
