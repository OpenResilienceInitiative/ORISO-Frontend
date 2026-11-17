import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { WorkingHoursDialog } from '../calendar/WorkingHoursDialog';
import { MoveForm } from '../calendar/calendarMenus';
import {
	COLLEAGUE_ENTRIES,
	ME,
	OWN_ENTRIES,
	STORY_WORKING_HOURS
} from '../calendar/calendarStoryData';
import '../calendar/calendar.styles.scss';
import { GroupChatRoleManager } from '../groupChat/GroupChatRoleManager';
import BreathingCompanion from '../pseudonym/breathingCompanion/BreathingCompanion';

/**
 * Screens whose form controls moved from raw HTML (`<select>`, `<textarea>`,
 * `<input type="checkbox|radio">`) to the form kit. The ESLint guard in
 * `package.json` keeps raw controls out of product code; these stories give
 * the before/after screenshots a stable place to render.
 */
const meta = {
	title: 'Components/Form/Kit adoption',
	parameters: { layout: 'padded' }
} satisfies Meta;

export default meta;
type Story = StoryObj;

export const WorkingHoursPause: Story = {
	name: 'Working hours — pause checkbox per day',
	parameters: { layout: 'fullscreen' },
	render: () => (
		<WorkingHoursDialog
			open
			hours={STORY_WORKING_HOURS}
			holidayRegion={null}
			now={new Date(2026, 10, 16, 9, 50)}
			onSave={fn()}
			onClose={fn()}
		/>
	)
};

export const MoveProposalReason: Story = {
	name: 'Move proposal — reason field',
	render: () => (
		<div style={{ maxWidth: 360 }}>
			<MoveForm
				entry={COLLEAGUE_ENTRIES[0]}
				mode="propose"
				entries={OWN_ENTRIES}
				ownerId={ME}
				approverName="Kaya Demir"
				onSubmit={fn()}
				onBack={fn()}
			/>
		</div>
	)
};

export const GroupChatRoles: Story = {
	name: 'Group chat — role per participant',
	render: () => (
		<div style={{ maxWidth: 560 }}>
			<GroupChatRoleManager
				seriesId={42}
				currentUserId="owner"
				participants={[
					{
						consultantId: 'owner',
						displayName: 'Alice Berger',
						role: 'OWNER'
					},
					{
						consultantId: 'co',
						displayName: 'Bob Krämer',
						role: 'CO_MODERATOR'
					},
					{
						consultantId: 'p1',
						displayName: 'Charlie Nguyen',
						role: 'PARTICIPANT'
					}
				]}
			/>
		</div>
	)
};

export const BreathingOptions: Story = {
	name: 'Breathing companion — sound options',
	parameters: { layout: 'fullscreen' },
	render: () => (
		<div style={{ height: '100vh' }}>
			<BreathingCompanion onClose={fn()} reducedMotion />
		</div>
	),
	play: async ({ canvasElement }) => {
		const toggle = canvasElement.querySelector<HTMLButtonElement>(
			'button[aria-controls][aria-expanded="false"]'
		);
		toggle?.click();
	}
};
