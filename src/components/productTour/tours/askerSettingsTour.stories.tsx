import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { phone390Globals } from '../../message/messageStoryShell';
import { askerSettingsTour } from './askerSettingsTour';
import { TourStepGallery } from './TourStepGallery';

const meta = {
	title: 'Components/ProductTour/Tours/Asker settings',
	component: TourStepGallery,
	tags: ['autodocs'],
	args: { tour: askerSettingsTour },
	parameters: {
		layout: 'fullscreen',
		docs: {
			description: {
				component:
					'Settings for advice seekers (FE#2343): password, two-factor, recovery key, account deletion (explained only), notifications and display. Watch-only.'
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
			askerSettingsTour.steps.length
		);
		await expect(canvas.getByText('Ihre Einstellungen')).toBeVisible();
	}
};

export const English: Story = { globals: { locale: 'en' } };

export const Phone390: Story = {
	globals: { locale: 'de', ...phone390Globals }
};
