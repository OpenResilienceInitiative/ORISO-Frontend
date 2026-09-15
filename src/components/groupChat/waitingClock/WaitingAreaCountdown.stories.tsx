import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { WaitingAreaCountdown } from './WaitingAreaCountdown';
import { phone375Globals } from '../../message/messageStoryShell';

const WELCOME =
	'Hallo und herzlich willkommen! Schön, dass du da bist. Mach es dir bequem — ich öffne den Raum pünktlich für uns alle.';

const RULES = [
	'Was hier geteilt wird, bleibt unter uns. So kann jede:r offen sprechen, ohne sich Sorgen machen zu müssen.',
	'Es gibt kein Muss. Erzähl nur, was sich für dich richtig anfühlt — zuhören ist genauso wertvoll.',
	'Jede Nachricht bekommt Raum. Wir antworten mit Respekt und ohne Bewertung.',
	'Wenn es dir gerade nicht gut geht, sag es gern. Deine Beratung und die Gruppe sind für dich da.'
];

const meta = {
	title: 'GroupChat/WaitingAreaCountdown',
	component: WaitingAreaCountdown,
	tags: ['autodocs'],
	parameters: {
		layout: 'centered',
		docs: {
			description: {
				component:
					'The self-help group-chat waiting area (ORISO Design variants 4a/4b) — only the content of the white box. The whole "clock made of clocks" is one large flip card: a click, a tap or Enter/Space turns it over, and the back carries the counsellor greeting and the netiquette one page at a time, paged with arrow buttons. Mini-clocks near the cursor magnetically point at it — switched off below the mobile breakpoint, where the clock is drawn tighter and larger instead. Once the planned start passes, the box counts up with an error tint, a leading "+", and smileys popping into single mini-clocks. The toggle (and OS `prefers-reduced-motion`) switches to a calm 2×2 square of static tiles.'
			}
		}
	},
	decorators: [
		// `phoneFrame` swaps the desktop-sized white box for a 375 px one, so the
		// mobile story is measured in the width Frank reviewed.
		(Story, context) => (
			<div
				style={
					context.parameters.phoneFrame
						? {
								width: 375,
								maxWidth: '100vw',
								boxSizing: 'border-box',
								background: '#fff',
								padding: '16px 16px 12px',
								borderRadius: 20,
								border: '1px solid #FFB3BA'
							}
						: {
								width: 720,
								maxWidth: '92vw',
								background: '#fff',
								padding: '30px 36px 18px',
								borderRadius: 20,
								border: '1px solid #FFB3BA'
							}
				}
			>
				<Story />
			</div>
		)
	]
} satisfies Meta<typeof WaitingAreaCountdown>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Future4a: Story = {
	args: {
		plannedStart: new Date(
			Date.now() + (2 * 86400 + 3 * 3600 + 21 * 60 + 50) * 1000
		),
		welcomeText: WELCOME,
		rules: RULES,
		calendarSlot: (
			<button
				type="button"
				style={{
					background: 'var(--m3-primary-fixed, #fbdddd)',
					color: 'var(--m3-on-primary-fixed-variant, #8c1513)',
					border: 'none',
					borderRadius: 20,
					padding: '10px 18px',
					fontFamily: 'inherit',
					fontSize: 13,
					fontWeight: 600,
					cursor: 'pointer'
				}}
			>
				Zum Kalender hinzufügen
			</button>
		)
	}
};

export const Overdue4b: Story = {
	args: {
		plannedStart: new Date(Date.now() - 252 * 1000),
		welcomeText: WELCOME,
		rules: RULES
	}
};

export const ReducedMotion: Story = {
	args: {
		plannedStart: new Date(
			Date.now() + (2 * 86400 + 3 * 3600 + 21 * 60 + 50) * 1000
		),
		welcomeText: WELCOME,
		rules: RULES,
		reducedMotion: true
	}
};

/**
 * The phone case Frank reviewed: no gravity effect, a tight lattice, a small
 * "+", and the clock sized to the column it gets.
 */
export const MobileFit: Story = {
	args: {
		plannedStart: new Date(
			Date.now() + (2 * 86400 + 3 * 3600 + 21 * 60 + 50) * 1000
		),
		welcomeText: WELCOME,
		rules: RULES,
		clockSize: 'fit',
		spacing: 'tight',
		labelsOutside: true,
		hideMotionToggle: true,
		gap: 12
	},
	globals: phone375Globals,
	parameters: {
		phoneFrame: true
	}
};
