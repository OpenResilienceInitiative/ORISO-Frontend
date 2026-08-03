import type { Meta, StoryObj } from '@storybook/react';

import { AUTHORITIES } from '../../globalState';
import { MessageMetaData } from './MessageMetaData';
import {
	mockActiveSession1on1,
	mockActiveSessionGroup,
	mockUserData
} from './MessageItemComponent.mocks';
import {
	mobileParameters,
	phone390Globals,
	type MessageStoryParameters,
	withMessageContexts
} from './messageStoryShell';
import './message.styles.scss';

/**
 * Time + delivery state in the bubble's footer row.
 *
 * The read status is deliberately suppressed in five separate situations, and
 * every one of them is a privacy or product decision rather than a styling
 * choice — hence one story each:
 *
 * - the viewer is an advice seeker (they never see whether staff read them)
 * - `isReadStatusDisabled`
 * - the session is a group
 * - `type === 'user'`
 * - `t === 'rm'` (removed/redacted message)
 */
const meta = {
	title: 'Components/Chat/MessageMetaData',
	component: MessageMetaData,
	tags: ['autodocs'],
	parameters: {
		layout: 'fullscreen',
		docs: {
			description: {
				component:
					'Bubble footer: `formatToHHMM(messageTime)` plus an optional checkmark. `isNotRead` switches the checkmark to the grey `--grey` modifier and the label from `message.read` to `message.sent`.'
			}
		}
	},
	args: {
		isMyMessage: true,
		isNotRead: true,
		isReadStatusDisabled: false,
		messageTime: '2026-07-30T09:41:00.000Z',
		type: 'consultant',
		t: null
	},
	decorators: [
		(Story, ctx) =>
			withMessageContexts(Story, {
				parameters: ctx.parameters as MessageStoryParameters
			})
	]
} satisfies Meta<typeof MessageMetaData>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SentNotRead: Story = {
	name: 'Sent, not yet read (grey check)',
	args: { isNotRead: true }
};

export const Read: Story = {
	name: 'Read (solid check)',
	args: { isNotRead: false }
};

export const AskerViewNoReadStatus: Story = {
	name: 'Advice-seeker view — no read status',
	parameters: {
		userData: mockUserData({
			grantedAuthorities: [AUTHORITIES.ASKER_DEFAULT],
			userId: 'asker-storybook'
		}),
		docs: {
			description: {
				story: 'An advice seeker never learns whether their message was read. Only the time remains.'
			}
		}
	}
};

export const ReadStatusDisabled: Story = {
	name: 'Read status disabled',
	args: { isReadStatusDisabled: true }
};

export const GroupSessionNoReadStatus: Story = {
	name: 'Group session — no read status',
	parameters: {
		activeSession: mockActiveSessionGroup(),
		docs: {
			description: {
				story: '"Read" has no single meaning with several recipients, so the checkmark is suppressed for groups.'
			}
		}
	}
};

export const TypeUserNoReadStatus: Story = {
	name: "type='user' — no read status",
	args: { type: 'user' }
};

export const RemovedMessage: Story = {
	name: "t='rm' — no read status",
	args: { t: 'rm' as const },
	parameters: {
		activeSession: mockActiveSession1on1(),
		docs: {
			description: {
				story: 'A removed message keeps its timestamp but loses the delivery state.'
			}
		}
	}
};

export const NoTimestamp: Story = {
	name: 'Missing timestamp',
	args: { messageTime: '' },
	parameters: {
		docs: {
			description: {
				story: 'Renders an empty string rather than "Invalid Date". Worth pinning — the component returns `\'\'`, not `null`.'
			}
		}
	}
};

export const Mobile: Story = {
	name: 'Mobile (390px)',
	args: { isNotRead: false },
	parameters: mobileParameters,
	globals: phone390Globals
};
