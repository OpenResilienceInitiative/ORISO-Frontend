import type { Meta, StoryObj } from '@storybook/react-vite';
import * as React from 'react';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { THEME_APPLIED_EVENT } from '../../utils/theme/themeEvents';
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

const TenantThemeDemo = ({ paused }: { paused: boolean }) => {
	const [primary, setPrimary] = React.useState('#a5000a');
	React.useEffect(() => {
		window.dispatchEvent(new CustomEvent(THEME_APPLIED_EVENT));
	}, [primary]);
	return (
		<div style={{ width: 'min(100%, 760px)' }}>
			<p>
				Die Farbe wechseln: Auch vorhandene Spuren übernehmen die
				Trägerfarbe.
			</p>
			<div
				style={{
					display: 'flex',
					flexWrap: 'wrap',
					gap: 12,
					marginBottom: 24
				}}
			>
				{[
					['Rot', '#a5000a'],
					['Blau', '#004488'],
					['Grün', '#176b35']
				].map(([label, color]) => (
					<button
						key={color}
						type="button"
						aria-pressed={primary === color}
						onClick={() => setPrimary(color)}
					>
						{label}
					</button>
				))}
			</div>
			<div style={{ display: 'flex', flexWrap: 'wrap', gap: 24 }}>
				{[
					'var(--m3-surface-container)',
					'var(--m3-primary-container)',
					'var(--m3-inverse-surface)'
				].map((background) => (
					<div
						key={background}
						style={
							{
								'width': 220,
								'padding': 16,
								background,
								'--m3-primary': primary
							} as React.CSSProperties
						}
					>
						<OrbitalTrails
							label="Wird geladen"
							variant="single"
							warmupFrames={180}
							paused={paused}
						/>
					</div>
				))}
			</div>
		</div>
	);
};

const checkTenantThemeChange: Story['play'] = async ({ canvasElement }) => {
	const canvas = within(canvasElement);
	const drawings = Array.from(canvasElement.querySelectorAll('canvas'));
	const hasRed = (drawing: HTMLCanvasElement) => {
		const pixels = drawing
			.getContext('2d')!
			.getImageData(0, 0, drawing.width, drawing.height).data;
		return pixels.some(
			(value, index) =>
				index % 4 === 0 &&
				pixels[index + 3] > 32 &&
				value > pixels[index + 2] + 30
		);
	};
	await waitFor(() => expect(drawings.every(hasRed)).toBe(true));
	await userEvent.click(canvas.getByRole('button', { name: 'Blau' }));
	await waitFor(() => {
		for (const drawing of drawings) {
			// The same mounted canvases must discard red trails and repaint blue.
			expect(drawing.isConnected).toBe(true);
			expect(hasRed(drawing)).toBe(false);
			const pixels = drawing
				.getContext('2d')!
				.getImageData(0, 0, drawing.width, drawing.height).data;
			expect(
				pixels.some(
					(value, index) =>
						index % 4 === 2 &&
						pixels[index + 3] > 32 &&
						value > pixels[index - 2] + 30
				)
			).toBe(true);
			expect(
				drawing.getContext('2d')!.getImageData(0, 0, 1, 1).data[3]
			).toBe(0);
		}
	});
};

export const TenantThemeChanges: Story = {
	decorators: [],
	render: () => <TenantThemeDemo paused />,
	play: checkTenantThemeChange,
	parameters: {
		docs: {
			description: {
				story: 'Applies a late tenant colour to the same mounted, paused loaders. All accumulated trails repaint, on light, red and dark surfaces. The animation uses Primary with dedicated loader opacity roles, not fixed red State Layer values.'
			}
		}
	}
};

export const TenantThemeChangesWhileAnimating: Story = {
	decorators: [],
	render: () => <TenantThemeDemo paused={false} />,
	play: checkTenantThemeChange
};

/** Compare the current motion role with the supplied M3 State Layer alphas.
 * This does not replace the motion defaults with interaction-state values. */
export const TrailOpacityComparison: Story = {
	render: () => (
		<div
			style={{
				display: 'flex',
				flexWrap: 'wrap',
				gap: 24,
				width: 'min(100%, 1040px)'
			}}
		>
			{[0.045, 0.08, 0.1, 0.16].map((opacity) => (
				<figure
					key={opacity}
					style={
						{
							'margin': 0,
							'width': 220,
							'--oriso-loader-trail-opacity': opacity
						} as React.CSSProperties
					}
				>
					<OrbitalTrails
						label="Wird geladen"
						variant="single"
						paused
						warmupFrames={180}
					/>
					<figcaption>
						{opacity === 0.045
							? 'Bisherige Darstellung: 4,5 %'
							: `Vergleich: ${opacity * 100} %`}
					</figcaption>
				</figure>
			))}
		</div>
	),
	play: async ({ canvasElement }) => {
		const drawings = Array.from(canvasElement.querySelectorAll('canvas'));
		expect(drawings).toHaveLength(4);
		const coverage = drawings.map((drawing) => {
			const pixels = drawing
				.getContext('2d')!
				.getImageData(0, 0, drawing.width, drawing.height).data;
			return pixels.reduce(
				(sum, value, index) => sum + (index % 4 === 3 ? value : 0),
				0
			);
		});
		for (let index = 1; index < coverage.length; index += 1) {
			expect(coverage[index]).toBeGreaterThan(coverage[index - 1]);
		}
	}
};
