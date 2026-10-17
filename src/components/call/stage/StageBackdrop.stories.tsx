import * as React from 'react';
import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';

import { StageBackdrop } from './StageBackdrop';
import { AtmosphereControl } from './AtmosphereControl';
import { ViewSwitcher, type CallView } from '../atoms/ViewSwitcher';
import { ReactComponent as LockIcon } from '../../../resources/img/icons/lock.svg';
import { ReactComponent as GroupsIcon } from '../../../resources/img/icons/groups.svg';
import { ReactComponent as HomeVideoCallIcon } from '../../../resources/img/icons/home-video-call.svg';
import { ReactComponent as SpotlightIcon } from '../../../resources/img/icons/maximize-content.svg';

/**
 * The stage surface (Ticket 05) — what the call is painted on.
 *
 * Three layers, in the prototype's order: the warm off-white base
 * `rgb(252,249,249)`, then either the atmosphere (multiplying over it) or the
 * counselling centre's own photograph, then the scrim.
 *
 * **Precedence is an either/or, not a z-order.** "Centre image > atmosphere
 * preset": with a preset the pond multiplies over the surface; with the
 * centre's own image there is no pond at all, because a photograph under a
 * multiplying colour field is not the backdrop that centre uploaded. The
 * image is part of the carrier's configuration — "not by an individual
 * counsellor and never by an advice seeker".
 *
 * The scrim is heavier at the top and bottom (`.34`, `.1` at 40%, `.4`) than
 * in the middle, and that is the whole point of it: the header sits in the
 * top band and the view switcher in the bottom one, and both have to stay
 * readable over a backdrop neither of them chose.
 *
 * Whether it succeeds is a contrast measurement rather than an opinion, so
 * `scripts/shootCallStages.mjs` hides the header text, photographs what is
 * actually behind it, and computes the WCAG ratio against the real ink.
 */
const meta: Meta<typeof StageBackdrop> = {
	title: 'Call/Bühnenfläche',
	component: StageBackdrop,
	parameters: { layout: 'fullscreen' }
};

export default meta;
type Story = StoryObj<typeof StageBackdrop>;

const VIEWS: CallView[] = [
	{ key: 'kreis', label: 'Kreis', icon: <GroupsIcon /> },
	{ key: 'kacheln', label: 'Kacheln', icon: <HomeVideoCallIcon /> },
	{ key: 'spotlight', label: 'Spotlight', icon: <SpotlightIcon /> }
];

/*
 * A deliberately hostile backdrop, generated rather than photographed so the
 * measurement is reproducible.
 *
 * The first version was a 2x2 check, and it was useless: scaled to cover a
 * 1240px stage its quadrants are enormous, the header text happened to land
 * on the white one, and the probe dutifully reported 16.9:1 for what was
 * supposed to be the worst case. A test that can pass by luck is not a test.
 *
 * So the top band — the whole width, well past the header's 88px — is solid
 * black with white bars cut into it. Near-black header ink now has black
 * directly behind it wherever the scrim fails to lift it, which is the
 * question actually being asked.
 */
const HOSTILE =
	'data:image/svg+xml;utf8,' +
	encodeURIComponent(
		`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="16">
			<rect width="24" height="16" fill="#fff"/>
			<rect width="24" height="8" fill="#000"/>
			<rect x="3" width="2" height="8" fill="#fff"/>
			<rect x="11" width="2" height="8" fill="#fff"/>
			<rect x="19" width="2" height="8" fill="#fff"/>
		</svg>`
	);

/** The prototype's desktop header, down to its ink. */
const Header = ({
	atmosphere,
	image
}: {
	atmosphere: 'fluss' | 'nacht' | 'lichtung';
	image?: { src: string } | null;
}) => (
	<div
		style={{
			position: 'relative',
			height: 88,
			flexShrink: 0,
			display: 'flex',
			alignItems: 'center',
			gap: 20,
			padding: '0 28px',
			boxSizing: 'border-box',
			borderBottom: '1px solid rgba(0,0,0,.08)'
		}}
	>
		<div
			style={{
				display: 'flex',
				flexDirection: 'column',
				gap: 2,
				minWidth: 0
			}}
		>
			<span
				data-testid="stage-header-title"
				style={{
					font: '500 20px/26px Inter, sans-serif',
					color: 'rgb(28,27,31)',
					whiteSpace: 'nowrap'
				}}
			>
				Suchtberatung · Gruppengespräch
			</span>
			<span
				data-testid="stage-header-sub"
				style={{
					display: 'flex',
					alignItems: 'center',
					gap: 6,
					font: '400 12px/16px Inter, sans-serif',
					color: 'rgb(102,100,105)'
				}}
			>
				<LockIcon style={{ width: 12, height: 12, opacity: 0.65 }} />
				Ende-zu-Ende verschlüsselt · 6 Teilnehmende
			</span>
		</div>
		<span style={{ flex: 1 }} />
		{/* The ticket's control: 44px, icon only, tooltip, no label — and
		    the prototype's live 30px preview inside it. */}
		<AtmosphereControl
			label="Atmosphäre wählen"
			atmosphere={atmosphere}
			image={image}
			onClick={() => undefined}
		/>
	</div>
);

const Stage = ({
	atmosphere = 'fluss',
	image,
	headerBand
}: {
	atmosphere?: 'fluss' | 'nacht' | 'lichtung';
	image?: { src: string } | null;
	/** The prototype's `rgba(255,255,255,.86)` band behind the header. */
	headerBand: boolean;
}) => {
	const [view, setView] = useState('kreis');
	return (
		<div
			style={{
				position: 'relative',
				inlineSize: 1240,
				blockSize: 620,
				borderRadius: 28,
				overflow: 'hidden',
				display: 'flex',
				flexDirection: 'column'
			}}
		>
			<StageBackdrop atmosphere={atmosphere} image={image} />
			<div
				data-testid="stage-header"
				style={{
					position: 'relative',
					background: headerBand
						? 'rgba(255,255,255,.86)'
						: 'transparent'
				}}
			>
				<Header atmosphere={atmosphere} image={image} />
			</div>
			<span style={{ flex: 1 }} />
			<div
				style={{
					position: 'relative',
					display: 'flex',
					justifyContent: 'center',
					paddingBottom: 20
				}}
			>
				<ViewSwitcher
					views={VIEWS}
					active={view}
					onChange={setView}
					label="Ansicht"
					tone="light"
				/>
			</div>
		</div>
	);
};

/** An atmosphere preset, which is the default a centre gets. */
export const MitAtmosphaere: Story = {
	render: () => <Stage atmosphere="lichtung" headerBand />
};

/** A dark preset, where the light scrim has the most to do. */
export const DunkleAtmosphaere: Story = {
	render: () => <Stage atmosphere="nacht" headerBand />
};

/**
 * The centre's own backdrop, overriding the preset.
 *
 * Deliberately a hard black-and-white check rather than a photograph: it is
 * the worst case for a translucent light scrim, and it is reproducible.
 */
export const ZentrumsbildStattPreset: Story = {
	render: () => (
		<Stage atmosphere="lichtung" image={{ src: HOSTILE }} headerBand />
	)
};

/*
 * The worst a counselling centre could plausibly upload: a dark photograph.
 * Solid black is the limit of that, and the limit is the useful case —
 * the striped version above leaves white bars under the header, which
 * flatters the result.
 */
const SOLID_BLACK =
	'data:image/svg+xml;utf8,' +
	encodeURIComponent(
		`<svg xmlns="http://www.w3.org/2000/svg" width="4" height="4">
			<rect width="4" height="4" fill="#000"/>
		</svg>`
	);

/**
 * A centre image that is simply dark, with the header band in place.
 *
 * The product configuration at its limit. The title is comfortable; the
 * 12px subtitle in `rgb(102,100,105)` is where the margin runs out, and the
 * probe prints the number rather than asserting it is fine.
 */
export const DunklesZentrumsbild: Story = {
	render: () => (
		<Stage atmosphere="lichtung" image={{ src: SOLID_BLACK }} headerBand />
	)
};

/**
 * The same hostile image with the header's own band taken away, so the scrim
 * carries the legibility alone.
 *
 * **This is a diagnostic, not a product state.** The prototype's header
 * always has its `rgba(255,255,255,.86)` band, and the probe measures this
 * story without gating on it, precisely so the number is visible: over a
 * black backdrop the scrim by itself does not lift near-black ink to a
 * readable contrast, and the band is doing that work. Worth knowing before
 * somebody simplifies the header by removing it.
 */
export const NurScrim: Story = {
	render: () => (
		<Stage
			atmosphere="lichtung"
			image={{ src: HOSTILE }}
			headerBand={false}
		/>
	)
};
