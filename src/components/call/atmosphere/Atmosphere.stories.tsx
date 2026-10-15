import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react';

import { ATMOSPHERE_NAMES, Atmosphere } from './Atmosphere';

/**
 * The living backdrop, ported verbatim from the handoff's `pond.js`.
 *
 * Soft masses of colour drift against each other on a very slow clock; some
 * worlds carry blurred bands that swell along their run, a river seen from
 * above. Canvas 2D, no shader, no library, about 7 kB.
 *
 * It does **not** react to speech. That was tried during the design and
 * dropped: ripples on speech read as noise in a room where someone is talking
 * about something difficult. Under `prefers-reduced-motion` it renders a
 * single still frame rather than animating slowly.
 *
 * The atmosphere is chosen centrally by the counselling centre. An advice
 * seeker never picks one, and a counsellor only selects from what the centre
 * has configured.
 */
const meta: Meta<typeof Atmosphere> = {
	title: 'Call/Atmosphere',
	component: Atmosphere,
	parameters: { layout: 'fullscreen' }
};

export default meta;
type Story = StoryObj<typeof Atmosphere>;

const Frame = ({ palette }: { palette: string }) => (
	<figure style={{ margin: 0 }}>
		<div
			style={{
				position: 'relative',
				inlineSize: 280,
				blockSize: 170,
				borderRadius: 12,
				overflow: 'hidden'
			}}
		>
			<Atmosphere palette={palette as never} />
		</div>
		<figcaption
			style={{
				font: '500 12px/20px Inter, system-ui, sans-serif',
				color: '#444748',
				paddingBlockStart: 6
			}}
		>
			{palette}
		</figcaption>
	</figure>
);

/** All eleven worlds the ported file defines. */
export const AlleWelten: Story = {
	render: () => (
		<div
			style={{
				display: 'flex',
				flexWrap: 'wrap',
				gap: 20,
				padding: 24
			}}
		>
			{ATMOSPHERE_NAMES.map((name) => (
				<Frame key={name} palette={name} />
			))}
		</div>
	)
};

/** One at full size, the way a stage actually carries it. */
export const Buehne: Story = {
	render: () => (
		<div style={{ position: 'relative', inlineSize: 900, blockSize: 560 }}>
			<Atmosphere palette="fluss" />
		</div>
	)
};

/** The two that are deliberately still — a choice, not an omission. */
export const Still: Story = {
	render: () => (
		<div style={{ display: 'flex', gap: 20, padding: 24 }}>
			<Frame palette="ruhe" />
			<Frame palette="duene" />
		</div>
	)
};

/** The two dark worlds, for an evening consultation. */
export const Dunkel: Story = {
	render: () => (
		<div style={{ display: 'flex', gap: 20, padding: 24 }}>
			<Frame palette="nacht" />
			<Frame palette="lagerfeuer" />
		</div>
	)
};
