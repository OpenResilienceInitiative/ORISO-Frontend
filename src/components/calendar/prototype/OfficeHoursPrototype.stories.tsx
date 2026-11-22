import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import {
	OfficeHoursPrototype,
	type AutoAcceptLink,
	type OfficeWindow
} from './OfficeHoursPrototype';

const WINDOWS: OfficeWindow[] = [
	{
		id: 'w1',
		weekday: 0,
		from: '14:00',
		to: '16:00',
		media: ['video', 'phone']
	},
	{ id: 'w2', weekday: 2, from: '09:00', to: '11:00', media: ['video'] },
	{
		id: 'w3',
		weekday: 3,
		from: '16:00',
		to: '18:00',
		media: ['phone', 'chat']
	}
];

const LINKS: AutoAcceptLink[] = [
	{
		id: 'l1',
		name: 'Offene Sprechstunde Schulden',
		windowIds: ['w1', 'w2'],
		slotMinutes: 30,
		active: true,
		url: 'https://app.oriso.org/invite/Sp7chZ31'
	},
	{
		id: 'l2',
		name: 'Telefonsprechstunde Donnerstag',
		windowIds: ['w3'],
		slotMinutes: 45,
		active: false,
		url: 'https://app.oriso.org/invite/Tel4Do18'
	}
];

const meta: Meta<typeof OfficeHoursPrototype> = {
	title: 'Templates/Calendar/Sprechzeiten (prototype)',
	component: OfficeHoursPrototype,
	parameters: {
		layout: 'fullscreen',
		docs: {
			description: {
				component:
					'Prototype for Frank *19: auto-accept time windows ("Sprechzeiten") and the links that book into them. UI only, no API.'
			}
		}
	},
	args: { initialWindows: WINDOWS, initialLinks: LINKS }
};
export default meta;
type Story = StoryObj<typeof meta>;

export const Overview: Story = {
	name: 'Sprechzeiten and their links',
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(
			canvas.getByRole('heading', { name: 'Sprechzeiten' })
		).toBeTruthy();
		// Mo 14–16 + Mi 9–11 at 30 min = 8 slots.
		await expect(
			canvas.getByText(/8 freie Termine pro Woche/)
		).toBeTruthy();
	}
};

export const AddWindow: Story = {
	name: 'Add a time window',
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await userEvent.click(
			canvas.getByRole('button', { name: 'Zeitfenster hinzufügen' })
		);
		await waitFor(() =>
			expect(canvas.getAllByText('Mo 14:00–16:00').length).toBe(2)
		);
	}
};

export const DarkTimeInputs: Story = {
	name: 'Native time fields follow Dark',
	globals: { scheme: 'dark' },
	play: async ({ canvasElement }) => {
		const timeFields = canvasElement.querySelectorAll('input[type="time"]');
		await expect(timeFields).toHaveLength(2);
		await waitFor(async () => {
			for (const field of Array.from(timeFields)) {
				await expect(getComputedStyle(field).colorScheme).toBe('dark');
			}
		});
	}
};

export const DeleteWindowUpdatesLinks: Story = {
	name: 'Deleting a window updates its links',
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await userEvent.click(
			canvas.getByRole('button', {
				name: 'Zeitfenster Do 16:00–18:00 löschen'
			})
		);
		await waitFor(() =>
			expect(canvas.getByText(/Keine Sprechzeit gewählt/)).toBeTruthy()
		);
	}
};

export const Empty: Story = {
	name: 'No Sprechzeiten yet',
	args: { initialWindows: [], initialLinks: [] }
};
