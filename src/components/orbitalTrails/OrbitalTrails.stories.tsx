import type { Meta, StoryObj } from '@storybook/react-vite';
import * as React from 'react';
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
	title: 'Experiments/OrbitalTrails',
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
					"Canvas experiment based on Zevan Rosser's accumulating orbital trails. It uses the active Material 3 background and semantic colour roles.\n\n" +
					'Not wired into any production loading state yet — this is a design candidate for the registration/agency-selection loading animation (see FE#1067 follow-up). Storybook-only for now.'
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
	name: 'As a loading indicator (candidate)',
	args: {
		label: 'Wird geladen',
		palette: 'brand',
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
				story: 'Sized and centered the way it would sit in a loading slot such as the registration agency-selection results panel. Not yet used there — this story is for design review only.'
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
