import type { Meta, StoryObj } from '@storybook/react';

import { BreathingTutorialCard } from './BreathingTutorialCard';
import { phone390Globals } from '../message/messageStoryShell';

/**
 * The breathing tutorial — the three Carimat cards an advice seeker sees in the
 * anonymous waiting queue before the guided breathing exercise starts.
 *
 * The multi-bubble precedent the Erstantwort follows: same Carimat identity,
 * same kicker line, same bubble grammar, one card per phase. Reviewing all
 * three phases in the running app means sitting through a live-chat queue,
 * which is why they belong here.
 *
 * Carimat is a **rendering identity, not a Matrix account** (ADR-018 §3) —
 * nothing in these stories corresponds to a room member.
 */
const meta = {
	title: 'Components/Chat/BreathingTutorialCard',
	component: BreathingTutorialCard,
	tags: ['autodocs'],
	parameters: {
		layout: 'padded',
		docs: {
			description: {
				component:
					'Carimat’s breathing tutorial, one story per phase. Shown in the anonymous waiting queue only.'
			}
		}
	},
	args: {
		onCancel: () => undefined,
		onConfirm: () => undefined
	}
} satisfies Meta<typeof BreathingTutorialCard>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Phase 1 — breathe in. */
export const Inhale: Story = { args: { phase: 'inhale' } };

/** Phase 2 — hold. */
export const Hold: Story = { args: { phase: 'hold' } };

/** Phase 3 — breathe out. */
export const Exhale: Story = { args: { phase: 'exhale' } };

/** Phone width, which is where the waiting queue is actually used. */
export const Mobile: Story = {
	args: { phase: 'inhale' },
	globals: phone390Globals
};
