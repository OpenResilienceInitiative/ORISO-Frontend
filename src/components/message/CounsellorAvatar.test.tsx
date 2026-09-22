// @vitest-environment jsdom
import React from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { UserAvatar } from './UserAvatar';

vi.mock('../../utils/pseudonymGenerator', async (importOriginal) => {
	const actual =
		await importOriginal<typeof import('../../utils/pseudonymGenerator')>();
	return {
		...actual,
		renderAvatarSvg: vi.fn(() => Promise.resolve('<svg></svg>')),
		loadCounsellorMotifSvg: vi.fn((file: string) =>
			file === 'fox.svg'
				? Promise.resolve('<svg data-testid="motif"></svg>')
				: Promise.reject(new Error('missing'))
		)
	};
});

describe('counsellor avatar (#1047)', () => {
	afterEach(cleanup);

	it('renders the chosen motif instead of the hashed animal', async () => {
		render(
			<UserAvatar
				username="lena"
				displayName="Lena Beispiel"
				userId="@lena:oriso.example"
				avatarKind="ICON"
				avatarId="fox"
			/>
		);

		const avatar = await screen.findByTestId('counsellor-avatar');
		await waitFor(() =>
			expect(avatar.getAttribute('data-avatar-kind')).toBe('ICON')
		);
		expect(avatar.querySelector('svg')).not.toBeNull();
	});

	it('renders the initials on the tenant primary-container pair', () => {
		render(
			<UserAvatar
				username="lena"
				displayName="Lena Beispiel"
				userId="@lena:oriso.example"
				avatarKind="INITIALS"
			/>
		);

		const avatar = screen.getByTestId('counsellor-avatar');
		expect(avatar.textContent).toBe('LB');
		// CI-conform by construction: never a hashed colour.
		expect(avatar.style.background).toContain('--m3-primary-container');
		expect(avatar.style.color).toContain('--m3-on-primary-container');
	});

	it('reads the initials from the avatar name when the label is something else', () => {
		render(
			<UserAvatar
				username="lena"
				// The session list labels this avatar with the topic.
				displayName="Schuldnerberatung"
				avatarDisplayName="Lena Beispiel"
				userId="@lena:oriso.example"
				avatarKind="INITIALS"
			/>
		);

		expect(screen.getByTestId('counsellor-avatar').textContent).toBe('LB');
	});

	it('falls back to the initials when the chosen motif cannot be loaded', async () => {
		render(
			<UserAvatar
				username="lena"
				displayName="Lena Beispiel"
				userId="@lena:oriso.example"
				avatarKind="ICON"
				avatarId="unicorn"
			/>
		);

		const avatar = screen.getByTestId('counsellor-avatar');
		await waitFor(() => expect(avatar.textContent).toBe('LB'));
	});

	it('leaves a consultant without a choice on the animal icon — no regression', () => {
		render(
			<UserAvatar
				username="lena"
				displayName="Lena Beispiel"
				userId="@lena:oriso.example"
			/>
		);

		expect(screen.queryByTestId('counsellor-avatar')).toBeNull();
		expect(screen.getByTestId('user-avatar')).not.toBeNull();
	});

	it('keeps PICTURE on the previous rendering until its upload ships', () => {
		render(
			<UserAvatar
				username="lena"
				displayName="Lena Beispiel"
				userId="@lena:oriso.example"
				avatarKind="PICTURE"
				avatarId="picture-1"
			/>
		);

		expect(screen.queryByTestId('counsellor-avatar')).toBeNull();
	});
});
