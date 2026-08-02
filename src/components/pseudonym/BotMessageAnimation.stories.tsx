import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react';

import {
	TypewriterText,
	TypingDots,
	TypingReveal
} from './BotMessageAnimation';
import './PseudonymCard.styles.scss';

/**
 * The three animation primitives behind every Carimat bubble.
 *
 * These are what makes a staged message sequence feel like someone typing
 * rather than a wall of text appearing at once — the behaviour ADR-018 assumes
 * for the Erstantwort: a short Baustein must not be immediately followed by the
 * next one.
 *
 * - `TypingDots` — the three-dot bubble shown while "writing"
 * - `TypewriterText` — reveals a string character by character
 * - `TypingReveal` — shows dots for `typingMs`, then swaps in its children
 *
 * All three are pure and prop-driven, so this is the cheapest place to tune
 * timing before wiring anything to a real message event.
 */
const meta = {
	title: 'Components/Chat/CarimatAnimation',
	tags: ['autodocs'],
	parameters: {
		layout: 'padded',
		docs: {
			description: {
				component:
					'Typing dots, typewriter text and the dots→content reveal. Timing is in props (`charMs`, `startDelayMs`, `typingMs`), so a staged Erstantwort sequence can be dialled in here without a backend.'
			}
		}
	}
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Dots: Story = {
	name: 'Typing dots',
	render: () => <TypingDots />,
	parameters: {
		docs: {
			description: {
				story: 'The standalone "the other side is writing" indicator. This is the fallback the Erstantwort uses between Bausteine.'
			}
		}
	}
};

export const Typewriter: Story = {
	name: 'Typewriter — default speed',
	render: () => (
		<TypewriterText text="Danke für deine Nachricht und dein Vertrauen." />
	)
};

export const TypewriterSlow: Story = {
	name: 'Typewriter — slow (60ms/char)',
	render: () => (
		<TypewriterText
			charMs={60}
			text="Innerhalb der nächsten 2 Werktage erhalten Sie eine persönliche Nachricht."
		/>
	),
	parameters: {
		docs: {
			description: {
				story: 'Slower than production default. Useful for judging whether a long Baustein reads as considerate or as sluggish — the difference matters for someone in distress.'
			}
		}
	}
};

export const TypewriterLongGerman: Story = {
	name: 'Typewriter — long German paragraph',
	render: () => (
		<TypewriterText
			text="Wir unterliegen der Schweigepflicht und behandeln alles vertraulich. Bitte achten Sie darauf, uns keine personenbezogenen Daten zu schicken."
			charMs={12}
		/>
	)
};

export const Reveal: Story = {
	name: 'Reveal — dots then content',
	render: () => (
		<TypingReveal typingMs={1200}>
			<p style={{ margin: 0 }}>
				Hier finden Sie noch einmal die wichtigsten Hinweise zu unserer
				Online-Beratung.
			</p>
		</TypingReveal>
	),
	parameters: {
		docs: {
			description: {
				story: 'The pattern a single Erstantwort Baustein uses: dots for `typingMs`, then the content. Chain several with increasing delays to get the staged sequence.'
			}
		}
	}
};

export const StagedSequence: Story = {
	name: 'Staged sequence — three Bausteine',
	render: () => (
		<div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
			<TypingReveal typingMs={600}>
				<p style={{ margin: 0 }}>
					Danke für Ihre Nachricht und Ihr Vertrauen.
				</p>
			</TypingReveal>
			<TypingReveal typingMs={1800}>
				<p style={{ margin: 0 }}>
					Innerhalb von 2 Werktagen erhalten Sie eine persönliche
					Antwort.
				</p>
			</TypingReveal>
			<TypingReveal typingMs={3200}>
				<p style={{ margin: 0 }}>
					Wenn Sie schneller Hilfe brauchen: Telefonseelsorge 0800
					1110111 oder Notruf 112.
				</p>
			</TypingReveal>
		</div>
	),
	parameters: {
		docs: {
			description: {
				story: 'Three bubbles with staggered reveals — the shape ADR-018 specifies for the Erstantwort, approximated with hand-set delays. Reload the story to replay. Note the safety-critical last Baustein appearing **last**: worth deciding whether emergency numbers should really wait behind the others.'
			}
		}
	}
};

export const StagedSequenceMobile: Story = {
	name: 'Staged sequence — mobile (390px)',
	render: () => (
		<div
			style={{
				maxWidth: 390,
				display: 'flex',
				flexDirection: 'column',
				gap: 12
			}}
		>
			<TypingReveal typingMs={600}>
				<p style={{ margin: 0 }}>
					Danke für Ihre Nachricht und Ihr Vertrauen.
				</p>
			</TypingReveal>
			<TypingReveal typingMs={1800}>
				<p style={{ margin: 0 }}>
					Innerhalb von 2 Werktagen erhalten Sie eine persönliche
					Antwort.
				</p>
			</TypingReveal>
		</div>
	),
	parameters: { viewport: { defaultViewport: 'mobile1' } }
};
