import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { expect, waitFor } from 'storybook/test';
import { UserAvatar } from './UserAvatar';

/**
 * Der gewählte Beratenden-Avatar (#1046/#1047): das Motiv oder die Initialen,
 * immer auf dem Primary-Container-Paar des Trägers — nie auf einem
 * Farb-Hash. Beratende ohne Auswahl behalten ihr bisheriges Tier-Icon.
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

/** Ein gewähltes Motiv, in den Farben des Trägers. */
export const Motiv: Story = {
	args: { avatarKind: 'ICON', avatarId: 'fox' },
	play: async ({ canvasElement }) => {
		// AnimalAvatar und CounsellorAvatar laden ihr SVG asynchron.
		await waitFor(async () => {
			const avatar = canvasElement.querySelector(
				'[data-testid="counsellor-avatar"]'
			);
			await expect(avatar).not.toBeNull();
			await expect(avatar?.getAttribute('data-avatar-kind')).toBe('ICON');
		});
	}
};

/** Initialen — immer auf dem Primary-Container-Paar. */
export const Initialen: Story = {
	args: { avatarKind: 'INITIALS' },
	play: async ({ canvasElement }) => {
		const avatar = canvasElement.querySelector(
			'[data-testid="counsellor-avatar"]'
		) as HTMLElement;
		await expect(avatar.textContent).toBe('LB');
		await expect(avatar.style.background).toContain(
			'--m3-primary-container'
		);
	}
};

/** Ohne Auswahl bleibt alles wie bisher: das generierte Tier-Icon. */
export const OhneAuswahl: Story = {
	play: async ({ canvasElement }) => {
		await expect(
			canvasElement.querySelector('[data-testid="counsellor-avatar"]')
		).toBeNull();
	}
};

/** Die Größen der App: Nachricht, Listenzeile, Kopfzeile, Profil. */
export const Groessen: Story = {
	args: { avatarKind: 'ICON', avatarId: 'owl' },
	render: (args) => (
		<div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
			{['24px', '32px', '40px', '48px', '56px'].map((size) => (
				<UserAvatar key={size} {...args} size={size} />
			))}
		</div>
	)
};
