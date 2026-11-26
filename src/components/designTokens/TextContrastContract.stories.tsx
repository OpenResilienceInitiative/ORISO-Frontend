import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';
import {
	describeLowContrast,
	findLowContrastText,
	paintedContrast
} from './textContrastContract';

/**
 * Guards the contrast helper the dark-mode stories rely on. Grey
 * rgb(118.7, 118.7, 118.7) on white is 4.497:1 (written as `color(srgb …)`
 * so the browser keeps the fraction). That rounds to 4.5 but is below the
 * AA threshold, and WCAG compares the exact ratio.
 */
const BORDERLINE_INK = 'color(srgb 0.4655 0.4655 0.4655)';

const Specimen = () => (
	<div
		data-testid="specimen"
		style={{ background: '#ffffff', padding: 16, width: 320 }}
	>
		<p style={{ color: BORDERLINE_INK, margin: 0 }}>Borderline text</p>
	</div>
);

const meta = {
	title: 'Foundations/Text contrast contract',
	component: Specimen,
	parameters: { layout: 'centered' }
} satisfies Meta<typeof Specimen>;

export default meta;
type Story = StoryObj<typeof meta>;

export const BorderlineRatioIsNotRoundedUp: Story = {
	play: async ({ canvas }) => {
		const specimen = canvas.getByTestId('specimen');
		const text = canvas.getByText('Borderline text');

		const ratio = paintedContrast(text);
		await expect(ratio).toBeGreaterThan(4.49);
		await expect(ratio).toBeLessThan(4.5);

		const failing = findLowContrastText(specimen, 4.5);
		await expect(failing.map((entry) => entry.text)).toEqual([
			'Borderline text'
		]);
		// The message floors, so a failing ratio never reads as 4.5.
		await expect(describeLowContrast(failing)[0]).toContain('4.49:1');
	}
};
