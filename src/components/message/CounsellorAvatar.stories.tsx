import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { expect, waitFor } from 'storybook/test';
import { chosenAvatarOf } from '../../utils/avatarChoice';
import { UserAvatar } from './UserAvatar';

/**
 * A chosen counsellor motif or explicit initials uses the tenant primary pair.
 * A cleared choice uses the same derived animal as every recipient view.
 */
const meta: Meta<typeof UserAvatar> = {
	title: 'Chat/Atoms/CounsellorAvatar',
	component: UserAvatar,
	tags: ['autodocs'],
	args: {
		username: 'lena_b',
		displayName: 'Lena Beispiel',
		userId: '@lena:oriso.example',
		size: '56px'
	}
};

export default meta;
type Story = StoryObj<typeof UserAvatar>;

/** A selected motif uses the tenant colours. */
export const Motiv: Story = {
	args: { choice: chosenAvatarOf({ avatarKind: 'ICON', avatarId: 'fox' }) },
	play: async ({ canvasElement }) => {
		// Both avatar renderers load their SVG asynchronously.
		await waitFor(async () => {
			const avatar = canvasElement.querySelector(
				'[data-testid="counsellor-avatar"]'
			);
			await expect(avatar).not.toBeNull();
			await expect(avatar?.getAttribute('data-avatar-kind')).toBe('ICON');
		});
	}
};

/** Explicit initials use the tenant primary pair. */
export const Initialen: Story = {
	args: { choice: chosenAvatarOf({ avatarKind: 'INITIALS' }) },
	play: async ({ canvasElement }) => {
		const avatar = canvasElement.querySelector<HTMLElement>(
			'[data-testid="counsellor-avatar"]'
		);
		await expect(avatar?.textContent).toBe('LB');
		await expect(avatar?.style.background).toContain('--m3-primary');
	}
};

/** No saved choice uses the derived animal. */
export const OhneAuswahl: Story = {
	play: async ({ canvasElement }) => {
		await expect(
			canvasElement.querySelector('[data-testid="counsellor-avatar"]')
		).toBeNull();
	}
};

/** The message, list, header and profile sizes. */
export const Groessen: Story = {
	args: { choice: chosenAvatarOf({ avatarKind: 'ICON', avatarId: 'owl' }) },
	render: (args) => (
		<div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
			{['24px', '32px', '40px', '48px', '56px'].map((size) => (
				<UserAvatar key={size} {...args} size={size} />
			))}
		</div>
	)
};
