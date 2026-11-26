import * as React from 'react';
import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fireEvent, userEvent, within } from 'storybook/test';
import { PersonalDisplayProfilePanel } from '../../features/personal-display/PersonalDisplayEntry';
import { DEFAULT_DISPLAY } from '../../features/personal-display/preferences';
import { ProfileCard } from './ProfileCard';
import './profile.styles';

const meta = {
	title: 'Profile/Accessibility',
	component: PersonalDisplayProfilePanel,
	parameters: { layout: 'padded' },
	args: { preferences: DEFAULT_DISPLAY, onChange: () => {} }
} satisfies Meta<typeof PersonalDisplayProfilePanel>;

export default meta;
type Story = StoryObj<typeof meta>;

const Interactive = () => {
	const [preferences, setPreferences] = useState(DEFAULT_DISPLAY);
	return (
		<div
			className="profile__cards"
			style={
				{
					'--oriso-personal-text-scale': preferences.textSize / 100
				} as React.CSSProperties
			}
		>
			<ProfileCard>
				<PersonalDisplayProfilePanel
					preferences={preferences}
					onChange={setPreferences}
				/>
			</ProfileCard>
		</div>
	);
};

export const Preferences: Story = {
	render: () => <Interactive />,
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(
			canvas.getByRole('heading', { name: 'Zugänglichkeit' })
		).toBeVisible();
		// Five stops with 100 % in the middle; the arrows step through them.
		const slider = canvas.getByRole('slider', { name: 'Textgröße' });
		await expect(slider).toHaveAttribute('aria-valuemax', '4');
		await expect(slider).toHaveAttribute('aria-valuenow', '2');
		await expect(slider).toHaveAttribute('aria-valuetext', '100 %');
		const moveTo = (stop: number) =>
			fireEvent.change(slider, { target: { value: String(stop) } });
		moveTo(1);
		await expect(canvas.getByRole('status')).toHaveTextContent('75 %');
		moveTo(0);
		await expect(slider).toHaveAttribute('aria-valuetext', '50 %');
		moveTo(4);
		await expect(canvas.getByRole('status')).toHaveTextContent('200 %');
		moveTo(2);
		await expect(canvas.getByRole('status')).toHaveTextContent('100 %');
		await userEvent.click(canvas.getByRole('button', { name: 'Größer' }));
		await expect(canvas.getByRole('status')).toHaveTextContent('150 %');
		await expect(slider).toHaveAttribute('aria-valuetext', '150 %');
		await expect(
			canvasElement.querySelector('.profile__cards')
		).toHaveStyle('--oriso-personal-text-scale: 1');
		await userEvent.click(
			canvas.getByRole('button', { name: 'Speichern' })
		);
		await expect(
			canvasElement.querySelector('.profile__cards')
		).toHaveStyle('--oriso-personal-text-scale: 1.5');
		await userEvent.click(canvas.getByRole('radio', { name: 'Hoch' }));
		await expect(canvas.getByRole('radio', { name: 'Hoch' })).toBeChecked();
		await expect(
			canvas.getByRole('radio', { name: 'System' })
		).toBeChecked();
	}
};
