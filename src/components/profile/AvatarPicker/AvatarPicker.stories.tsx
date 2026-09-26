import * as React from 'react';
import { useState } from 'react';
import { expect, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { AvatarPicker, type AvatarPickerRole } from './AvatarPicker';

/**
 * #1540: avatar choice in the profile. Saving is not wired yet — advice
 * seekers need #1126, counsellors a self-service endpoint (today only the
 * admin API sets `avatarKind`/`avatarId`).
 */
const Picker = ({ role }: { role: AvatarPickerRole }) => {
	const [value, setValue] = useState<string>('magpie.svg');
	return (
		<div
			style={{
				maxWidth: 560,
				padding: 24,
				borderRadius: 28,
				background: 'var(--m3-surface-container-low)'
			}}
		>
			<AvatarPicker
				role={role}
				value={value}
				onChange={setValue}
				label="Ihr Bild"
			/>
		</div>
	);
};

const meta = {
	title: 'Profile/AvatarPicker',
	component: Picker
} satisfies Meta<typeof Picker>;

export default meta;
type Story = StoryObj<typeof meta>;

export const AdviceSeeker: Story = {
	args: { role: 'asker' },
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const fox = await canvas.findByRole('radio', { name: 'fox' });
		await userEvent.click(fox);
		await expect(fox).toHaveAttribute('aria-checked', 'true');
	}
};

export const Counsellor: Story = {
	args: { role: 'consultant' }
};
