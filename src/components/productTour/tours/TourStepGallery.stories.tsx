import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { phone390Globals } from '../../message/messageStoryShell';
import { consultantMailCounsellingTour } from '../tourDefinitions';
import { TourStepGallery } from './TourStepGallery';

const meta = {
	title: 'Components/ProductTour/Tours/Mail counselling',
	component: TourStepGallery,
	tags: ['autodocs'],
	args: { tour: consultantMailCounsellingTour },
	parameters: {
		layout: 'fullscreen',
		docs: {
			description: {
				component:
					'Every step of a tour as the real tooltip renders it, in order (FE#2339). Each use-case tour has German, English and phone stories built on this gallery.'
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
			consultantMailCounsellingTour.steps.length
		);
		await expect(canvas.getByText('Was ist neu?')).toBeVisible();
	}
};

export const English: Story = { globals: { locale: 'en' } };

export const Phone390: Story = {
	globals: { locale: 'de', ...phone390Globals }
};
