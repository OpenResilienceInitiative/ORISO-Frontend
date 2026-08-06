import type { Meta, StoryObj } from '@storybook/react';

import { MessageDisplayName } from './MessageDisplayName';
import {
	mobileParameters,
	phone390Globals,
	type MessageStoryParameters,
	withMessageShell
} from './messageStoryShell';
import './message.styles.scss';

/**
 * The name line above a message bubble. Four visual types, and one behavioural
 * rule that is easy to break: `type: 'system'` ignores every name prop and
 * renders the translated system label instead.
 */
const meta = {
	title: 'Components/Chat/MessageDisplayName',
	component: MessageDisplayName,
	tags: ['autodocs'],
	parameters: {
		layout: 'fullscreen',
		docs: {
			description: {
				component:
					'Name line above a bubble. The `type` drives the `messageItem__username--{type}` modifier. Name resolution goes through `formatMessagePersonName(displayName, username, firstName, lastName)` — except for `system`, which always renders the `message.systemNotification` translation and ignores the name props entirely.'
			}
		}
	},
	args: {
		isUser: true,
		isMyMessage: false,
		type: 'user',
		userId: '@sanftes.alpaka:oriso.invalid',
		username: 'sanftes_alpaka_4821'
	},
	decorators: [
		(Story, ctx) =>
			withMessageShell(Story, {
				parameters: ctx.parameters as MessageStoryParameters
			})
	]
} satisfies Meta<typeof MessageDisplayName>;

export default meta;
type Story = StoryObj<typeof meta>;

export const AdviceSeekerWithDisplayName: Story = {
	name: 'Advice seeker — generated display name',
	args: {
		type: 'user',
		displayName: 'sanftes Alpaka Mika'
	},
	parameters: {
		docs: {
			description: {
				story: 'The normal anonymous case: the generated `adjective + animal + name` display name, not the login name.'
			}
		}
	}
};

export const AdviceSeekerUsernameFallback: Story = {
	name: 'Advice seeker — no display name (username fallback)',
	args: { type: 'user', displayName: undefined },
	parameters: {
		docs: {
			description: {
				story: 'Falls back to the login name. Worth keeping visible: this is the state in which the cryptic identifier leaks into the UI.'
			}
		}
	}
};

export const Consultant: Story = {
	name: 'Counsellor — first + last name',
	args: {
		type: 'consultant',
		username: 'karina.p@oriso.invalid',
		firstName: 'Karina',
		lastName: 'P'
	}
};

export const Self: Story = {
	name: 'Own message',
	args: {
		type: 'self',
		isMyMessage: true,
		username: 'karina.p@oriso.invalid',
		displayName: 'Karina P'
	}
};

export const SystemNotification: Story = {
	name: 'System — name props ignored',
	args: {
		type: 'system',
		username: 'this-is-ignored',
		displayName: 'so-is-this'
	},
	parameters: {
		docs: {
			description: {
				story: 'Renders the `message.systemNotification` translation regardless of the name props. This is the line that sits above a Carimat bubble.'
			}
		}
	}
};

export const LongName: Story = {
	name: 'Long display name',
	args: {
		type: 'user',
		displayName: 'absichtslose Schildkröte Andrea'
	},
	parameters: {
		docs: {
			description: {
				story: 'The generator can produce long German compounds; the name line must not push the bubble layout.'
			}
		}
	}
};

export const Mobile: Story = {
	name: 'Mobile (390px) — long name',
	args: {
		type: 'user',
		displayName: 'absichtslose Schildkröte Andrea'
	},
	parameters: mobileParameters,
	globals: phone390Globals
};
