import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { computeOrisoPalette } from '../../utils/theme/orisoScheme';
import {
	effectiveBackground,
	wcagContrast
} from '../../utils/theme/wcagContrast';
import { TopicTag } from './TopicTag';

const LIGHT_BRAND_COLOUR = '#b4ddee';
const SEEDS = ['#a5000a', '#0b5394', '#4eb3a0', '#ffd700', LIGHT_BRAND_COLOUR];

const expectReadable = (tag: Element) =>
	expect(
		wcagContrast(getComputedStyle(tag).color, effectiveBackground(tag))
	).toBeGreaterThanOrEqual(4.5);

const meta = {
	title: 'Components/Session/TopicTag',
	component: TopicTag,
	tags: ['autodocs'],
	parameters: {
		layout: 'centered',
		docs: {
			description: {
				component:
					'The global topic tag ("Themenberatung", e.g. "Familienberatung"). ' +
					'One pill for the session list, the session header and the group views. ' +
					'Colours are the named tokens `--oriso-topic-tag-bg` / `--oriso-topic-tag-fg` ' +
					'(resting) and `--oriso-topic-tag-active-bg` / `--oriso-topic-tag-active-fg` ' +
					'(selected or hovered card), derived per Träger by the colour engine ' +
					'from the primary-fixed and primary-container tones and guarded for 4.5:1.'
			}
		}
	},
	args: { children: 'Familienberatung' }
} satisfies Meta<typeof TopicTag>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Resting: Story = {
	play: async ({ canvasElement }) => {
		const tag = within(canvasElement).getByText('Familienberatung');
		expectReadable(tag);
	}
};

export const Emphasis: Story = {
	name: 'Selected or hovered card',
	args: { emphasis: true },
	play: async ({ canvasElement }) => {
		const tag = within(canvasElement).getByText('Familienberatung');
		expectReadable(tag);
	}
};

export const LightBrandColour: Story = {
	name: 'Light Träger colour (#b4ddee) stays readable',
	parameters: { orisoSeed: LIGHT_BRAND_COLOUR },
	render: (args) => (
		<div style={{ display: 'flex', gap: 12 }}>
			<TopicTag {...args} />
			<TopicTag {...args} emphasis />
		</div>
	),
	play: async ({ canvasElement }) => {
		const tags = canvasElement.querySelectorAll('.topicTag');
		await expect(tags).toHaveLength(2);
		tags.forEach(expectReadable);
	}
};

export const EveryTraeger: Story = {
	name: 'Every Träger seed reaches 4.5:1',
	render: (args) => (
		<div style={{ display: 'grid', gap: 12 }}>
			{SEEDS.map((seed) => (
				<div
					key={seed}
					data-seed={seed}
					style={{
						display: 'flex',
						gap: 12,
						...(computeOrisoPalette({ primary: seed }, 'light')
							.tokens as React.CSSProperties)
					}}
				>
					<TopicTag {...args} />
					<TopicTag {...args} emphasis />
				</div>
			))}
		</div>
	),
	play: async ({ canvasElement }) => {
		const tags = canvasElement.querySelectorAll('.topicTag');
		await expect(tags).toHaveLength(SEEDS.length * 2);
		tags.forEach(expectReadable);
	}
};

export const LongName: Story = {
	args: {
		children:
			'Beratung für Eltern und Familien in besonderen Lebenslagen und Krisen'
	},
	decorators: [
		(Story) => (
			<div style={{ width: 220 }}>
				<Story />
			</div>
		)
	],
	play: async ({ canvasElement }) => {
		const tag = canvasElement.querySelector<HTMLElement>('.topicTag')!;
		await expect(getComputedStyle(tag).textOverflow).toBe('ellipsis');
		await expect(tag.scrollWidth).toBeGreaterThan(tag.clientWidth);
	}
};
