import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { WaitingClock, WaitingClockPart } from './WaitingClock';

const meta = {
	title: 'GroupChat/WaitingClock',
	component: WaitingClock,
	tags: ['autodocs'],
	parameters: {
		layout: 'centered',
		docs: {
			description: {
				component:
					'The waiting-area countdown as a "clock made of clocks" (ported from the ORISO Design mockup). Each digit is a 4×6 grid of mini-clocks whose hands (ORISO red) rotate to draw the number; hands only ever move forward, and the grid assembles from random angles on mount. `reducedMotion` swaps in calm, static Inter digits.'
			}
		}
	},
	decorators: [
		(Story) => (
			<div
				style={{
					fontFamily: 'Inter, system-ui, sans-serif',
					background: '#fff',
					padding: '40px 48px',
					borderRadius: 20,
					border: '1px solid #FFB3BA'
				}}
			>
				<Story />
			</div>
		)
	]
} satisfies Meta<typeof WaitingClock>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Live-ticking wrapper — recomputes the parts every second from a target time. */
const useCountdownParts = (deltaSeconds: number, overdue: boolean) => {
	const target = React.useRef(Date.now() + deltaSeconds * 1000);
	const [, force] = React.useState(0);
	React.useEffect(() => {
		const t = window.setInterval(() => force((n) => n + 1), 1000);
		return () => window.clearInterval(t);
	}, []);
	if (overdue) {
		const el = Math.max(0, (Date.now() - target.current) / 1000);
		const parts: WaitingClockPart[] = [
			{ label: 'Minuten', value: Math.floor(el / 60) % 60 },
			{ label: 'Sekunden', value: Math.floor(el) % 60 }
		];
		return parts;
	}
	const rem = Math.max(0, (target.current - Date.now()) / 1000);
	return [
		{ label: 'Tage', value: Math.floor(rem / 86400) },
		{ label: 'Stunden', value: Math.floor(rem / 3600) % 24 },
		{ label: 'Minuten', value: Math.floor(rem / 60) % 60 },
		{ label: 'Sekunden', value: Math.floor(rem) % 60 }
	] as WaitingClockPart[];
};

export const FutureQuad: Story = {
	render: () => {
		const parts = useCountdownParts(
			2 * 86400 + 3 * 3600 + 21 * 60 + 50,
			false
		);
		return (
			<WaitingClock
				parts={parts}
				size={30}
				layout="quad"
				ariaLabel="Noch 2 Tage bis zum Beginn"
			/>
		);
	}
};

export const OverdueCountingUp: Story = {
	render: () => {
		const parts = useCountdownParts(-252, true);
		return (
			<WaitingClock
				parts={parts}
				size={28}
				layout="row"
				plus
				ariaLabel="Seit dem geplanten Beginn"
			/>
		);
	}
};

export const ReducedMotion: Story = {
	render: () => {
		const parts = useCountdownParts(
			2 * 86400 + 3 * 3600 + 21 * 60 + 50,
			false
		);
		return (
			<WaitingClock
				parts={parts}
				size={30}
				layout="quad"
				reducedMotion
				ariaLabel="Noch 2 Tage bis zum Beginn"
			/>
		);
	}
};
