import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { AskerCallInfoDialog } from './AskerCallInfoDialog';

/* A fixed date: the dialog shows what it is handed, so the screenshots stay
   the same from day to day. Thursday, 19 Nov 2026, 15:00–16:00 local time. */
const start = new Date(2026, 10, 19, 15, 0);
const end = new Date(2026, 10, 19, 16, 0);

const meta = {
	title: 'Chat/Calls/Advice seeker call information',
	component: AskerCallInfoDialog,
	tags: ['autodocs'],
	parameters: {
		layout: 'fullscreen',
		docs: {
			description: {
				component:
					'Only counsellors start calls (product owner, 17 Nov 2026). When an advice seeker clicks the video or audio button of a 1:1 conversation, no call starts: this dialog names the next appointment of the conversation (date, time, medium) or, without one, offers "Termin anfragen". In the app the button closes the dialog and puts the cursor into the chat composer, so the wish goes to the counsellor as a message.'
			}
		}
	},
	args: { open: true, onClose: fn(), onRequestTime: fn() },
	render: (args) => (
		<div style={{ minHeight: 640 }}>
			<AskerCallInfoDialog {...args} />
		</div>
	)
} satisfies Meta<typeof AskerCallInfoDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithVideoAppointment: Story = {
	name: 'With appointment (video)',
	args: {
		state: { status: 'appointment', start, end, medium: 'video' }
	},
	play: async () => {
		const view = within(document.body);
		const card = await view.findByTestId('asker-call-info-appointment');
		await expect(card).toHaveTextContent(/Videoanruf|Video call/);
		await expect(card).toHaveTextContent('15:00');
		await expect(
			view.queryByTestId('asker-call-info-request')
		).not.toBeInTheDocument();
	}
};

export const WithPhoneAppointment: Story = {
	name: 'With appointment (phone)',
	args: {
		state: { status: 'appointment', start, end, medium: 'phone' }
	},
	play: async () => {
		const view = within(document.body);
		const card = await view.findByTestId('asker-call-info-appointment');
		await expect(card).toHaveTextContent(/Telefonanruf|Phone call/);
	}
};

export const WithoutAppointment: Story = {
	name: 'Without appointment',
	args: { state: { status: 'none' } },
	play: async ({ args }) => {
		const view = within(document.body);
		const request = await view.findByTestId('asker-call-info-request');
		await userEvent.click(request);
		await waitFor(() => expect(args.onRequestTime).toHaveBeenCalled());
	}
};

export const Loading: Story = {
	args: { state: { status: 'loading' } }
};

export const ReadFailed: Story = {
	name: 'Appointment could not be read',
	args: { state: { status: 'error' } }
};
