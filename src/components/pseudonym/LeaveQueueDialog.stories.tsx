import * as React from 'react';
import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { LeaveQueueDialog } from './LeaveQueueDialog';

const CANCEL_CHAT_FIGMA_URL =
	'https://www.figma.com/design/NEdjgOkKRrCyWVjRjBruXH/CAR02-live-chat_ORISO?node-id=2183-15203';

/**
 * The way out of the live-chat waiting queue.
 *
 * Before this existed there was none: an advice seeker waiting for a
 * counsellor could neither leave the queue nor give up the anonymous account
 * they had just created, so the only exit was abandoning the tab — which
 * leaves the account behind.
 *
 * Two rules the stories pin down:
 *
 * - **Disable, never hide.** "Chat jetzt starten" stays visible while nobody
 *   has accepted, so the asker can see the option exists and is simply not
 *   available yet.
 * - **Deleting takes two steps.** For an anonymous account there is no e-mail
 *   address and no password recovery, so a single stray tap must not be able
 *   to end it.
 *
 * See OpenResilienceInitiative/ORISO-Frontend#893.
 */
const meta = {
	title: 'Components/Dialog/LeaveQueueDialog',
	component: LeaveQueueDialog,
	tags: ['autodocs'],
	parameters: {
		layout: 'fullscreen',
		design: [
			{ type: 'figma', name: 'Cancel chat', url: CANCEL_CHAT_FIGMA_URL }
		],
		docs: {
			description: {
				component:
					'Three choices from the waiting queue: stay, start now, or end the chat and give up the ' +
					'anonymous access. "Delete access" calls `finishConversation`, which deactivates the ' +
					'Keycloak account server-side — the account is disabled, not merely logged out. Below ' +
					'575px the buttons stack full width, per the house dialog rule.\n\n' +
					'Note on colour: the destructive action uses the M3 `error` role, which the OrisoScheme ' +
					'emits as magenta on purpose — red is the brand colour here, so it cannot also mean ' +
					'"danger". Storybook does not apply the scheme, so these previews show the static ' +
					'fallback from `mui-variables-mapping.scss` (`#cc0000`) instead of the magenta the app ' +
					'renders.'
			}
		}
	}
} satisfies Meta<typeof LeaveQueueDialog>;

export default meta;

// Hooks must live in a proper component — calling useState inside a story's
// render() violates react-hooks/rules-of-hooks and fails CI lint.
const DialogDemo = ({
	canStartChat = false,
	busy = false,
	errorMessage
}: {
	canStartChat?: boolean;
	busy?: boolean;
	errorMessage?: string;
}) => {
	const [open, setOpen] = useState(true);
	return (
		<div style={{ minHeight: '520px', position: 'relative' }}>
			<LeaveQueueDialog
				open={open}
				canStartChat={canStartChat}
				busy={busy}
				errorMessage={errorMessage}
				onStay={() => setOpen(false)}
				onStartChat={() => setOpen(false)}
				onDeleteAccess={() => setOpen(false)}
			/>
		</div>
	);
};

export const Waiting: StoryObj = {
	name: 'Still waiting — start is disabled',
	render: () => <DialogDemo />,
	parameters: {
		docs: {
			description: {
				story: 'Nobody has accepted yet, so there is no chat to start. The button stays in place, greyed, with the reason spelled out underneath.'
			}
		}
	}
};

export const CounsellorAccepted: StoryObj = {
	name: 'Counsellor accepted — start is available',
	render: () => <DialogDemo canStartChat />,
	parameters: {
		docs: {
			description: {
				story: 'Someone has picked the conversation up. The body copy changes with it, and the hint under the buttons goes away.'
			}
		}
	}
};

export const Busy: StoryObj = {
	name: 'Request in flight',
	render: () => <DialogDemo canStartChat busy />,
	parameters: {
		docs: {
			description: {
				story: 'Every control is blocked while the request runs, so a double tap cannot end the chat twice.'
			}
		}
	}
};

export const Failed: StoryObj = {
	name: 'Ending the chat failed',
	render: () => (
		<DialogDemo errorMessage="Der Chat konnte gerade nicht beendet werden. Bitte versuchen Sie es noch einmal." />
	),
	parameters: {
		docs: {
			description: {
				story: 'The failure is announced rather than swallowed — otherwise the asker would walk away believing the account was gone while it is still live.'
			}
		}
	}
};

export const MobileWaiting: StoryObj = {
	name: 'Mobile 375px — still waiting',
	render: () => <DialogDemo />,
	globals: { viewport: { value: 'phone375' } },
	parameters: {
		docs: {
			description: {
				story: 'The narrowest phone still in use. Below 575px the three buttons stack and go full width; the headline wraps between words, never mid-word.'
			}
		}
	}
};

export const MobileAccepted: StoryObj = {
	name: 'Mobile 375px — counsellor accepted',
	render: () => <DialogDemo canStartChat />,
	globals: { viewport: { value: 'phone375' } }
};
