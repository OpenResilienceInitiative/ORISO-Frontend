import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { ConversationPreview } from './ConversationPreview';
import { setMatrixClientServiceRef } from '../../services/matrixClientRegistry';

const minutesAgo = (minutes: number) => Date.now() - minutes * 60 * 1000;

const fakeEvent = (
	id: string,
	sender: string,
	body: string,
	minutes: number,
	extraContent: Record<string, unknown> = {}
) => ({
	getType: () => 'm.room.message',
	getClearContent: () => ({ msgtype: 'm.text', body, ...extraContent }),
	getContent: () => ({ msgtype: 'm.text', body, ...extraContent }),
	getSender: () => sender,
	getTs: () => minutesAgo(minutes),
	getId: () => id
});

const NAMES: Record<string, string> = {
	'@lisa:oriso': 'Neugieriger Fuchs 42',
	'@marge:oriso': 'Marge Bouvier'
};

const seedRegistry = (events: any[], roomExists = true) => {
	const room = roomExists
		? {
				roomId: '!preview:oriso',
				getMember: (senderId: string) => ({
					name: NAMES[senderId] || senderId
				})
			}
		: null;
	setMatrixClientServiceRef({
		getClient: () => ({
			getUserId: () => '@marge:oriso',
			on: () => undefined,
			off: () => undefined
		}),
		getRoom: () => room,
		getRoomMessages: () => events
	} as any);
};

const meta: Meta<typeof ConversationPreview> = {
	title: 'Organisms/ConversationPreview',
	component: ConversationPreview
};
export default meta;

type Story = StoryObj<typeof ConversationPreview>;

export const FilledConversation: Story = {
	decorators: [
		(StoryComponent) => {
			seedRegistry([
				fakeEvent(
					'$1',
					'@lisa:oriso',
					'Hallo, ich weiß gerade nicht weiter. Kann ich mit jemandem sprechen?',
					48
				),
				fakeEvent(
					'$2',
					'@marge:oriso',
					'Natürlich — schön, dass Sie sich melden. Erzählen Sie in Ruhe.',
					44
				),
				fakeEvent(
					'$3',
					'@lisa:oriso',
					'Es geht um die Situation zu Hause. Seit ein paar Wochen wird alles zu viel.',
					40
				),
				fakeEvent('$4', '@lisa:oriso', 'Anhang', 12, {
					msgtype: 'm.file',
					url: 'mxc://oriso/abc',
					info: { mimetype: 'application/pdf', size: 12345 },
					body: 'unterlagen.pdf'
				})
			]);
			return (
				<div style={{ height: 480, width: 640, display: 'flex' }}>
					<StoryComponent />
				</div>
			);
		}
	],
	args: { roomId: '!preview:oriso' }
};

export const RoomNotSynced: Story = {
	decorators: [
		(StoryComponent) => {
			seedRegistry([], false);
			return (
				<div style={{ height: 320, width: 640, display: 'flex' }}>
					<StoryComponent />
				</div>
			);
		}
	],
	args: { roomId: '!missing:oriso' }
};
