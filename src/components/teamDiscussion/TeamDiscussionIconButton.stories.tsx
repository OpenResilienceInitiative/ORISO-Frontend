/**
 * The team-discussion marker on an enquiry list row: one clickable icon
 * instead of the former "Team discussion" text chip.
 */
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import * as React from 'react';
import {
	TeamDiscussionBadge,
	TeamDiscussionIconButton
} from './TeamDiscussionBadge';
import { primeTeamDiscussionCache } from '../../services/teamDiscussionCache';
import type { TeamDiscussionStatus } from '../../api/apiTeamDiscussion';

const meta: Meta<typeof TeamDiscussionIconButton> = {
	title: 'Team discussion/Icon button',
	component: TeamDiscussionIconButton,
	args: { onOpen: fn() }
};
export default meta;

type Story = StoryObj<typeof TeamDiscussionIconButton>;

export const Default: Story = {
	play: async ({ canvasElement, args }) => {
		const button = within(canvasElement).getByRole('button', {
			name: /team/i
		});
		await userEvent.click(button);
		await expect(args.onOpen).toHaveBeenCalledTimes(1);
	}
};

export const Disabled: Story = {
	args: { onOpen: undefined }
};

/**
 * FE#2491: the same marker as a chip in the case header while the team chat
 * of the enquiry is on — the word written out, like supervision's people.
 */
export const HeaderChip: Story = {
	args: { showLabel: true, active: false },
	play: async ({ canvasElement, args }) => {
		const chip = within(canvasElement).getByRole('button', {
			name: /team/i
		});
		await expect(chip).toHaveAttribute('aria-pressed', 'false');
		await userEvent.click(chip);
		await expect(args.onOpen).toHaveBeenCalledTimes(1);
	}
};

/** The team chat panel is on screen: outlined, not colour alone. */
export const HeaderChipActive: Story = {
	args: { showLabel: true, active: true },
	play: async ({ canvasElement }) => {
		await expect(
			within(canvasElement).getByRole('button', { name: /team/i })
		).toHaveAttribute('aria-pressed', 'true');
	}
};

const ROW_CASES: { id: number; label: string; status: TeamDiscussionStatus }[] =
	[
		{ id: 92001, label: 'Team-Chat an (OPEN)', status: 'OPEN' },
		{ id: 92002, label: 'Team-Chat aus (CLOSED)', status: 'CLOSED' },
		{
			id: 92003,
			label: 'Angenommen, archiviert (ARCHIVED)',
			status: 'ARCHIVED'
		}
	];

/**
 * FE#2494 (Frank, 24 Nov): the list row marks the team chat with one 32 px
 * round icon — only while it is on. A click opens the team side panel.
 * Switched off or archived after accept: no icon.
 */
export const RowOnlyWhileOpen: Story = {
	name: 'Listenzeile — Team-Icon nur bei aktivem Team-Chat (#2494)',
	render: (args) => {
		ROW_CASES.forEach(({ id, status }) =>
			primeTeamDiscussionCache(id, {
				matrixRoomId: `!team-${id}:example.org`,
				status,
				archiveDate: null,
				closedDate: null
			} as never)
		);
		return (
			<div style={{ display: 'grid', gap: 12, padding: 16 }}>
				{ROW_CASES.map(({ id, label }) => (
					<div
						key={id}
						data-case={id}
						style={{
							display: 'flex',
							alignItems: 'center',
							justifyContent: 'space-between',
							width: 320,
							minHeight: 48,
							padding: '8px 16px',
							borderRadius: 16,
							background:
								'var(--m3-surface-container-lowest, #fff)'
						}}
					>
						<span>{label}</span>
						<TeamDiscussionBadge
							sessionId={id}
							onOpen={args.onOpen}
						/>
					</div>
				))}
			</div>
		);
	},
	play: async ({ canvasElement, args }) => {
		const row = (id: number) =>
			canvasElement.querySelector<HTMLElement>(`[data-case="${id}"]`)!;
		const open = await within(row(92001)).findByRole('button', {
			name: /team/i
		});
		await expect(open.getBoundingClientRect().width).toBe(32);
		await userEvent.click(open);
		await expect(args.onOpen).toHaveBeenCalledTimes(1);
		await expect(within(row(92002)).queryByRole('button')).toBeNull();
		await expect(within(row(92003)).queryByRole('button')).toBeNull();
	}
};
