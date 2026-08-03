import type { Meta, StoryObj } from '@storybook/react';

import { E2EEActivatedMessage } from './E2EEActivatedMessage';
import {
	mobileParameters,
	phone390Globals,
	type MessageStoryParameters,
	withMessageShell
} from './messageStoryShell';
import './message.styles.scss';

/**
 * The encryption banner shown at the top of a conversation. It takes no props —
 * the only things that vary are the locale and the available width, and both
 * matter: the German string is noticeably longer than the English one.
 */
const meta = {
	title: 'Components/Chat/E2EEActivatedMessage',
	component: E2EEActivatedMessage,
	tags: ['autodocs'],
	parameters: {
		layout: 'fullscreen',
		docs: {
			description: {
				component:
					'Propless banner rendering the `e2ee.hint` translation next to a shield icon. Switch the locale in the toolbar to check the wrapping — this string is one of the longer ones in the chat surface.'
			}
		}
	},
	decorators: [
		(Story, ctx) =>
			withMessageShell(Story, {
				parameters: ctx.parameters as MessageStoryParameters
			})
	]
} satisfies Meta<typeof E2EEActivatedMessage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
	name: 'Desktop (1000px)'
};

export const Mobile: Story = {
	name: 'Mobile (390px)',
	globals: phone390Globals,
	parameters: {
		...mobileParameters,
		docs: {
			description: {
				story: 'At 390px the German hint wraps to several lines. The shield icon must stay aligned to the first line rather than centring against the whole block.'
			}
		}
	}
};

export const InDarkSurface: Story = {
	name: 'On dark background',
	parameters: {
		backgrounds: { default: 'dark' },
		docs: {
			description: {
				story: 'The banner is placed on the session background rather than on a bubble. This story surfaces any hard-coded light-only colour.'
			}
		}
	}
};
