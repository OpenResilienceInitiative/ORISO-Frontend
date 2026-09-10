import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { expect } from 'storybook/test';
import { UserAvatar } from './UserAvatar';

const meta: Meta<typeof UserAvatar> = {
	title: 'Chat/Atoms/UserAvatar',
	component: UserAvatar,
	tags: ['autodocs'],
	argTypes: {
		username: {
			control: 'text',
			description: 'Username to display in avatar'
		},
		displayName: {
			control: 'text',
			description: 'Display name (optional, falls back to username)'
		},
		userId: {
			control: 'text',
			description: 'Unique user ID for avatar generation'
		},
		size: {
			control: 'select',
			options: [
				'24px',
				'28px',
				'32px',
				'36px',
				'40px',
				'48px',
				'56px',
				'64px',
				'80px'
			],
			description: 'Avatar size — the OUTER footprint, ring included'
		},
		ring: {
			control: 'boolean',
			description:
				'The white ring around the avatar. On by design wherever an avatar sits on a coloured or busy surface; off where the container already draws one.'
		}
	}
};

export default meta;
type Story = StoryObj<typeof UserAvatar>;

/**
 * Default avatar size (32px) - used in chat messages
 */
export const Default: Story = {
	args: {
		username: 'orisouser',
		displayName: 'Oriso User',
		userId: 'orisouser',
		size: '32px'
	}
};

/**
 * Small avatar (24px) - for compact views
 */
export const Small: Story = {
	args: {
		username: 'consultant',
		displayName: 'Consultant',
		userId: 'consultant',
		size: '24px'
	}
};

/**
 * Large avatar (40px) - used in session headers
 */
export const Large: Story = {
	args: {
		username: 'orisouser',
		displayName: 'Oriso User',
		userId: 'orisouser',
		size: '40px'
	}
};

/**
 * Extra large avatar (64px) - for profile views
 */
export const ExtraLarge: Story = {
	args: {
		username: 'admin',
		displayName: 'Admin User',
		userId: 'admin',
		size: '64px'
	}
};

/**
 * Avatar without display name (uses username only)
 */
export const UsernameOnly: Story = {
	args: {
		username: 'testuser',
		userId: 'testuser',
		size: '32px'
	}
};

/**
 * Multiple avatars in a row - typical chat view
 */
export const MultipleAvatars: Story = {
	render: () => (
		<div style={{ display: 'flex', gap: '16px', padding: '20px' }}>
			<UserAvatar username="alice" userId="alice" size="32px" />
			<UserAvatar username="bob" userId="bob" size="32px" />
			<UserAvatar username="consultant" userId="consultant" size="32px" />
			<UserAvatar username="orisouser" userId="orisouser" size="32px" />
		</div>
	)
};

// ---------------------------------------------------------------------------
// Frank, 10.09.2026: "ein paar Versionen … wo wir Größen haben ohne unseren
// wichtigen und bitte nicht löschen weißen dicken Ring."
//
// The ring is NOT removed and its default stays `true` — `UserAvatar` has
// carried a `ring` prop since #1193, it simply had no story, so the ringless
// form was invisible in Storybook and easy to believe absent.
//
// What the ladder makes visible is the ring's PRICE. `ringWidth` is
// `max(3, size / 8)` on each side, so the animal only ever gets ~75 % of the
// footprint: at 36 px the ring eats 8 and the animal is 28. That is why an
// avatar in a tight slot (the 48 px session rail pill) looks smaller than its
// number suggests — and why `ring={false}` is the right call there, where the
// pill's own white surface already separates the avatar from the background.
// ---------------------------------------------------------------------------

const LADDER = [
	'24px',
	'28px',
	'32px',
	'36px',
	'40px',
	'48px',
	'56px',
	'64px',
	'80px'
];

const Row = ({ ring }: { ring: boolean }) => (
	<div
		style={{
			display: 'flex',
			alignItems: 'flex-end',
			gap: 16,
			padding: 20,
			flexWrap: 'wrap'
		}}
	>
		{LADDER.map((size) => (
			<div key={size} style={{ textAlign: 'center' }}>
				<UserAvatar
					username="sonnenblume_47"
					userId="sonnenblume_47"
					size={size}
					ring={ring}
				/>
				<div
					style={{
						marginTop: 6,
						font: '12px/16px var(--font-family-sans-serif, sans-serif)',
						color: 'var(--m3-on-surface-variant, #444748)'
					}}
				>
					{size}
				</div>
			</div>
		))}
	</div>
);

/** The size ladder as it ships today — every avatar inside its white ring. */
export const SizeLadderWithRing: Story = {
	name: 'Größen — mit Ring (Standard)',
	render: () => <Row ring />
};

/** The same ladder with `ring={false}`: the animal fills the whole footprint. */
export const SizeLadderWithoutRing: Story = {
	name: 'Größen — ohne Ring',
	render: () => <Row ring={false} />
};

/**
 * Both ladders above each other, which is the only way to see what the ring
 * costs: same `size` prop, two different animal sizes.
 */
export const RingComparison: Story = {
	name: 'Vergleich — was der Ring kostet',
	render: () => (
		<div style={{ padding: 20 }}>
			<p
				style={{
					margin: '0 0 4px',
					font: '500 14px/20px var(--font-family-sans-serif, sans-serif)',
					color: 'var(--m3-on-surface, #1a1c1e)'
				}}
			>
				mit Ring — das Tier bekommt rund 75 % der Fläche
			</p>
			<Row ring />
			<p
				style={{
					margin: '16px 0 4px',
					font: '500 14px/20px var(--font-family-sans-serif, sans-serif)',
					color: 'var(--m3-on-surface, #1a1c1e)'
				}}
			>
				ohne Ring — das Tier bekommt die ganze Fläche
			</p>
			<Row ring={false} />
		</div>
	),
	play: async ({ canvasElement }) => {
		const avatars = Array.from(
			canvasElement.querySelectorAll<HTMLElement>(
				'[data-testid="user-avatar"]'
			)
		);
		// Two full ladders, nothing dropped.
		await expect(avatars.length).toBe(LADDER.length * 2);
		const withRing = avatars.slice(0, LADDER.length);
		const withoutRing = avatars.slice(LADDER.length);
		for (let i = 0; i < LADDER.length; i += 1) {
			const outer = Math.round(withRing[i].getBoundingClientRect().width);
			// The OUTER footprint is identical either way — that is the
			// component's promise, and it is what keeps fixed-size containers
			// from shifting when the ring is switched off.
			await expect(
				Math.round(withoutRing[i].getBoundingClientRect().width)
			).toBe(outer);
			// The animal inside is strictly larger without the ring.
			const glyph = (host: HTMLElement) =>
				host.querySelector('svg, img')!.getBoundingClientRect().width;
			await expect(glyph(withoutRing[i])).toBeGreaterThan(
				glyph(withRing[i])
			);
		}
	}
};
