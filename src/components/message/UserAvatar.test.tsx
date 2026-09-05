// @vitest-environment jsdom
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { UserAvatar } from './UserAvatar';

vi.mock('../../utils/pseudonymGenerator', async (importOriginal) => {
	const actual =
		await importOriginal<typeof import('../../utils/pseudonymGenerator')>();
	return {
		...actual,
		renderAvatarSvg: vi.fn(() => Promise.resolve('<svg></svg>'))
	};
});

const animalBackground = (wrapper: HTMLElement) =>
	(wrapper.firstElementChild as HTMLElement | null)?.style.background ?? '';

describe('UserAvatar (#1193 Job 4: animal icon, no monogram)', () => {
	afterEach(cleanup);

	it('renders the animal avatar and no letter monogram', () => {
		render(
			<UserAvatar
				username="lisa-simpson"
				displayName="Lisa Simpson"
				userId="@lisa:oriso.example"
			/>
		);
		const avatar = screen.getByRole('img', { name: 'Lisa Simpson' });
		// AnimalAvatar paints the generated background colour on its outer circle.
		expect(animalBackground(avatar)).toMatch(/^rgb\(|^#/);
		// The monogram path used to render "LS" / "L" as text.
		expect(avatar.textContent?.trim()).toBe('');
	});

	it('derives the same animal for the same user id everywhere', () => {
		const { unmount } = render(
			<UserAvatar username="a" displayName="A" userId="@same:x" />
		);
		const first = animalBackground(screen.getByTestId('user-avatar'));
		unmount();
		render(
			<UserAvatar
				username="different-name"
				displayName="Different Name"
				userId="@same:x"
				size="56px"
			/>
		);
		expect(animalBackground(screen.getByTestId('user-avatar'))).toBe(first);
	});

	it('keeps the requested footprint with and without the ring', () => {
		const { rerender } = render(
			<UserAvatar username="u" userId="@u:x" size="32px" />
		);
		expect(screen.getByTestId('user-avatar').style.width).toBe('32px');
		rerender(
			<UserAvatar username="u" userId="@u:x" size="32px" ring={false} />
		);
		expect(screen.getByTestId('user-avatar').style.width).toBe('32px');
		expect(screen.getByTestId('user-avatar').style.background).toBe(
			'transparent'
		);
	});

	it('falls back to the username when there is no user id', () => {
		render(<UserAvatar username="fallback-user" userId="" />);
		expect(animalBackground(screen.getByTestId('user-avatar'))).toMatch(
			/^rgb\(|^#/
		);
	});

	it('does not expose a technical username as the accessible name', () => {
		render(<UserAvatar username="" userId="@anon-123:x" />);
		const avatar = screen.getByTestId('user-avatar');
		expect(avatar.getAttribute('aria-label')).toBeNull();
		expect(avatar.getAttribute('aria-hidden')).toBe('true');
	});
});
