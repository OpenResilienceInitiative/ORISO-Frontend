import * as React from 'react';
import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';

import { ViewSwitcher, type CallView } from './ViewSwitcher';
import { HainStage, type CallParticipant } from '../stages/HainStage';
import { pickIconColor } from '../../../utils/pseudonymGenerator';

import { ReactComponent as GroupsIcon } from '../../../resources/img/icons/groups.svg';
import { ReactComponent as HomeVideoCallIcon } from '../../../resources/img/icons/home-video-call.svg';
import { ReactComponent as SpotlightIcon } from '../../../resources/img/icons/maximize-content.svg';

/**
 * The view switcher (Ticket 05) — how the room changes shape.
 *
 * The handoff gives the geometry exactly: a 44px rail at radius 22 holding
 * 36px round buttons. Inactive entries are icon only; the active one grows a
 * word, `padding: 0 14px 0 11px`, Inter 500 13/18 at `.2px`.
 *
 * Only the active view spells out its name, and the prototype says why: "the
 * control keeps its size no matter how many views the room offers." The same
 * decision is what makes the state legible without colour — the current view
 * is the only one carrying a word, so it survives greyscale and a
 * colour-blind reader.
 *
 * Two fills, because a rail on a living backdrop cannot be one set of
 * colours: `rgb(251,244,211)` on the dark stages, `#a5000a` with white ink on
 * the light ones.
 *
 * The icons are inherited, not drawn here. `maximize-content.svg` was already
 * in the library and is the same glyph the handoff uses; `groups.svg` and
 * `home-video-call.svg` were lifted out of the handoff's own icon set,
 * transforms and all, and put in the library beside it.
 *
 * **One thing for design to settle.** The prototype pairs "Kacheln" with
 * `GroupVideoCall40024px`, and that glyph is a house with a video camera in
 * it — not tiles. The handoff's icon set contains no grid or tile glyph at
 * all, so this is the prototype's own pairing rather than a porting mistake,
 * and it is left exactly as the design has it. The file is named
 * `home-video-call.svg` after what it draws rather than after the label it
 * was given, so the mismatch stays visible instead of being baked into a
 * filename. A tiles glyph would need to come from design.
 */
const meta: Meta<typeof ViewSwitcher> = {
	title: 'Call/Ansichtswechsler',
	component: ViewSwitcher,
	parameters: { layout: 'centered' }
};

export default meta;
type Story = StoryObj<typeof ViewSwitcher>;

const VIEWS: CallView[] = [
	{ key: 'kreis', label: 'Kreis', icon: <GroupsIcon /> },
	{ key: 'kacheln', label: 'Kacheln', icon: <HomeVideoCallIcon /> },
	{ key: 'spotlight', label: 'Spotlight', icon: <SpotlightIcon /> }
];

const Live = ({
	tone,
	start = 'kreis'
}: {
	tone: 'dark' | 'light';
	start?: string;
}) => {
	const [active, setActive] = useState(start);
	return (
		<ViewSwitcher
			views={VIEWS}
			active={active}
			onChange={setActive}
			label="Ansicht"
			tone={tone}
		/>
	);
};

/** On a dark stage: warm paper on near-black ink. */
export const Dunkel: Story = {
	render: () => (
		<div style={{ padding: 24, background: '#2a2c2b', borderRadius: 16 }}>
			<Live tone="dark" />
		</div>
	)
};

/** On a light stage: the ORISO red with white ink. */
export const Hell: Story = {
	render: () => (
		<div style={{ padding: 24, background: '#f0edee', borderRadius: 16 }}>
			<Live tone="light" />
		</div>
	)
};

/** Each view as the active one, so the three widths can be compared. */
export const AlleDrei: Story = {
	render: () => (
		<div
			style={{
				display: 'flex',
				flexDirection: 'column',
				gap: 12,
				padding: 24,
				background: '#2a2c2b',
				borderRadius: 16
			}}
		>
			{VIEWS.map((v) => (
				<Live key={v.key} tone="dark" start={v.key} />
			))}
		</div>
	)
};

const person = (name: string, file: string, bg: string): CallParticipant => ({
	name,
	avatar: { file, bg, iconColor: pickIconColor(bg) },
	speaking: false
});

const ROOM: CallParticipant[] = [
	person('wacher Igel 118', 'hedgehog.svg', '#FCE7E6'),
	person('ruhiger Fuchs 432', 'fox.svg', '#D6E9CA'),
	person('später Kauz 512', 'owl.svg', '#BBBCDE'),
	person('klarer Schwan 77', 'swan.svg', '#F0DC82'),
	person('naher Otter 303', 'otter.svg', '#1F3134'),
	person('stilles Pferd 907', 'horse.svg', '#6E2A3A')
];

/**
 * Where it actually sits: over the stage, near the bottom edge.
 *
 * This is also the story the browser probe measures the handoff's numbers
 * against — jsdom loads no CSS, so 44, 22, 36 and `0 14px 0 11px` can only
 * be checked where they are actually applied.
 */
export const UeberDerBuehne: Story = {
	parameters: { layout: 'fullscreen' },
	render: () => (
		<div
			style={{
				position: 'relative',
				inlineSize: 760,
				blockSize: 620,
				display: 'flex',
				alignItems: 'center',
				justifyContent: 'center',
				background: '#2a2c2b'
			}}
		>
			<HainStage participants={ROOM} box={560} atmosphere="nacht" />
			<div
				style={{
					position: 'absolute',
					insetInline: 0,
					bottom: 20,
					display: 'flex',
					justifyContent: 'center'
				}}
			>
				<Live tone="dark" />
			</div>
		</div>
	)
};
