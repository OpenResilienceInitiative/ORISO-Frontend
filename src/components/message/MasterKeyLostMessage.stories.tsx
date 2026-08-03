import type { Meta, StoryObj } from '@storybook/react';

import { MasterKeyLostMessage } from './MasterKeyLostMessage';
import {
	mobileParameters,
	withMessageShell,
	type MessageStoryParameters
} from './messageStoryShell';
import './message.styles.scss';

/**
 * Shown when a message cannot be decrypted. The single boolean prop selects
 * between two different translated explanations
 * (`e2ee.subscriptionKeyLost.message.{true|false}`), and the notice carries a
 * button that opens the recovery overlay.
 *
 * This is the one place in the chat where the platform tells someone their
 * history is gone, so both wordings are worth having side by side.
 */
const meta = {
	title: 'Components/Chat/MasterKeyLostMessage',
	component: MasterKeyLostMessage,
	tags: ['autodocs'],
	parameters: {
		layout: 'fullscreen',
		docs: {
			description: {
				component:
					'Built on `SystemMessage` with the info icon. `subscriptionKeyLost` picks the wording; the button opens `subscriptionKeyLostOverlayItem`.'
			}
		}
	},
	args: { subscriptionKeyLost: true },
	decorators: [
		(Story, ctx) =>
			withMessageShell(Story, {
				parameters: ctx.parameters as MessageStoryParameters
			})
	]
} satisfies Meta<typeof MasterKeyLostMessage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SubscriptionKeyLost: Story = {
	name: 'Room key lost',
	args: { subscriptionKeyLost: true }
};

export const MasterKeyLost: Story = {
	name: 'Master key lost',
	args: { subscriptionKeyLost: false }
};

export const Mobile: Story = {
	name: 'Mobile (390px)',
	args: { subscriptionKeyLost: true },
	parameters: {
		...mobileParameters,
		docs: {
			description: {
				story: 'The explanation is long and sits next to an icon; at 390px it must not push its button off the card.'
			}
		}
	}
};
