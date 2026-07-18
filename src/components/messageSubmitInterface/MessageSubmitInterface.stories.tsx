import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { MessageSubmitInterfaceComponent } from './messageSubmitInterfaceComponent';
import {
	buildMockActiveSession,
	buildMockGroupSession,
	ComposerStoryDecorator,
	storybookGroupRoomMembers
} from './__storybook__/composerStoryDecorator';
import './messageSubmitInterface.styles.scss';

const INPUT_FIELD_FIGMA_URL =
	'https://www.figma.com/design/L2mOFNSGdxPPx1XA4HFAog/App.Oriso?node-id=18-1989';

const shellStyle: React.CSSProperties = {
	background: '#eae7e8',
	// Tall enough that the docked toolbar menus (which open upward, like in
	// the app where the composer sits at the bottom of the screen) stay
	// visible inside the story canvas.
	minHeight: 560,
	padding: 24,
	position: 'relative',
	boxSizing: 'border-box',
	display: 'flex',
	flexDirection: 'column',
	justifyContent: 'flex-end'
};

function ComposerShell({
	activeSession,
	roomMembers,
	...composerProps
}: {
	activeSession?: any;
	roomMembers?: Array<{ userId: string; name: string }>;
} & Partial<React.ComponentProps<typeof MessageSubmitInterfaceComponent>>) {
	return (
		<div className="session" style={shellStyle}>
			<ComposerStoryDecorator
				activeSession={activeSession}
				roomMembers={roomMembers}
			>
				<MessageSubmitInterfaceComponent
					placeholder="Nachricht an Klient:in schreiben"
					onSendButton={() => {}}
					isTyping={() => {}}
					language="de"
					{...composerProps}
				/>
			</ComposerStoryDecorator>
		</div>
	);
}

const meta = {
	title: 'Components/Message/MessageSubmitInterface',
	tags: ['autodocs'],
	parameters: {
		layout: 'fullscreen',
		backgrounds: { default: 'gray' },
		design: [
			{
				type: 'figma',
				name: 'Input Field (Organism)',
				url: INPUT_FIELD_FIGMA_URL
			}
		],
		docs: {
			description: {
				component:
					'The REAL chat composer (`MessageSubmitInterfaceComponent`) mounted with mocked session/user/transport contexts. ' +
					'Every state shown here is produced by the production component — no visual mocks. ' +
					'Interactions (typing, toolbar, send states) behave exactly as in the app layer.'
			}
		}
	}
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
	name: 'Default (empty)',
	render: () => <ComposerShell />
};

export const ReadyToSend: Story = {
	name: 'Ready to send (typed)',
	render: () => <ComposerShell />,
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const editor = await waitFor(() => {
			const node = canvasElement.querySelector<HTMLElement>(
				'[contenteditable="true"]'
			);
			if (!node) {
				throw new Error('composer editor not mounted yet');
			}
			return node;
		});

		await userEvent.click(editor);
		await userEvent.keyboard('Writing');

		await waitFor(async () => {
			const sendButton = canvas.getByRole('button', {
				name: /senden|send/i
			});
			await expect(sendButton).toBeEnabled();
		});
	}
};

export const ReplyingToMessage: Story = {
	name: 'Replying (m.in_reply_to preview)',
	render: () => (
		<ComposerShell
			replyTo={{
				eventId: '$orig:matrix.oriso.org',
				author: 'Maria K.',
				text: 'Ich habe seit letzter Woche große Probleme mit meinem Vermieter und weiß nicht weiter.'
			}}
			onCancelReply={() => {}}
		/>
	)
};

export const EditingMessage: Story = {
	name: 'Editing (m.replace preview)',
	render: () => (
		<ComposerShell
			editingMessage={{
				eventId: '$orig:matrix.oriso.org',
				text: 'Ich habe seit letzter Woche große Problem mit meinem Vermieter und weiß nicht weiter.'
			}}
			onCancelEdit={() => {}}
		/>
	)
};

export const GroupChat: Story = {
	name: 'Group chat (multiple recipients)',
	render: () => (
		<ComposerShell
			activeSession={buildMockGroupSession()}
			roomMembers={storybookGroupRoomMembers}
		/>
	)
};

export const Supervisor: Story = {
	name: 'Supervisor aside',
	render: () => (
		<ComposerShell
			activeSession={buildMockActiveSession()}
			isSupervisor={true}
		/>
	)
};

export const Mobile: Story = {
	parameters: {
		viewport: { defaultViewport: 'mobile1' }
	},
	render: () => <ComposerShell />
};
