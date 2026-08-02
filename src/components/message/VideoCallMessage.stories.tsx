import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react';

import { VideoCallMessage } from './VideoCallMessage';
import { MOCK_CONSULTANT_MATRIX_ID } from './MessageItemComponent.mocks';
import {
	mobileParameters,
	withMessageShell,
	type MessageStoryParameters
} from './messageStoryShell';
import './message.styles.scss';

/**
 * The notice left behind by a video call that was not answered.
 *
 * The wording flips on `currentUserWasVideoCallInitiator(initiatorMatrixUserId)`,
 * which compares against the *logged-in* user — so the two stories below are
 * the same event seen from the two sides of the conversation.
 */
const meta = {
	title: 'Components/Chat/VideoCallMessage',
	component: VideoCallMessage,
	tags: ['autodocs'],
	parameters: {
		layout: 'fullscreen',
		docs: {
			description: {
				component:
					'Wraps `SystemMessage` with the call-off icon. Which of the two sentences is rendered depends on whether the logged-in user started the call, not on a prop — so this component cannot be fully exercised by args alone.'
			}
		}
	},
	args: {
		videoCallMessage: {
			initiatorUserName: 'Karina P',
			initiatorMatrixUserId: MOCK_CONSULTANT_MATRIX_ID
		} as any,
		activeSessionUsername: 'sanftes Alpaka Mika',
		activeSessionAskerRcId: 'asker-storybook'
	},
	decorators: [
		(Story, ctx) =>
			withMessageShell(Story, {
				parameters: ctx.parameters as MessageStoryParameters
			})
	]
} satisfies Meta<typeof VideoCallMessage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SeenByRecipient: Story = {
	name: 'Seen by the recipient — "X ignored the call"',
	parameters: {
		docs: {
			description: {
				story: 'The logged-in user did not start the call, so the initiator is named in bold followed by `videoCall.incomingCall.ignored`.'
			}
		}
	}
};

export const LongParticipantName: Story = {
	name: 'Long participant name',
	args: {
		videoCallMessage: {
			initiatorUserName: 'absichtslose Schildkröte Andrea',
			initiatorMatrixUserId: MOCK_CONSULTANT_MATRIX_ID
		} as any,
		activeSessionUsername: 'absichtslose Schildkröte Andrea'
	},
	parameters: {
		docs: {
			description: {
				story: 'Generated animal names are long. The bold name sits inline in the sentence, so it must wrap rather than overflow.'
			}
		}
	}
};

export const Mobile: Story = {
	name: 'Mobile (390px)',
	parameters: mobileParameters
};
