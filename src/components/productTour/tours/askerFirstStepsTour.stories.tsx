import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { phone390Globals } from '../../message/messageStoryShell';
import { askerFirstStepsTour } from './askerFirstStepsTour';
import { TourStepGallery } from './TourStepGallery';

const meta = {
	title: 'Components/ProductTour/Tours/Asker first steps',
	component: TourStepGallery,
	tags: ['autodocs'],
	args: { tour: askerFirstStepsTour },
	parameters: {
		layout: 'fullscreen',
		docs: {
			description: {
				component:
					'First steps for advice seekers (FE#2343): conversations, writing, appointments, tools, profile and where the tours live. Watch-only; content-dependent steps are optional.'
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
			askerFirstStepsTour.steps.length
		);
		await expect(canvas.getByText('Willkommen!')).toBeVisible();
	}
};

export const English: Story = { globals: { locale: 'en' } };

export const Phone390: Story = {
	globals: { locale: 'de', ...phone390Globals }
};
