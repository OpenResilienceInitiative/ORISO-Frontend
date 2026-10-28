import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { SideScrollerFooter } from './SideScrollerFooter';

const meta = {
	title: 'Molecules/SideScrollerFooter',
	component: SideScrollerFooter,
	tags: ['autodocs'],
	args: {
		back: { label: 'Back', onClick: fn() },
		next: { label: 'Next', onClick: fn() }
	},
	parameters: {
		docs: {
			description: {
				component:
					'Existing client-profile footer shared with the protected request wizard. The profile variant preserves its original appearance and focusable inert actions. The wizard uses the Figma 32px arrow and 128×96 navigation pills.'
			}
		}
	}
} satisfies Meta<typeof SideScrollerFooter>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Profile: Story = {
	play: async ({ canvasElement, args }) => {
		const canvas = within(canvasElement);
		await userEvent.click(canvas.getByRole('button', { name: 'Back' }));
		await expect(args.back.onClick).toHaveBeenCalled();
		await userEvent.click(canvas.getByRole('button', { name: 'Next' }));
		await expect(args.next.onClick).toHaveBeenCalled();
	}
};
export const Wizard: Story = { ...Profile, args: { variant: 'wizard' } };
export const WizardUnavailable: Story = {
	args: {
		variant: 'wizard',
		back: { label: 'Back', disabled: true },
		next: { label: 'Next', disabled: true }
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(
			canvas.getByRole('button', { name: 'Back' })
		).toBeDisabled();
		await expect(
			canvas.getByRole('button', { name: 'Next' })
		).toBeDisabled();
	}
};
export const ProfileInertNext: Story = {
	args: { next: { label: 'Next', ariaDisabled: true, onClick: fn() } },
	play: async ({ canvasElement, args }) => {
		const next = within(canvasElement).getByRole('button', {
			name: 'Next'
		});
		await expect(next).toHaveAttribute('aria-disabled', 'true');
		await expect(next).not.toBeDisabled();
		await userEvent.click(next);
		await expect(args.next.onClick).not.toHaveBeenCalled();
	}
};
