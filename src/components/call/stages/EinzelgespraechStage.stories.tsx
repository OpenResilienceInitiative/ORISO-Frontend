import type { Meta, StoryObj } from '@storybook/react';

import { EinzelgespraechStage } from './EinzelgespraechStage';
import { type CallParticipant } from './HainStage';
import { pickIconColor } from '../../../utils/pseudonymGenerator';

/**
 * Einzelgespräch (2b) — by far the most common ORISO call.
 *
 * One circle divided into two halves along a soft seam. The speaking half
 * grows past half and the seam bows into the quiet side, so the change reads
 * as one body pressing against another rather than a bar filling up.
 *
 * **Silence is an even split.** Not a nudge toward the counsellor, not toward
 * whoever is local. In a counselling call an unearned advantage to either
 * side is a statement, and silence is not one. Both names stay visible
 * throughout: the quiet person has not left the conversation.
 */
const meta: Meta<typeof EinzelgespraechStage> = {
	title: 'Call/Stages/Einzelgespräch',
	component: EinzelgespraechStage,
	parameters: { layout: 'centered' }
};

export default meta;
type Story = StoryObj<typeof EinzelgespraechStage>;

const seeker = (speaking = false): CallParticipant => ({
	name: 'wacher Igel 118',
	avatar: {
		file: 'hedgehog.svg',
		bg: '#FCE7E6',
		iconColor: pickIconColor('#FCE7E6')
	},
	speaking
});

const counsellor = (speaking = false): CallParticipant => ({
	name: 'Susanne P.',
	avatar: {
		file: 'owl.svg',
		bg: '#BBBCDE',
		iconColor: pickIconColor('#BBBCDE')
	},
	speaking
});

/** Nobody speaking — an even split, neither half favoured. */
export const Stille: Story = {
	args: { participants: [seeker(), counsellor()], size: 560 }
};

/** The advice seeker has the floor. */
export const RatsuchendeSpricht: Story = {
	args: { participants: [seeker(true), counsellor()], size: 560 }
};

/** The counsellor has the floor — the mirror image, exactly. */
export const BeraterinSpricht: Story = {
	args: { participants: [seeker(), counsellor(true)], size: 560 }
};

/** Both at once. Not a reason to award the circle to either. */
export const BeideGleichzeitig: Story = {
	args: { participants: [seeker(true), counsellor(true)], size: 560 }
};

/** With the hand raised and a muted microphone. */
export const MitStatus: Story = {
	args: {
		participants: [
			{ ...seeker(), handRaisedForMs: 95000 },
			{ ...counsellor(true), micOff: false }
		],
		size: 560
	}
};

/** On the living surface. */
export const MitAtmosphaere: Story = {
	args: {
		participants: [seeker(true), counsellor()],
		size: 560,
		atmosphere: 'teich'
	}
};

/** At 360px, the narrow phone the ticket names. */
export const AufDemHandy: Story = {
	args: { participants: [seeker(), counsellor(true)], size: 330 }
};
