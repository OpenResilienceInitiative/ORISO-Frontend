import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { ErstantwortEmailOverlay } from './ErstantwortEmailOverlay';
import { phone390Globals } from '../message/messageStoryShell';

/**
 * The "leave an e-mail address" dialog behind the notification choice. It is
 * the house `M3Dialog` — the same sheet as every other message box — with one
 * `OrisoTextField` inside, not a bespoke overlay.
 */
/* The M3 dialog portals out of the canvas root, so queries run on the body. */
const screen = () => within(document.body);

const meta = {
	title: 'Components/Chat/Erstantwort/EmailDialog',
	component: ErstantwortEmailOverlay,
	parameters: { layout: 'fullscreen' },
	args: { onClose: fn(), onSaved: fn() }
} satisfies Meta<typeof ErstantwortEmailOverlay>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Empty field: saving is disabled until the address is valid. */
export const Empty: Story = {
	play: async () => {
		const dialog = await screen().findByRole('dialog');
		/* The dialog fades in; assert once the transition has finished. */
		await waitFor(() => expect(dialog).toBeVisible());
		await expect(
			screen().getByRole('button', { name: /^(Save|Speichern)$/ })
		).toBeDisabled();
	}
};

/** A valid address enables the primary action. */
export const ValidAddress: Story = {
	play: async () => {
		await userEvent.type(
			await screen().findByRole('textbox'),
			'ratsuchend@example.org'
		);
		await expect(
			screen().getByRole('button', { name: /^(Save|Speichern)$/ })
		).toBeEnabled();
	}
};

/** An invalid address says so on the field and keeps saving disabled. */
export const InvalidAddress: Story = {
	play: async () => {
		await userEvent.type(await screen().findByRole('textbox'), 'nope');
		await expect(screen().getByRole('textbox')).toBeInvalid();
		await expect(
			screen().getByRole('button', { name: /^(Save|Speichern)$/ })
		).toBeDisabled();
	}
};

/** The same dialog at phone width. */
export const Mobile: Story = {
	globals: phone390Globals
};

/** With the login name: read-only field, copy button and the shared-device warning. */
export const WithLoginName: Story = {
	args: { userName: 'ratsuchend-4711' },
	play: async () => {
		await waitFor(() =>
			expect(screen().getByDisplayValue('ratsuchend-4711')).toBeVisible()
		);
		await expect(
			screen().getByRole('button', { name: /^(Copy|Kopieren)$/ })
		).toBeEnabled();
	}
};

export const WithLoginNameMobile: Story = {
	...WithLoginName,
	globals: phone390Globals
};
