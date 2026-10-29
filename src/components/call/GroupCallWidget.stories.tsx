import i18n from 'i18next';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
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
				'active',
				'secondCall'
			] satisfies GroupCallStoryMode[],
			description: 'Deterministic call UI state seeded via CallManager'
		}
	}
} satisfies Meta<typeof GroupCallStoryHarness>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Incoming Element Call group ring — the card in the call language
 * (FE#1904), portalled to `<body>` with no backdrop.
 */
export const IncomingCall: Story = {
	args: { mode: 'incoming' },
	play: async ({ canvasElement }) => {
		const page = within(canvasElement.ownerDocument.body);
		const card = await page.findByRole('alertdialog');
		// The card slides in; wait for it to settle.
		await waitFor(() =>
			expect(
				within(card).getByRole('button', {
					name: i18n.t('calls.answer')
				})
			).toBeVisible()
		);
		await expect(
			within(card).getByRole('button', { name: i18n.t('calls.decline') })
		).toBeVisible();
		expect(
			canvasElement.ownerDocument.querySelector('.call-modal-backdrop')
		).toBeNull();
	}
};

/**
 * Setting up / connecting — room membership remains invited and the
 * Storybook-only join never resolves, so the real host stays connecting.
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
				const iframeUrl = new URL(iframe?.getAttribute('src') || '');
				expect(iframeUrl.origin).toBe('https://call.storybook.test');
				expect(iframeUrl.pathname).toBe('/room');
				expect(iframeUrl.hash).toContain(
					'roomId=%21sb-element-call%3Amatrix.storybook.test'
				);
				expect(iframeUrl.hash).not.toContain('accessToken');
				expect(
					canvasElement.querySelector(
						'button.element-call-fullscreen[aria-label]'
					)
				).toBeTruthy();
				expect(
					canvasElement.querySelector(
						'button.element-call-close[aria-label]'
					)
				).toBeTruthy();
				expect(
					canvasElement
						.querySelector('button.element-call-close')
						?.getAttribute('aria-label')
				).toBe(i18n.t('calls.group.close'));
			},
			{ timeout: 5000 }
		);
	}
};

/**
 * Active call put aside into the dock (FE#1904): the iframe stays mounted
 * but hidden, and the dock brings the full view back.
 */
export const ActiveCallMinimized: Story = {
	args: { mode: 'active' },
	play: async ({ canvasElement }) => {
		const page = within(canvasElement.ownerDocument.body);
		await userEvent.click(
			await page.findByRole(
				'button',
				{ name: i18n.t('calls.states.minimize') },
				{ timeout: 5000 }
			)
		);
		const dock = await page.findByRole('region', {
			name: i18n.t('calls.states.dockLabel', {
				name: i18n.t('calls.states.groupCall')
			})
		});
		expect(
			canvasElement.querySelector('.element-call-iframe')
		).toBeTruthy();
		expect(
			canvasElement.querySelector('.group-call-widget--docked')
		).toBeTruthy();
		await userEvent.click(
			within(dock).getByRole('button', {
				name: i18n.t('calls.states.backToCall')
			})
		);
		await waitFor(() =>
			expect(
				canvasElement.querySelector('.group-call-widget--docked')
			).toBeNull()
		);
	}
};

/**
 * A second call rings while the first runs (FE#1904, Frank 28 Oct): its
 * card sits above the running call and says that answering ends it.
 */
export const SecondCallWhileInCall: Story = {
	args: { mode: 'secondCall' },
	play: async ({ canvasElement }) => {
		const page = within(canvasElement.ownerDocument.body);
		const card = await page.findByRole('alertdialog');
		await waitFor(() =>
			expect(
				within(card).getByRole('button', {
					name: i18n.t('calls.states.answerAndEnd')
				})
			).toBeVisible()
		);
		await waitFor(() =>
			expect(
				canvasElement.querySelector('.element-call-iframe')
			).toBeTruthy()
		);
		// Above the running call, never behind it.
		expect(Number(getComputedStyle(card).zIndex)).toBeGreaterThan(
			Number(
				getComputedStyle(
					canvasElement.querySelector('.group-call-widget') as Element
				).zIndex
			)
		);
	}
};

/** Declining the second call leaves the running call alone. */
export const SecondCallDeclined: Story = {
	args: { mode: 'secondCall' },
	play: async ({ canvasElement }) => {
		const page = within(canvasElement.ownerDocument.body);
		const card = await page.findByRole('alertdialog');
		await waitFor(() =>
			expect(
				within(card).getByRole('button', {
					name: i18n.t('calls.decline')
				})
			).toBeVisible()
		);
		await userEvent.click(
			within(card).getByRole('button', { name: i18n.t('calls.decline') })
		);
		await waitFor(() => expect(page.queryByRole('alertdialog')).toBeNull());
		expect(
			canvasElement.querySelector('.element-call-iframe')
		).toBeTruthy();
	}
};
