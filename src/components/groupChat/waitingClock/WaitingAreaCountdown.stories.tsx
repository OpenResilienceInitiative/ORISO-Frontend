import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { WaitingAreaCountdown, WaitingRule } from './WaitingAreaCountdown';

const WELCOME =
	'Hallo und herzlich willkommen! Schön, dass du da bist. Mach es dir bequem — ich öffne den Raum pünktlich für uns alle.';

const RULES: WaitingRule[] = [
	{
		no: '1',
		title: 'Alles bleibt in diesem Raum',
		text: 'Was hier geteilt wird, bleibt unter uns. So kann jede:r offen sprechen, ohne sich Sorgen machen zu müssen.'
	},
	{
		no: '2',
		title: 'Du entscheidest, was du teilst',
		text: 'Es gibt kein Muss. Erzähl nur, was sich für dich richtig anfühlt — zuhören ist genauso wertvoll.'
	},
	{
		no: '3',
		title: 'Wir lassen einander ausreden',
		text: 'Jede Nachricht bekommt Raum. Wir antworten mit Respekt und ohne Bewertung.'
	},
	{
		no: '4',
		title: 'Schwere Momente sind okay',
		text: 'Wenn es dir gerade nicht gut geht, sag es gern. Deine Beratung und die Gruppe sind für dich da.'
	}
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
					'The self-help group-chat waiting area (ORISO Design variant 4a) — only the content of the white box. The "clock made of clocks" number groups flip on click to reveal the counsellor greeting (behind days) and netiquette rules (behind hours/minutes/seconds). The toggle switches to a calm, motion-free view.'
			}
		}
	},
	decorators: [
		(Story) => (
			<div
				style={{
					width: 720,
					maxWidth: '92vw',
					background: '#fff',
					padding: '30px 36px 18px',
					borderRadius: 20,
					border: '1px solid #FFB3BA'
				}}
			>
				<Story />
			</div>
		)
	]
} satisfies Meta<typeof WaitingAreaCountdown>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Future4a: Story = {
	render: () => (
		<WaitingAreaCountdown
			plannedStart={
				new Date(
					Date.now() + (2 * 86400 + 3 * 3600 + 21 * 60 + 50) * 1000
				)
			}
			welcomeText={WELCOME}
			rules={RULES}
			onAddToCalendar={() => undefined}
		/>
	)
};

export const ReducedMotion: Story = {
	render: () => (
		<WaitingAreaCountdown
			plannedStart={
				new Date(
					Date.now() + (2 * 86400 + 3 * 3600 + 21 * 60 + 50) * 1000
				)
			}
			welcomeText={WELCOME}
			rules={RULES}
			reducedMotion
		/>
	)
};

export const Overdue: Story = {
	render: () => (
		<WaitingAreaCountdown
			plannedStart={new Date(Date.now() - 252 * 1000)}
			welcomeText={WELCOME}
			rules={RULES}
		/>
	)
};
