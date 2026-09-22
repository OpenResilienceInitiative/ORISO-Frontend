import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { WaitingAreaCountdown } from './WaitingAreaCountdown';
import {
	expectCaptionClear,
	expectHandsVisible,
	expectOverdueClockOnOneRow
} from './waitingClockStoryChecks';
import { computeOrisoPalette } from '../../../utils/theme/orisoScheme';
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

/**
 * #1499. Past 99 minutes the minutes group grows a third digit — it used to
 * draw "99" while the timer label said the truth. The extra digit is paid for
 * with a smaller mini-clock, never with a second row: the row sits in a flip
 * card that is exactly one group tall, so anything that wraps lands on the
 * caption below it.
 */
export const Overdue3Digits: Story = {
	args: {
		plannedStart: new Date(Date.now() - (140 * 60 + 7) * 1000),
		welcomeText: WELCOME,
		rules: RULES,
		clockSize: 'fit',
		spacing: 'tight'
	},
	play: async ({ canvasElement }) => {
		await expectOverdueClockOnOneRow(canvasElement, 3);
		await expectCaptionClear(canvasElement);
		await expectHandsVisible(canvasElement);
	}
};

export const Overdue3DigitsMobile: Story = {
	args: {
		...Overdue3Digits.args,
		labelsOutside: true,
		hideMotionToggle: true,
		gap: 12
	},
	globals: phone375Globals,
	parameters: { phoneFrame: true },
	play: async ({ canvasElement }) => {
		await expectOverdueClockOnOneRow(canvasElement, 3);
		await expectCaptionClear(canvasElement);
	}
};

/**
 * The same clock under a light Träger brand (#b4ddee, Träger 2 on Dev).
 *
 * Every face and hand used to be a hand-picked grey or pink, so the clock
 * stayed Caritas red on a blue Träger. Faces are surfaces and the brand's pale
 * tint now, hands and "+" are the brand's dark ink — `expectHandsVisible`
 * measures that the strokes still clear 3:1 on every face (#1499).
 */
const LightBrand = ({ children }: { children: React.ReactNode }) => {
	const { tokens } = computeOrisoPalette({ primary: '#b4ddee' }, 'light');
	return <div style={tokens as React.CSSProperties}>{children}</div>;
};

export const LightBrandOverdue: Story = {
	args: {
		plannedStart: new Date(Date.now() - (140 * 60 + 7) * 1000),
		welcomeText: WELCOME,
		rules: RULES,
		clockSize: 'fit',
		spacing: 'tight'
	},
	decorators: [
		(Story) => (
			<LightBrand>
				<Story />
			</LightBrand>
		)
	],
	play: async ({ canvasElement }) => {
		await expectOverdueClockOnOneRow(canvasElement, 3);
		await expectCaptionClear(canvasElement);
		await expectHandsVisible(canvasElement);
	}
};

export const LightBrandFuture: Story = {
	args: {
		plannedStart: new Date(
			Date.now() + (2 * 86400 + 3 * 3600 + 21 * 60 + 50) * 1000
		),
		welcomeText: WELCOME,
		rules: RULES
	},
	decorators: LightBrandOverdue.decorators,
	play: async ({ canvasElement }) => {
		await expectHandsVisible(canvasElement);
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
