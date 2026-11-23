import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { phone390Globals } from '../../message/messageStoryShell';
import { consultantCaseHandoverTour } from './caseHandoverTour';
import { TourStepGallery } from './TourStepGallery';

const meta = {
	title: 'Components/ProductTour/Tours/Case handover',
	component: TourStepGallery,
	tags: ['autodocs'],
	args: { tour: consultantCaseHandoverTour },
	parameters: {
		layout: 'fullscreen',
		docs: {
			description: {
				component:
					'Case-handover tour (FE#2341), watch-only: offering an own case via "+", finding a colleague, "Zugriff anfragen" and the status in the timeline. Steps on the header "+" and the card button are optional (they need content).'
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
			consultantCaseHandoverTour.steps.length
		);
		await expect(
			canvas.getByText('Übergabe in zwei Richtungen')
		).toBeVisible();
	}
};

export const English: Story = { globals: { locale: 'en' } };

export const Phone390: Story = {
	globals: { locale: 'de', ...phone390Globals }
};
