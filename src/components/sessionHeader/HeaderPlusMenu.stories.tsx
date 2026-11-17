/**
 * The 1:1 header "+" as a menu (Frank, 17.11.2026): "Supervisor verwalten"
 * (a colleague watches along, the case stays) and "Beratung übergeben" (the
 * case moves to a colleague). Desktop only, for the assigned counsellor.
 */
import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, within } from 'storybook/test';
import { HeaderPlusMenu } from './HeaderPlusMenu';
import { ChatroomMainInteractionIcon } from './ChatroomMainInteractionIcon';
import './sessionHeader.styles.scss';

const Frame = (props: React.ComponentProps<typeof HeaderPlusMenu>) => (
	<div style={{ padding: 16, minHeight: 260 }}>
		<ChatroomMainInteractionIcon
			type="nearby"
			showAddIcon
			addLabel="Hinzufügen oder übergeben"
			addExpanded
			onAddClick={() => undefined}
		/>
		<HeaderPlusMenu {...props} />
	</div>
);

const meta = {
	title: 'Components/Session/HeaderPlusMenu',
	component: Frame,
	args: {
		anchor: { left: 24, bottom: 64 },
		supervisionAvailable: true,
		onSupervision: fn(),
		onHandover: fn(),
		onClose: fn()
	}
} satisfies Meta<typeof Frame>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Supervision can be managed here: both entries active. */
export const SupervisionAndHandover: Story = {
	play: async () => {
		const menu = within(document.body).getByRole('menu');
		await expect(
			within(menu)
				.getAllByRole('menuitem')
				.map((i) => i.hasAttribute('disabled'))
		).toEqual([false, false]);
	}
};

/** Supervision is off for this agency/topic: its entry is grey with the reason; handover stays. */
export const SupervisionUnavailable: Story = {
	args: {
		supervisionAvailable: false,
		supervisionUnavailableLabel:
			'Supervisor hinzufügen – hier nicht verfügbar'
	},
	play: async () => {
		const menu = within(document.body).getByRole('menu');
		const [supervision, handover] = within(menu).getAllByRole('menuitem');
		await expect(supervision).toBeDisabled();
		await expect(handover).toBeEnabled();
	}
};

/** The agency answer is still loading: supervision waits, handover is ready. */
export const SupervisionStillLoading: Story = {
	args: { supervisionAvailable: false }
};
