import type { Meta, StoryObj } from '@storybook/react';

import { FelderStage } from './FelderStage';
import { type CallParticipant } from './HainStage';
import { pickIconColor } from '../../../utils/pseudonymGenerator';

/**
 * Felder (4b) — the rectilinear counterpart to the Hain.
 *
 * Up to eight people the surface subdivides recursively and whoever is
 * speaking keeps the larger share of every cut their branch is on, so the
 * picture re-balances itself when the turn passes. Full-bleed: no
 * letterboxing and no fixed 16:9 — that frame is imposed only when somebody
 * actually shares a screen.
 *
 * Beyond eight it stops subdividing, switches to a fixed tile and scrolls,
 * with speakers moved to the top. The re-sort is stable for everybody else:
 * a comparator that reshuffles the quiet participants whenever somebody
 * clears their throat makes a room of twenty unreadable.
 */
const meta: Meta<typeof FelderStage> = {
	title: 'Call/Stages/Felder',
	component: FelderStage,
	parameters: { layout: 'centered' }
};

export default meta;
type Story = StoryObj<typeof FelderStage>;

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

const ROOM: CallParticipant[] = [
	person('wacher Igel 118', 'hedgehog.svg', '#FCE7E6'),
	person('ruhiger Fuchs 432', 'fox.svg', '#D6E9CA'),
	person('später Kauz 512', 'owl.svg', '#BBBCDE'),
	person('klarer Schwan 77', 'swan.svg', '#F0DC82'),
	person('naher Otter 303', 'otter.svg', '#1F3134'),
	person('stilles Pferd 907', 'horse.svg', '#6E2A3A'),
	person('weiter Bär 651', 'bear.svg', '#C7D6DE'),
	person('heitere Lerche 24', 'cat.svg', '#E8C4BE'),
	person('warmer Dachs 260', 'alpaca.svg', '#B2D2A8'),
	person('leiser Reiher 845', 'turtle.svg', '#F0DC82'),
	person('offener Hase 391', 'rabbit.svg', '#BBBCDE'),
	person('fester Steinbock 706', 'koala.svg', '#FCE7E6'),
	person('milde Amsel 158', 'penguin.svg', '#D6E9CA'),
	person('heller Marder 523', 'squirrel.svg', '#E8C4BE'),
	person('wacher Luchs 974', 'panda.svg', '#C7D6DE'),
	person('leise Robbe 441', 'dolphin.svg', '#1F3134'),
	person('feiner Frosch 219', 'frog.svg', '#B2D2A8'),
	person('klarer Falter 860', 'butterfly.svg', '#6E2A3A'),
	person('weiche Motte 573', 'firefly.svg', '#F0DC82'),
	person('ruhiger Kolibri 92', 'hummingbird.svg', '#D6E9CA')
];

const room = (n: number, speaking: number[] = []): CallParticipant[] =>
	ROOM.slice(0, n).map((p, i) => ({ ...p, speaking: speaking.includes(i) }));

const SIZE = { width: 900, height: 560 };

/** Two — the most common counselling call. */
export const ZuZweit: Story = {
	args: { participants: room(2, [0]), ...SIZE }
};

/** Four, nobody speaking. An even cut. */
export const VierRuhig: Story = { args: { participants: room(4), ...SIZE } };

/** Four, one speaking — their branch keeps the larger share of every cut. */
export const VierMitSprecher: Story = {
	args: { participants: room(4, [2]), ...SIZE }
};

/** Six. */
export const Sechs: Story = { args: { participants: room(6, [1]), ...SIZE } };

/** Eight — the last headcount that still subdivides. */
export const Acht: Story = { args: { participants: room(8, [5]), ...SIZE } };

/** Nine — one past the line, so it becomes a scrolling strip. */
export const NeunScrollt: Story = {
	args: { participants: room(9, [7]), ...SIZE }
};

/** Twenty, with two people talking. Both move to the top; nobody else moves. */
export const ZwanzigMitZweiSprechern: Story = {
	args: { participants: room(20, [11, 4]), ...SIZE }
};

/** On the living surface. */
export const MitAtmosphaere: Story = {
	args: { participants: room(4, [1]), ...SIZE, atmosphere: 'lichtung' }
};

/** On a phone. */
export const AufDemHandy: Story = {
	args: { participants: room(4, [0]), width: 360, height: 620 }
};
