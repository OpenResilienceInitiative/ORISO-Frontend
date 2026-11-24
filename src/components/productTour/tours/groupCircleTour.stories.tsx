import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { phone390Globals } from '../../message/messageStoryShell';
import { consultantGroupCircleTour } from './groupCircleTour';
import { TourStepGallery } from './TourStepGallery';

const meta = {
	title: 'Components/ProductTour/Tours/Gesprächskreis',
	component: TourStepGallery,
	tags: ['autodocs'],
	args: { tour: consultantGroupCircleTour },
	parameters: {
		layout: 'fullscreen',
		docs: {
			description: {
				component:
					'Gesprächskreis tour (FE#2341), watch-only: create entry, circle format card, topic picker, then one centred step for language, co-moderators, sharing, waiting room and "Chat starten". Only shown when the circle format is on.'
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
			consultantGroupCircleTour.steps.length
		);
		await expect(
			canvas.getByText('Einstellen, teilen, starten')
		).toBeVisible();
	}
};

export const English: Story = { globals: { locale: 'en' } };

export const Phone390: Story = {
	globals: { locale: 'de', ...phone390Globals }
};
