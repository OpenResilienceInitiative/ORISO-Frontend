import * as React from 'react';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react';

import { ModalProvider } from '../../globalState/provider/ModalProvider';
import { MasterKeyLostMessage } from './MasterKeyLostMessage';
import {
	mobileParameters,
	phone390Globals,
	type MessageStoryParameters,
	withMessageShell
} from './messageStoryShell';
import './message.styles.scss';

/**
 * Shown when a message cannot be decrypted. The single boolean prop selects
 * between two different translated explanations
 * (`e2ee.subscriptionKeyLost.message.{true|false}`), and the notice carries a
 * button that opens the recovery overlay.
 *
 * This is the one place in the chat where the platform tells someone their
 * history is gone, so both wordings are worth having side by side.
 */
const meta = {
	title: 'Components/Chat/MasterKeyLostMessage',
	component: MasterKeyLostMessage,
	tags: ['autodocs'],
	parameters: {
		layout: 'fullscreen',
		docs: {
			description: {
				component:
					'Persistent inline M3Snackbar; no dismissal or auto-hide. `subscriptionKeyLost` picks the wording; the button opens `subscriptionKeyLostOverlayItem`.'
			}
		}
	},
	args: { subscriptionKeyLost: true },
	decorators: [
		(Story, ctx) =>
			withMessageShell(Story, {
				parameters: ctx.parameters as MessageStoryParameters
			})
	]
} satisfies Meta<typeof MasterKeyLostMessage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SubscriptionKeyLost: Story = {
	name: 'Room key lost',
	args: { subscriptionKeyLost: true }
};

export const MasterKeyLost: Story = {
	name: 'Master key lost',
	args: { subscriptionKeyLost: false }
};

export const Mobile: Story = {
	name: 'Mobile (390px)',
	args: { subscriptionKeyLost: true },
	globals: phone390Globals,
	parameters: {
		...mobileParameters,
		docs: {
			description: {
				story: 'The explanation is long and sits next to an icon; at 390px it must not push its button off the card.'
			}
		}
	}
};

/** The history notice stays in chat, without dismissal or a timeout. */
export const PersistentHistoryStates: Story = {
	args: { subscriptionKeyLost: true },
	render: () => (
		<div>
			{[320, 390, 412, 820, 1440].map((width) => (
				<div
					key={width}
					data-testid={`keyloss-column-${width}`}
					style={{
						width,
						maxWidth: '100%',
						display: 'grid',
						gap: 12
					}}
				>
					<MasterKeyLostMessage subscriptionKeyLost />
					<MasterKeyLostMessage subscriptionKeyLost={false} />
				</div>
			))}
		</div>
	),
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		for (const width of [320, 390, 412, 820, 1440]) {
			const host = canvas.getByTestId(`keyloss-column-${width}`);
			const notices = within(host).getAllByRole('status');
			expect(notices).toHaveLength(2);
			expect(within(notices[0]).queryByRole('button')).toBeNull();
			expect(within(notices[1]).getAllByRole('button')).toHaveLength(1);
			const more = within(notices[1]).getByRole('button', {
				name: 'Mehr erfahren'
			});
			more.focus();
			expect(more).toHaveFocus();
			for (const notice of notices) {
				expect(
					notice.getBoundingClientRect().right
				).toBeLessThanOrEqual(host.getBoundingClientRect().right + 1);
				expect(notice.scrollWidth).toBeLessThanOrEqual(
					notice.clientWidth
				);
			}
		}
	}
};

export const RecoveryExplanation: Story = {
	args: { subscriptionKeyLost: false },
	render: (args) => (
		<ModalProvider>
			<MasterKeyLostMessage {...args} />
			<div id="overlay" />
		</ModalProvider>
	),
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const more = canvas.getByRole('button', { name: 'Mehr erfahren' });
		more.focus();
		await userEvent.keyboard('{Enter}');
		const page = within(document.body);
		const explanation = await page.findByText(
			'Ende-zu-Ende Verschlüsselung'
		);
		await waitFor(() => expect(explanation).toBeVisible());
		await userEvent.click(page.getByRole('button', { name: 'Schließen' }));
		await waitFor(() =>
			expect(page.queryByText('Ende-zu-Ende Verschlüsselung')).toBeNull()
		);
		await waitFor(() => expect(more).toHaveFocus());
		await expect(canvas.getByRole('status')).toBeVisible();
	}
};
