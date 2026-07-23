import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { WaitingAreaRules } from './WaitingAreaRules';
import './joinChat.styles';

const meta = {
	title: 'GroupChat/WaitingAreaRules',
	component: WaitingAreaRules,
	tags: ['autodocs'],
	parameters: {
		docs: {
			description: {
				component:
					'Waiting-area netiquette rules. One rule is spotlighted at a time and the spotlight cross-fades every ~4s (useCyclingIndex). All rules stay in the DOM for screen readers, and prefers-reduced-motion shows every rule statically.'
			}
		}
	},
	decorators: [
		(Story) => (
			<div className="session joinChat">
				<div className="joinChat__content">
					<Story />
				</div>
			</div>
		)
	]
} satisfies Meta<typeof WaitingAreaRules>;

export default meta;
type Story = StoryObj<typeof meta>;

export const CyclingRules: Story = {
	args: {
		ariaLabel: 'Chat rules',
		rules: [
			'Wir duzen uns hier im Chat.',
			'Achtet aufeinander und bleibt wertschätzend.',
			'Was hier besprochen wird, bleibt hier.',
			'Die Moderation darf auf die Regeln hinweisen.'
		]
	}
};

export const SingleRule: Story = {
	args: {
		ariaLabel: 'Chat rules',
		rules: ['Wir duzen uns hier im Chat.']
	}
};

export const NoRules: Story = {
	args: {
		ariaLabel: 'Chat rules',
		rules: []
	}
};
