// @vitest-environment oriso-jsdom
import * as React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vite-plus/test';
import { CalendarPersonAvatar } from './CalendarPersonAvatar';
import { AVATAR_SIZES } from '../pseudonym/avatarSizes';

afterEach(cleanup);

describe('CalendarPersonAvatar (FE#2325)', () => {
	it('shows the shared user avatar when the person’s avatar is known', () => {
		const { container } = render(
			<CalendarPersonAvatar
				className="calEntry__avatar"
				name="mutige_eule"
				size={AVATAR_SIZES.default}
				avatar={{
					userId: '@asker-7:oriso',
					username: 'mutige_eule',
					choice: { kind: 'animal', file: 'magpie.svg' }
				}}
			/>
		);
		const avatar = screen.getByTestId('user-avatar');
		expect(avatar.style.width).toBe('32px');
		expect(container.textContent).not.toContain('MU');
		// The name is read out next to the avatar; the avatar stays silent.
		expect(container.firstElementChild?.getAttribute('aria-hidden')).toBe(
			'true'
		);
	});

	it('falls back to initials in the person’s tone, at the same size', () => {
		const { container } = render(
			<CalendarPersonAvatar
				className="calEntry__avatar"
				name="Susi Bär"
				size={AVATAR_SIZES.default}
			/>
		);
		expect(screen.queryByTestId('user-avatar')).toBeNull();
		const fallback = container.firstElementChild as HTMLElement;
		expect(fallback.textContent).toBe('SB');
		expect(fallback.className).toMatch(/calAvatar--tone-\d/);
		expect(fallback.style.width).toBe('32px');
		expect(fallback.getAttribute('aria-hidden')).toBe('true');
	});
});
