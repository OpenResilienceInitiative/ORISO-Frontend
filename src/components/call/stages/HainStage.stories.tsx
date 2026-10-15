import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react';

import { HainStage, type CallParticipant } from './HainStage';
import { pickIconColor } from '../../../utils/pseudonymGenerator';

/**
 * The Hain (4a) — the handoff's primary call arrangement.
 *
 * Placement is `packShapes` from the design prototype, ported verbatim: the
 * shapes are sized to fill the stage, then pushed apart until they abut.
 * Speaking is weight rather than a badge, so the whole field re-settles when
 * the turn passes on.
 *
 * The identity is inherited, not invented. Animal, background and ink come
 * from the account exactly as they do everywhere else in ORISO — the call
 * never derives a colour of its own, or the same person would look different
 * here than in their chat.
 */
const meta: Meta<typeof HainStage> = {
	title: 'Call/Stages/Hain',
	component: HainStage,
	parameters: { layout: 'centered' }
};

export default meta;
type Story = StoryObj<typeof HainStage>;

const person = (
	name: string,
	file: string,
	bg: string,
	speaking = false
): CallParticipant => ({
	name,
	avatar: { file, bg, iconColor: pickIconColor(bg) },
	speaking
});

/** A counselling group, with ORISO's own names. */
const ROOM: CallParticipant[] = [
	person('wacher Igel 118', 'hedgehog.svg', '#FCE7E6'),
	person('ruhiger Fuchs 432', 'fox.svg', '#D6E9CA'),
	person('später Kauz 512', 'owl.svg', '#BBBCDE'),
	person('klarer Schwan 77', 'swan.svg', '#F0DC82'),
	person('naher Otter 303', 'otter.svg', '#1F3134'),
	person('stilles Pferd 907', 'horse.svg', '#6E2A3A'),
	person('weiter Bär 651', 'bear.svg', '#C7D6DE'),
	person('heitere Lerche 24', 'cat.svg', '#E8C4BE'),
	person('warmer Dachs 260', 'alpaca.svg', '#B2D2A8')
];

const room = (n: number, speaking = -1): CallParticipant[] =>
	ROOM.slice(0, n).map((p, i) => ({ ...p, speaking: i === speaking }));

/** Nine people, nobody speaking — the room at rest. */
export const Ruhig: Story = { args: { participants: room(9), box: 660 } };

/** The same nine, one of them talking. Everyone else gives up room. */
export const JemandSpricht: Story = {
	args: { participants: room(9, 2), box: 660 }
};

/** Four — a small group, where each shape is at its largest. */
export const Klein: Story = { args: { participants: room(4, 1), box: 660 } };

/**
 * Two. The arrangement's hardest case, and the one Ticket 01's acceptance
 * list names: the prototype overlaps the pair by about a third of a shape.
 * Left visible on purpose — see `engine/layout.test.ts`.
 */
export const ZuZweit: Story = { args: { participants: room(2, 0), box: 660 } };

/** On a phone, where the square fills the width. */
export const AufDemHandy: Story = {
	args: { participants: room(6, 3), box: 360 },
	parameters: { viewport: { defaultViewport: 'mobile1' } }
};
