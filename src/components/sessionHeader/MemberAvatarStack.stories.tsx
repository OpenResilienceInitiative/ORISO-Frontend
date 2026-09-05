import * as React from 'react';
import { useRef } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { MemberAvatarStack, StackMember } from './MemberAvatarStack';
import { ChatroomMainInteractionIcon } from './ChatroomMainInteractionIcon';
import './sessionHeader.styles.scss';

/**
 * #1193 Job 2: overlapping participant avatars with a "+N" chip for the tail.
 * Rendered inside the real header title-row markup so the stack, the type pill
 * and the CSS overlap match the app. Ordering (Job 1) is the caller's job.
 */
const meta: Meta<typeof MemberAvatarStack> = {
	title: 'Components/Session/MemberAvatarStack',
	component: MemberAvatarStack,
	tags: ['autodocs']
};
export default meta;
type Story = StoryObj<typeof MemberAvatarStack>;

const members = (count: number): StackMember[] =>
	Array.from({ length: count }, (_, i) => ({
		userId: `@participant-${i}:oriso.example`,
		username: `participant-${i}`,
		displayName: `Participant ${i + 1}`
	}));

const countLabel = (hidden: number) => `+${hidden} Personen`;

/** Header title row with a fixed width so the stack has a known budget. */
const TitleRow = ({ width, count }: { width: number; count: number }) => {
	const rowRef = useRef<HTMLDivElement>(null);
	return (
		<div className="sessionInfo" style={{ padding: 12 }}>
			<div
				className="sessionInfo__titleRow"
				ref={rowRef}
				style={{ width, border: '1px dashed #c4c7c8', padding: 4 }}
			>
				<div className="sessionInfo__memberStack">
					<ChatroomMainInteractionIcon type="internal" showAddIcon />
					<MemberAvatarStack
						members={members(count)}
						measureRef={rowRef}
						reservedWidth={76 + 12 * 2 + 140}
						countLabel={countLabel}
					/>
				</div>
				<h3 style={{ margin: 0 }}>Gruppenchat</h3>
			</div>
		</div>
	);
};

/** ≤4 participants: every avatar is shown, no chip. */
export const ThreeMembers: Story = {
	render: () => <TitleRow width={720} count={3} />
};

/** 27 participants (the report example): four avatars + "+23". */
export const TwentySevenMembers: Story = {
	render: () => <TitleRow width={720} count={27} />
};

/** Narrow header: only two avatars fit, the rest collapse into "+25". */
export const NarrowTwoFit: Story = {
	render: () => <TitleRow width={355} count={27} />
};

/** No room for avatars at all: the chip alone carries the full count. */
export const ChipOnly: Story = {
	render: () => <TitleRow width={310} count={27} />
};
