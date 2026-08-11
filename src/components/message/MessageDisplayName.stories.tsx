import type { Meta, StoryObj } from '@storybook/react';

import { MessageDisplayName } from './MessageDisplayName';
import {
	mobileParameters,
	phone375Globals,
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

export const ConsultantWithAgency: Story = {
	name: 'Counsellor — with counselling centre',
	args: {
		type: 'consultant',
		isUser: false,
		displayName: 'Beratende Person Kim G.',
		subtitle: '54222 Caritas Mainz'
	},
	parameters: {
		docs: {
			description: {
				story: 'Figma "Message Recipient Header" (App.Oriso 9229:24595). The second line names the counselling centre the counsellor speaks for, prefixed by its postcode — the value the advice seeker actually chose their agency by during registration. See #895.'
			}
		}
	}
};

export const ConsultantWithoutAgency: Story = {
	name: 'Counsellor — Live Chat, no agency yet',
	args: {
		type: 'consultant',
		isUser: false,
		displayName: 'Beratende Person Kim G.',
		subtitle: ''
	},
	parameters: {
		docs: {
			description: {
				story: 'Live Chat is cross-agency and registrationless, so there is no single counselling centre to name before somebody picks the conversation up. The row is omitted entirely rather than rendering an empty line, and the header keeps its one-line height.'
			}
		}
	}
};

export const ConsultantAgencyWithoutPostcode: Story = {
	name: 'Counsellor — agency without a usable postcode',
	args: {
		type: 'consultant',
		isUser: false,
		displayName: 'Beratende Person Kim G.',
		subtitle: 'Caritas Mainz'
	},
	parameters: {
		docs: {
			description: {
				story: 'Anonymous registrations carry the placeholder postcode "00000". Printing it would name a place that does not exist, so `formatAgencyLine` drops it and the centre stands on its own.'
			}
		}
	}
};

export const ConsultantLongAgencyMobile: Story = {
	name: 'Mobile (375px) — long counselling centre',
	args: {
		type: 'consultant',
		isUser: false,
		displayName: 'Beratende Person Kim G.',
		subtitle:
			'54222 Katholische Beratungsstelle für Ehe-, Familien- und Lebensfragen Mainz'
	},
	parameters: {
		...mobileParameters,
		docs: {
			description: {
				story: 'The narrowest phone still in use with a realistically long centre name. The line wraps inside the header column instead of widening the message row.'
			}
		}
	},
	globals: phone375Globals
};
