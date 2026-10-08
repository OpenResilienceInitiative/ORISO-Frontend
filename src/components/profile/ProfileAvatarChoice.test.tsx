// @vitest-environment jsdom

import * as React from 'react';
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import de from '../../resources/i18n/de/common.json';
import { NotificationsContext, UserDataContext } from '../../globalState';
import { apiPatchUserData } from '../../api/apiPatchUserData';
import { ProfileAvatarChoice } from './ProfileAvatarChoice';

// The real German catalogue, so the test reads what the user reads.
const lookup = (key: string): string =>
	(key
		.split('.')
		.reduce<unknown>(
			(node, part) => (node as Record<string, unknown>)?.[part],
			de
		) as string) ?? key;

vi.mock('react-i18next', () => ({
	useTranslation: () => ({ t: lookup })
}));

// The globalState barrel pulls lottie-web (crashes in jsdom).
vi.mock('../../globalState', () => {
	// eslint-disable-next-line @typescript-eslint/no-var-requires
	const react = require('react');
	return {
		UserDataContext: react.createContext(null),
		NotificationsContext: react.createContext({
			addNotification: () => {}
		}),
		NOTIFICATION_TYPE_ERROR: 'error',
		AUTHORITIES: { CONSULTANT_DEFAULT: 'AUTHORIZATION_CONSULTANT_DEFAULT' },
		hasUserAuthority: (authority: string, userData: any) =>
			!!userData?.grantedAuthorities?.includes(authority)
	};
});

vi.mock('../../api', () => ({ apiPutEmail: vi.fn() }));
vi.mock('../../api/apiPatchUserData', () => ({
	apiPatchUserData: vi.fn(() => Promise.resolve())
}));
vi.mock('../../utils/pseudonymGenerator', async (importOriginal) => ({
	...(await importOriginal<
		typeof import('../../utils/pseudonymGenerator')
	>()),
	renderAvatarSvg: vi.fn(() => Promise.resolve('<svg></svg>'))
}));

const COUNSELLOR = ['AUTHORIZATION_CONSULTANT_DEFAULT'];

const renderChoice = (
	userData: Record<string, unknown>,
	{
		reloadUserData = vi.fn(() => Promise.resolve()),
		addNotification = vi.fn()
	}: {
		reloadUserData?: () => Promise<unknown>;
		addNotification?: () => void;
	} = {}
) =>
	render(
		<NotificationsContext.Provider value={{ addNotification } as any}>
			<UserDataContext.Provider
				value={{
					userData: userData as any,
					setUserData: vi.fn(),
					reloadUserData: reloadUserData as any
				}}
			>
				<ProfileAvatarChoice avatarUserId="@me:oriso.example" />
			</UserDataContext.Provider>
		</NotificationsContext.Provider>
	);

const tile = (name: string) => screen.getByRole('radio', { name });

afterEach(() => {
	cleanup();
	vi.clearAllMocks();
});

describe('ProfileAvatarChoice (#878 phase 4, US#1240)', () => {
	it('starts on the default for an advice seeker and saves the animal id', async () => {
		const reloadUserData = vi.fn(() => Promise.resolve());
		renderChoice({ grantedAuthorities: [] }, { reloadUserData });

		expect(
			screen.getByRole('radiogroup', { name: 'Ihr Bild' })
		).toBeTruthy();
		expect(
			screen
				.getByRole('radiogroup', { name: 'Ihr Bild' })
				.classList.contains('avatarPicker--grid')
		).toBe(true);
		expect(tile('Standard').getAttribute('aria-checked')).toBe('true');

		fireEvent.click(tile('magpie'));

		await waitFor(() => expect(reloadUserData).toHaveBeenCalled());
		expect(apiPatchUserData).toHaveBeenCalledWith({ avatarId: 'magpie' });
	});

	it('shows the stored animal, also where the app file is capitalised', () => {
		renderChoice({ grantedAuthorities: [], avatarId: 'nightingale' });

		expect(tile('Nightingale').getAttribute('aria-checked')).toBe('true');
		expect(tile('Standard').getAttribute('aria-checked')).toBe('false');
	});

	it('clears an advice seeker choice with the default tile', async () => {
		renderChoice({ grantedAuthorities: [], avatarId: 'fox' });

		fireEvent.click(tile('Standard'));

		await waitFor(() =>
			expect(apiPatchUserData).toHaveBeenCalledWith({ avatarId: '' })
		);
	});

	it('lets a counsellor pick an Admin motif and go back to the default', async () => {
		renderChoice({
			grantedAuthorities: COUNSELLOR,
			avatarKind: 'ICON',
			avatarId: 'magpie'
		});

		expect(tile('magpie').getAttribute('aria-checked')).toBe('true');
		expect(screen.queryByRole('radio', { name: 'crane' })).toBeNull();

		fireEvent.click(tile('fox'));
		await waitFor(() =>
			expect(apiPatchUserData).toHaveBeenCalledWith({
				avatarKind: 'ICON',
				avatarId: 'fox'
			})
		);

		fireEvent.click(tile('Standard'));
		await waitFor(() =>
			expect(apiPatchUserData).toHaveBeenLastCalledWith({
				avatarId: ''
			})
		);
	});

	it('reports a failed save', async () => {
		vi.mocked(apiPatchUserData).mockRejectedValueOnce(new Error('400'));
		const addNotification = vi.fn();
		renderChoice({ grantedAuthorities: [] }, { addNotification });

		fireEvent.click(tile('fox'));

		await waitFor(() =>
			expect(addNotification).toHaveBeenCalledWith(
				expect.objectContaining({ notificationType: 'error' })
			)
		);
	});
});

it('does not label explicit admin initials as Standard, but selects a pending clear', () => {
	vi.mocked(apiPatchUserData).mockReturnValueOnce(new Promise(() => {}));
	renderChoice({
		userId: 'consultant',
		userName: 'consultant',
		grantedAuthorities: COUNSELLOR,
		avatarKind: 'INITIALS',
		avatarId: null
	});
	expect(
		screen
			.getByRole('radio', { name: 'Standard' })
			.getAttribute('aria-checked')
	).toBe('false');
	expect(screen.getByRole('radio', { name: 'Standard' }).tabIndex).toBe(0);
	expect(
		screen.getAllByRole('radio').filter((radio) => radio.tabIndex === 0)
	).toHaveLength(1);
	const standard = screen.getByRole('radio', { name: 'Standard' });
	standard.focus();
	fireEvent.keyDown(standard, { key: 'ArrowRight' });
	expect(document.activeElement).toBe(screen.getAllByRole('radio')[1]);
	fireEvent.click(standard);
	expect(standard.getAttribute('aria-checked')).toBe('true');
	expect(apiPatchUserData).toHaveBeenLastCalledWith({ avatarId: '' });
});
