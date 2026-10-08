import type { Meta, StoryObj } from '@storybook/react-vite';
import * as React from 'react';
import { expect } from 'storybook/test';
import { OrbitalTrails } from './OrbitalTrails';

const storySurface: React.CSSProperties = {
	display: 'flex',
	minHeight: '100vh',
	alignItems: 'center',
	justifyContent: 'center',
	padding: 32,
	background: 'var(--m3-background, #fcf9f9)'
};

const meta = {
	id: 'experiments-orbitaltrails',
	title: 'FEEDBACK/Orbital trails',
	component: OrbitalTrails,
	tags: ['autodocs'],
	decorators: [
		(Story) => (
			<div style={storySurface}>
				<Story />
			</div>
		)
	],
	parameters: {
		layout: 'fullscreen',
		docs: {
			description: {
				component:
					"Canvas renderer based on Zevan Rosser's accumulating orbital trails. The shared Loading component uses the single brand orbit for app and entry-flow loading. This gallery also shows the renderer's other variants."
			}
		}
	},
	args: {
		label: 'Orbital animation',
		palette: 'brand',
		seed: 17,
		warmupFrames: 0,
		paused: false
	}
} satisfies Meta<typeof OrbitalTrails>;

export default meta;
type Story = StoryObj<typeof meta>;

export const LiveEvolution: Story = {};

export const AsLoadingIndicator: Story = {
	name: 'Shared loading orbit',
	args: {
		label: 'Wird geladen',
		palette: 'brand',
		variant: 'single',
		warmupFrames: 40
	},
	decorators: [
		(Story) => (
			<div
				style={{
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'center',
					width: '100%',
					minHeight: 360,
					padding: 24,
					background: 'var(--m3-background, #fcf9f9)'
				}}
			>
				<div style={{ width: 220 }}>
					<Story />
				</div>
			</div>
		)
	],
	parameters: {
		docs: {
			description: {
				story: 'The same single brand orbit used by the global Loading component and live-chat checking state.'
			}
		}
	}
};

export const DevelopedState: Story = {
	args: {
		palette: 'mixed',
		paused: true,
		warmupFrames: 420
	}
};

export const VariantComparison: Story = {
	render: () => (
		<div
			style={{
				display: 'grid',
				width: 'min(100%, 1040px)',
				gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
				gap: 24
			}}
		>
			{(['brand', 'mixed', 'neutral'] as const).map((palette, index) => (
				<figure key={palette} style={{ margin: 0 }}>
					<OrbitalTrails
						label={`${palette} orbital animation`}
						palette={palette}
						seed={17 + index * 12}
						paused
						warmupFrames={280}
					/>
					<figcaption
						style={{
							marginTop: 8,
							color: 'var(--m3-on-surface, #1d1b20)',
							font: '500 14px/20px system-ui, sans-serif',
							textTransform: 'capitalize'
						}}
					>
						{palette}
					</figcaption>
				</figure>
			))}
		</div>
	)
};

/** Coloured and changing surfaces must remain visible through the loader. */
export const TransparentSurfaces: Story = {
	decorators: [],
	render: () => (
		<div style={{ display: 'flex', flexWrap: 'wrap', gap: 24 }}>
			{[
				'var(--m3-surface-container)',
				'var(--m3-primary-container)',
				'var(--m3-inverse-surface)'
			].map((background) => (
				<div
					key={background}
					style={{ width: 220, padding: 16, background }}
				>
					<OrbitalTrails
						label="Orbital animation"
						variant="single"
						warmupFrames={180}
						paused
					/>
				</div>
			))}
		</div>
	),
	play: async ({ canvasElement }) => {
		const roots =
			canvasElement.querySelectorAll<HTMLElement>('.orbitalTrails');
		expect(roots).toHaveLength(3);
		for (const root of roots) {
			expect(getComputedStyle(root).backgroundColor).toBe(
				'rgba(0, 0, 0, 0)'
			);
			const canvas = root.querySelector('canvas')!;
			const context = canvas.getContext('2d')!;
			expect(context.getImageData(0, 0, 1, 1).data[3]).toBe(0);
			const pixels = context.getImageData(
				0,
				0,
				canvas.width,
				canvas.height
			).data;
			expect(
				pixels.some((value, index) => index % 4 === 3 && value > 0)
			).toBe(true);
		}
	}
};
