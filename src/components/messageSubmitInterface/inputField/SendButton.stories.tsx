import * as React from 'react';
import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, waitFor, within } from 'storybook/test';
import { SendButton } from './SendButton';
import type { SendButtonState } from './sendButtonState';

const SEND_BUTTON_FIGMA_URL =
	'https://www.figma.com/design/L2mOFNSGdxPPx1XA4HFAog/App.Oriso?node-id=489-16565';

const meta = {
	title: 'Components/Composer/SendButton',
	component: SendButton,
	tags: ['autodocs'],
	parameters: {
		design: [
			{
				type: 'figma',
				name: 'Nachricht senden',
				url: SEND_BUTTON_FIGMA_URL
			}
		],
		docs: {
			description: {
				component:
					'Send button per Figma 489:16565 / #597. Empty / not-selected uses ' +
					'`var(--m3-primary-fixed-dim, #ffb4aa)` with a white icon; entering text ' +
					'rotates the paper plane in (arm) on primary-container. Sending launches ' +
					'the fly-out animation, then the button settles back.'
			}
		}
	},
	argTypes: {
		state: {
			control: 'radio',
			options: ['empty', 'ready', 'sending', 'disabled']
		}
	}
} satisfies Meta<typeof SendButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {
	args: { state: 'empty' }
};

export const Ready: Story = {
	args: { state: 'ready' }
};

export const Disabled: Story = {
	args: { state: 'disabled' }
};

function ArmDemo() {
	const [state, setState] = useState<SendButtonState>('empty');
	return (
		<div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
			<SendButton state={state} type="button" />
			<button
				type="button"
				data-testid="toggle-arm"
				onClick={() =>
					setState((s) => (s === 'empty' ? 'ready' : 'empty'))
				}
			>
				Text tippen simulieren
			</button>
		</div>
	);
}

export const ArmTransition: StoryObj = {
	name: 'Transition empty → ready (rotate in)',
	render: () => <ArmDemo />,
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		(await canvas.findByTestId('toggle-arm')).click();
		await waitFor(async () => {
			const sendButton = canvasElement.querySelector('.sendButton');
			await expect(sendButton?.className).toContain('sendButton--ready');
		});
	}
};

function FlyOutDemo() {
	const [state, setState] = useState<SendButtonState>('ready');
	return (
		<div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
			<SendButton state={state} type="button" />
			<button
				type="button"
				data-testid="trigger-send"
				onClick={() => {
					setState('sending');
					window.setTimeout(() => setState('empty'), 600);
				}}
			>
				Senden simulieren
			</button>
		</div>
	);
}

export const FlyOutOnSend: StoryObj = {
	name: 'Fly-out on send',
	render: () => <FlyOutDemo />,
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		(await canvas.findByTestId('trigger-send')).click();
		await waitFor(async () => {
			const sendButton = canvasElement.querySelector('.sendButton');
			await expect(sendButton?.className).toContain('sendButton--flyout');
		});
	}
};
