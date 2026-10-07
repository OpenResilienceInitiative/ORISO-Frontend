import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Loading } from './Loading';

const meta = {
	title: 'FEEDBACK/Loading',
	component: Loading,
	tags: ['autodocs'],
	parameters: {
		layout: 'fullscreen',
		docs: {
			description: {
				component:
					'Shared orbital loading for the app, entry flows, overlays and attachments. It stays visible while the operation is active and respects reduced motion.'
			}
		}
	},
	args: {
		label: 'Wird geladen …',
		delayMs: 0,
		size: 'large'
	}
} satisfies Meta<typeof Loading>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Page: Story = { args: { layout: 'page' } };

export const Section: Story = {
	args: { layout: 'section', label: 'Wir schauen, wer gerade live ist …' },
	decorators: [
		(Story) => (
			<div style={{ display: 'flex', minHeight: 420, padding: 24 }}>
				<Story />
			</div>
		)
	]
};

export const Inline: Story = {
	args: { layout: 'inline', size: 'small', label: 'Anhang wird geladen …' },
	decorators: [
		(Story) => (
			<div style={{ padding: 24 }}>
				<Story />
			</div>
		)
	]
};
