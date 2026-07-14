import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, waitFor } from 'storybook/test';
import { APP_ORISO_FIGMA_URL } from '../storybookDesignLinks';
import {
	GroupCallStoryHarness,
	type GroupCallStoryMode
} from './__storybook__/groupCallHarness';
import './GroupCallWidget.scss';

/**
 * Storybook MCP target for Element Call / group video call UI review.
 * Renders the real `GroupCallWidget` with Storybook-only CallManager seeding
 * and a fake Matrix client — no Matrix, LiveKit, Keycloak, or backend calls.
 */
const meta = {
	title: 'Components/Call/GroupCallWidget',
	component: GroupCallStoryHarness,
	tags: ['autodocs'],
	parameters: {
		layout: 'fullscreen',
		design: {
			type: 'figma',
			url: APP_ORISO_FIGMA_URL
		},
		docs: {
			description: {
				component:
					'Storybook MCP target for Element Call / video call interface review. Uses the production `GroupCallWidget` with deterministic CallManager fixtures and a fake Matrix client. Safe dummy origins only (`call.storybook.test`, `matrix.storybook.test`) — no real tokens, room IDs, or backend connections.'
			}
		}
	},
	argTypes: {
		mode: {
			control: 'select',
			options: [
				'incoming',
				'connecting',
				'active'
			] satisfies GroupCallStoryMode[],
			description: 'Deterministic call UI state seeded via CallManager'
		}
	}
} satisfies Meta<typeof GroupCallStoryHarness>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Incoming Element Call group ring — Answer / Decline. */
export const IncomingCall: Story = {
	args: { mode: 'incoming' },
	play: async ({ canvasElement }) => {
		await waitFor(() => {
			expect(
				canvasElement.querySelector('.incoming-call-popup')
			).toBeTruthy();
			expect(canvasElement.querySelector('.btn-answer')).toBeTruthy();
			expect(canvasElement.querySelector('.btn-decline')).toBeTruthy();
		});
	}
};

/**
 * Setting up / connecting — token fetch held open so the connecting popup
 * stays visible (setupElementCall never completes).
 */
export const Connecting: Story = {
	args: { mode: 'connecting' },
	play: async ({ canvasElement }) => {
		await waitFor(() => {
			expect(
				canvasElement.querySelector('.connecting-popup')
			).toBeTruthy();
			expect(
				canvasElement.querySelector('.element-call-iframe')
			).toBeFalsy();
		});
	}
};

/**
 * Active call — Element Call iframe URL built against `call.storybook.test`
 * (non-resolving host; blank iframe frame is expected).
 */
export const ActiveCall: Story = {
	args: { mode: 'active' },
	play: async ({ canvasElement }) => {
		await waitFor(
			() => {
				const iframe = canvasElement.querySelector(
					'.element-call-iframe'
				) as HTMLIFrameElement | null;
				expect(iframe).toBeTruthy();
				expect(iframe?.getAttribute('src') || '').toMatch(
					/^https:\/\/call\.storybook\.test\/room\/#/
				);
				expect(
					canvasElement.querySelector(
						'button.element-call-fullscreen[aria-label]'
					)
				).toBeTruthy();
				expect(
					canvasElement.querySelector(
						'button.element-call-close[aria-label="Close call"]'
					)
				).toBeTruthy();
			},
			{ timeout: 5000 }
		);
	}
};
