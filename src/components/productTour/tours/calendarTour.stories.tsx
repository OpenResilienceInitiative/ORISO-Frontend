import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { phone390Globals } from '../../message/messageStoryShell';
import { consultantCalendarTour } from './calendarTour';
import { TourStepGallery } from './TourStepGallery';

const meta = {
	title: 'Components/ProductTour/Tours/Calendar',
	component: TourStepGallery,
	tags: ['autodocs'],
	args: { tour: consultantCalendarTour },
	parameters: {
		layout: 'fullscreen',
		docs: {
			description: {
				component:
					'Calendar tour (FE#2341), watch-only: nav item, "+ Neu", view switch, quick entry and working hours (desktop, optional), ⋮ settings and "Links ohne Termin" (list view, optional).'
			}
		}
	}
} satisfies Meta<typeof TourStepGallery>;

export default meta;
type Story = StoryObj<typeof meta>;

export const German: Story = {
	globals: { locale: 'de' },
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(canvas.getAllByRole('alertdialog')).toHaveLength(
			consultantCalendarTour.steps.length
		);
		await expect(canvas.getByText('Kalender-Einstellungen')).toBeVisible();
	}
};

export const English: Story = { globals: { locale: 'en' } };

export const Phone390: Story = {
	globals: { locale: 'de', ...phone390Globals }
};
