import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react';

import { ICON_CALL_OFF, ICON_INFO, SystemMessage } from './SystemMessage';
import {
	mobileParameters,
	withMessageShell,
	type MessageStoryParameters
} from './messageStoryShell';
import './message.styles.scss';

/**
 * The in-chat system notice: an optional icon plus a subject line, with
 * optional children below it. It is the shared skeleton behind the
 * encryption-key notice, the video-call notices and the case-handover cards —
 * so a change here is felt in all of them.
 */
const meta = {
	title: 'Components/Chat/SystemMessage',
	component: SystemMessage,
	tags: ['autodocs'],
	parameters: {
		layout: 'fullscreen',
		docs: {
			description: {
				component:
					'Shared skeleton for in-chat system notices. `subject` is a React element (not a string), so callers can embed links and emphasis. `icon` accepts `info` or `call_off`; both carry a translated `title`/`aria-label`, which is why the icon is never decorative-only.'
			}
		}
	},
	args: {
		subject: <>Diese Unterhaltung ist Ende-zu-Ende-verschlüsselt.</>
	},
	decorators: [
		(Story, ctx) =>
			withMessageShell(Story, {
				parameters: ctx.parameters as MessageStoryParameters
			})
	]
} satisfies Meta<typeof SystemMessage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const NoIcon: Story = {
	name: 'Subject only (no icon)',
	parameters: {
		docs: {
			description: {
				story: 'The minimal case. Used where the surrounding card already carries an icon.'
			}
		}
	}
};

export const WithInfoIcon: Story = {
	name: 'Info icon',
	args: { icon: ICON_INFO }
};

export const WithCallOffIcon: Story = {
	name: 'Call-off icon',
	args: {
		icon: ICON_CALL_OFF,
		subject: <>Der Videoanruf wurde beendet.</>
	}
};

export const WithChildren: Story = {
	name: 'Subject + body',
	args: {
		icon: ICON_INFO,
		subject: <>Ihre Nachricht konnte nicht entschlüsselt werden.</>,
		children: (
			<p className="systemMessage__infoText">
				Das passiert, wenn Sie sich auf einem neuen Gerät angemeldet
				haben. Ältere Nachrichten bleiben auf dem ursprünglichen Gerät
				lesbar.
			</p>
		)
	}
};

export const LongSubject: Story = {
	name: 'Long subject (wrapping)',
	args: {
		icon: ICON_INFO,
		subject: (
			<>
				Diese Beratungsstelle arbeitet im Team: Ihre Nachrichten können
				von mehreren beratenden Personen gelesen werden, die alle der
				Schweigepflicht unterliegen und sich vertraulich intern
				austauschen.
			</>
		)
	},
	parameters: {
		docs: {
			description: {
				story: 'Guards against the subject line being styled as single-line. Disclosure texts of this length are expected (ADR-018, the "who reads along" Baustein).'
			}
		}
	}
};

export const Mobile: Story = {
	name: 'Mobile (390px)',
	args: {
		icon: ICON_INFO,
		subject: (
			<>
				Diese Beratungsstelle arbeitet im Team: Ihre Nachrichten können
				von mehreren beratenden Personen gelesen werden.
			</>
		)
	},
	parameters: {
		...mobileParameters,
		docs: {
			description: {
				story: 'Same notice at 390px. The icon column must not squeeze the text into a one-word-per-line ladder.'
			}
		}
	}
};
