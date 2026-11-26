import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { phone390Globals } from '../../message/messageStoryShell';
import { consultantProfileTour } from './profileTour';
import { TourStepGallery } from './TourStepGallery';

const meta = {
	title: 'Components/ProductTour/Tours/Profile',
	component: TourStepGallery,
	tags: ['autodocs'],
	args: { tour: consultantProfileTour },
	parameters: {
		layout: 'fullscreen',
		docs: {
			description: {
				component:
					'Profile tour (FE#2341, TOUR-11), watch-only: one card per profile area, ending on Help → Rundgänge with the "?" launcher switch. Cards below the fold are optional with auto placement.'
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
			consultantProfileTour.steps.length
		);
		await expect(canvas.getByText(/Rundgang-Knopf anzeigen/)).toBeVisible();
	}
};

export const English: Story = { globals: { locale: 'en' } };

export const Phone390: Story = {
	globals: { locale: 'de', ...phone390Globals }
};
