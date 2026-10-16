import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { NotificationBrowserDialog } from './NotificationBrowserDialog';
import { phone390Globals } from '../message/messageStoryShell';

/**
 * The browser step after "Set up both" (or "Browser only"): what the
 * permission is for, the tone the person will hear, and the one button that
 * asks the browser. The dialog portals out of the canvas, so the stories query
 * `document.body`.
 */
const meta = {
	title: 'Components/Chat/Erstantwort/NotificationBrowserDialog',
	component: NotificationBrowserDialog,
	parameters: { layout: 'fullscreen' },
	args: { onClose: fn(), onConfirm: fn() }
} satisfies Meta<typeof NotificationBrowserDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

const body = () => within(document.body);

/** Browser-only choice: the dialog opens straight away. */
export const Default: Story = {
	play: async () => {
		await waitFor(() =>
			expect(body().getByRole('radiogroup')).toBeTruthy()
		);
		await expect(body().getAllByRole('radio').length).toBe(13);
	}
};

/** After "Set up both" and a saved address: name the one step left. */
export const AfterEmailSaved: Story = {
	args: { emailJustSaved: true },
	play: async () => {
		await waitFor(() =>
			expect(
				body().getByText(
					/address is saved|E-Mail-Adresse ist gespeichert/i
				)
			).toBeTruthy()
		);
	}
};

/** Choosing a tone plays it and hands it to the confirm button. */
export const ToneSelected: Story = {
	play: async ({ args }) => {
		const tone = await waitFor(() => {
			const el = body().getByTestId('notificationTone-ton-5');
			expect(el).toBeTruthy();
			return el;
		});
		await userEvent.click(tone);
		await expect(tone.getAttribute('aria-checked')).toBe('true');
		await userEvent.click(
			body().getByRole('button', {
				name: /Enable browser|Browser aktivieren/i
			})
		);
		await expect(args.onConfirm).toHaveBeenCalledWith('ton-5', true);
	}
};

/** The site is blocked: no tone, no button, only the way to lift the block. */
export const Blocked: Story = {
	args: { blocked: true },
	play: async () => {
		await waitFor(() => expect(body().getByRole('alert')).toBeTruthy());
		await expect(body().queryByRole('radiogroup')).toBeNull();
	}
};

export const Mobile: Story = {
	args: { emailJustSaved: true },
	globals: phone390Globals,
	parameters: { viewport: { defaultViewport: 'mobile1' } }
};
