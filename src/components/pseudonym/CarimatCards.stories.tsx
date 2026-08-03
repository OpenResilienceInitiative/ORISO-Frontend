import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react';

import type { Pseudonym } from '../../utils/pseudonymGenerator';
import {
	PSEUDONYM_LONGEST,
	PSEUDONYM_TYPICAL,
	STORY_WIDTH_COMPACT,
	phone390Globals
} from '../message/messageStoryShell';
import { PrivacyMessageCard } from './PrivacyMessageCard';
import { PseudonymCard } from './PseudonymCard';
import './PseudonymCard.styles.scss';

/**
 * Carimat — the platform's own voice in the chat.
 *
 * **Filed under Chat on purpose.** A Carimat bubble is a *kind of chat message*,
 * a sibling of the system notices, not a separate widget family. Its avatar
 * therefore has to obey the same circle geometry as `MessageAvatar`
 * (`size = 32`) — which today it does **not**: `PseudonymCard.styles.scss:34-40`
 * gives it a bespoke 54×54 frame in a 64px column. Tracked in
 * OpenResilienceInitiative/ORISO-Frontend#892.
 *
 * Carimat is a **rendering identity, not a Matrix account** (ADR-018 §3) —
 * nothing here corresponds to a room member.
 *
 * The consent gate used to live in this file. It has moved to
 * `AnonymousConsentGate.stories.tsx` under `Components/Dialog`, because it is a
 * pop-up dialog over a dimmed screen, not a chat message.
 *
 * One thing to watch in every story: **the kicker line.** "Carimat" is a
 * hardcoded JSX string, not an i18n key, in all of these components. Switching
 * the locale in the toolbar changes the subtitle but never the name.
 */
const meta = {
	title: 'Components/Chat/CarimatMessage',
	tags: ['autodocs'],
	parameters: {
		layout: 'padded',
		docs: {
			description: {
				component:
					'Carimat message bubbles: choose-a-name and the privacy notice. Same message grammar as the other chat rows — kicker line, avatar column, bubble.'
			}
		}
	}
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const pseudonym: Pseudonym = {
	displayName: PSEUDONYM_TYPICAL,
	animalLabel: 'Alpaka',
	name: 'Mika',
	avatar: { file: 'alpaca.svg', bg: '#E8DEF8', iconColor: '#1D1B20' }
};

/**
 * The longest display name the shipped generator can actually produce in
 * German — 31 characters, computed from `utils/anonName/data.ts`. Longer names
 * cannot occur, so they are not worth testing against.
 */
const longPseudonym: Pseudonym = {
	displayName: PSEUDONYM_LONGEST,
	animalLabel: 'Schildkröte',
	name: 'Andrea',
	avatar: { file: 'turtle.svg', bg: '#21005D', iconColor: '#FFFFFF' }
};

export const ChooseDisplayName: Story = {
	name: 'Pseudonym message — typing animation',
	render: () => <PseudonymCard pseudonym={pseudonym} />,
	parameters: {
		docs: {
			description: {
				story: 'Plays the typing dots, then writes the message. Reload the story to replay.'
			}
		}
	}
};

export const ChooseDisplayNameStatic: Story = {
	name: 'Pseudonym message — no animation (skipTyping)',
	render: () => <PseudonymCard pseudonym={pseudonym} skipTyping />,
	parameters: {
		docs: {
			description: {
				story: 'The re-render state — the variant to use for visual regression, since the animated one is time-dependent.'
			}
		}
	}
};

export const ChooseDisplayNameLongestName: Story = {
	name: 'Pseudonym message — longest possible name (31 chars)',
	render: () => <PseudonymCard pseudonym={longPseudonym} skipTyping />,
	parameters: {
		docs: {
			description: {
				story: '"absichtslose Schildkröte Andrea" is the worst case the generator can produce: longest adjective + longest animal + longest given name. The name must not overflow the bubble or collide with the avatar column.'
			}
		}
	}
};

export const ChooseDisplayNameMobile: Story = {
	name: 'Pseudonym message — mobile (390px), longest name',
	render: () => (
		<div style={{ maxWidth: STORY_WIDTH_COMPACT }}>
			<PseudonymCard pseudonym={longPseudonym} skipTyping />
		</div>
	),
	globals: phone390Globals
};

export const PrivacyNotice: Story = {
	name: 'Privacy message — typing animation',
	render: () => <PrivacyMessageCard />
};

export const PrivacyNoticeStatic: Story = {
	name: 'Privacy message — no animation',
	render: () => <PrivacyMessageCard skipTyping />
};

export const PrivacyNoticeMobile: Story = {
	name: 'Privacy message — mobile (390px)',
	render: () => (
		<div style={{ maxWidth: STORY_WIDTH_COMPACT }}>
			<PrivacyMessageCard skipTyping />
		</div>
	),
	globals: phone390Globals
};

export const TwoMessageStack: Story = {
	name: 'Sequence — pseudonym then privacy',
	render: () => (
		<div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
			<PseudonymCard pseudonym={pseudonym} skipTyping />
			<PrivacyMessageCard skipTyping />
		</div>
	),
	parameters: {
		docs: {
			description: {
				story: 'How the two stack in `SessionItemComponent` once the pseudonym is confirmed — the existing precedent for rendering several bubbles from one step, which the Erstantwort generalises.'
			}
		}
	}
};
