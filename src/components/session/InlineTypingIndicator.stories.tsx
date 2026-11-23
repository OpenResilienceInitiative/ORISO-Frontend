import type { CSSProperties } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';
import { InlineTypingIndicator } from './InlineTypingIndicator';
import './session.styles.scss';
import '../message/message.styles.scss';

const meta = {
	title: 'Chat/Messages/Inline typing indicator',
	component: InlineTypingIndicator,
	args: { name: 'Alex', userId: '@alex:oriso.invalid', label: 'Alex schreibt …' }
} satisfies Meta<typeof InlineTypingIndicator>;
export default meta;
type Story = StoryObj<typeof meta>;

export const CustomTheme: Story = {
	decorators: [
		(Story) => (
			<div
				style={
					{
						'--m3-outline-variant': '#314f69',
						'--m3-surface-container-lowest': '#e6f0f8',
						'background': '#e6f0f8'
					} as CSSProperties
				}
			>
				<Story />
			</div>
		)
	],
	play: async ({ canvasElement }) => {
		const frame = canvasElement.querySelector<HTMLElement>(
			'.messageItem__avatar'
		)!;
		const avatar = frame.querySelector<HTMLElement>(
			'[data-testid="user-avatar"]'
		)!;
		const animal = avatar.querySelector<HTMLElement>(':scope > div')!;
		expect(getComputedStyle(animal).borderTopWidth).toBe('0px');
		expect(getComputedStyle(animal).boxShadow).toBe('none');
		expect(getComputedStyle(avatar, '::after').content).toBe('none');
		expect(getComputedStyle(frame).borderTopWidth).toBe('6px');
		expect(getComputedStyle(frame, '::after').borderTopWidth).toBe('0px');
		expect(getComputedStyle(frame).backgroundColor).toBe(
			'rgb(230, 240, 248)'
		);
	}
};
