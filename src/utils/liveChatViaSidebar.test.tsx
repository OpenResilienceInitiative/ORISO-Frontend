// @vitest-environment jsdom
import * as React from 'react';
import { useState } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	resetLiveChatViaSidebarMigrationForTests,
	useLiveChatViaSidebar
} from './liveChatToggle';
import { apiPatchUserData } from '../api/apiPatchUserData';
import { UserDataContext } from '../globalState/context/UserDataContext';
import { UserDataInterface } from '../globalState/interfaces/UserDataInterface';

vi.mock('../api/apiPatchUserData', () => ({
	apiPatchUserData: vi.fn()
}));

// Availability API is imported by the same module; keep it inert here.
vi.mock('../api/apiSetLiveChatAvailability', () => ({
	apiGetLiveChatAvailability: vi.fn(() => Promise.resolve(false)),
	apiHeartbeatLiveChatAvailability: vi.fn(() => Promise.resolve(true)),
	apiSetLiveChatAvailability: vi.fn(() => Promise.resolve())
}));

const SIDEBAR_KEY = 'oriso_liveChatViaSidebar';
const LEGACY_SIDEBAR_KEY = 'caritas_liveChatViaSidebar';

const consultant = (
	overrides: Partial<UserDataInterface> = {}
): UserDataInterface =>
	({
		userId: 'consultant-1',
		userName: 'beraterin',
		grantedAuthorities: ['AUTHORIZATION_CONSULTANT_DEFAULT'],
		...overrides
	}) as UserDataInterface;

/** Real state behind the context, like UserDataProvider, minus the GET. */
const renderWithProfile = (initial: UserDataInterface) => {
	let latest: UserDataInterface = initial;
	const ProfileProvider = ({ children }: { children: React.ReactNode }) => {
		const [userData, setUserData] = useState<UserDataInterface>(initial);
		latest = userData;
		return (
			<UserDataContext.Provider
				value={{
					userData,
					setUserData,
					reloadUserData: async () => userData
				}}
			>
				{children}
			</UserDataContext.Provider>
		);
	};
	// Two consumers in one tree: the navigation bar and the profile toggle.
	const view = renderHook(
		() => ({
			nav: useLiveChatViaSidebar(),
			profile: useLiveChatViaSidebar()
		}),
		{ wrapper: ProfileProvider }
	);
	return { ...view, profileData: () => latest };
};

describe('live-chat via-sidebar preference lives in the counsellor profile', () => {
	beforeEach(() => {
		localStorage.clear();
		resetLiveChatViaSidebarMigrationForTests();
		vi.mocked(apiPatchUserData).mockResolvedValue(undefined);
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	it('reads the preference from the profile, not from localStorage', () => {
		const { result } = renderWithProfile(
			consultant({ liveChatViaSidebar: true })
		);

		expect(result.current.nav[0]).toBe(true);
		expect(result.current.profile[0]).toBe(true);
		expect(apiPatchUserData).not.toHaveBeenCalled();
	});

	it('is off when the profile says off and the browser has nothing stored', () => {
		const { result } = renderWithProfile(
			consultant({ liveChatViaSidebar: false })
		);

		expect(result.current.nav[0]).toBe(false);
		expect(apiPatchUserData).not.toHaveBeenCalled();
	});

	it('writes through apiPatchUserData and updates every consumer', async () => {
		const { result, profileData } = renderWithProfile(
			consultant({ liveChatViaSidebar: false })
		);

		await act(async () => result.current.profile[1](true));

		expect(apiPatchUserData).toHaveBeenCalledWith({
			liveChatViaSidebar: true
		});
		expect(result.current.nav[0]).toBe(true);
		expect(profileData().liveChatViaSidebar).toBe(true);
		// The browser is no longer the source of truth.
		expect(localStorage.getItem(SIDEBAR_KEY)).toBeNull();
	});

	it('rolls the optimistic update back when the PATCH fails', async () => {
		vi.mocked(apiPatchUserData).mockRejectedValueOnce(new Error('500'));
		const { result, profileData } = renderWithProfile(
			consultant({ liveChatViaSidebar: false })
		);

		await expect(
			act(async () => result.current.profile[1](true))
		).rejects.toThrow('500');

		expect(result.current.nav[0]).toBe(false);
		expect(profileData().liveChatViaSidebar).toBe(false);
	});

	it('migrates a browser-only "on" into the profile once and drops the local keys', async () => {
		localStorage.setItem(SIDEBAR_KEY, '1');

		const { result, profileData } = renderWithProfile(
			consultant({ liveChatViaSidebar: false })
		);

		// No flicker: the consultant's old choice stays visible while migrating.
		expect(result.current.nav[0]).toBe(true);
		await waitFor(() =>
			expect(profileData().liveChatViaSidebar).toBe(true)
		);
		expect(apiPatchUserData).toHaveBeenCalledTimes(1);
		expect(apiPatchUserData).toHaveBeenCalledWith({
			liveChatViaSidebar: true
		});
		expect(localStorage.getItem(SIDEBAR_KEY)).toBeNull();
		expect(result.current.nav[0]).toBe(true);
	});

	it('migrates the pre-rename legacy key as well', async () => {
		localStorage.setItem(LEGACY_SIDEBAR_KEY, '1');

		const { profileData } = renderWithProfile(
			consultant({ liveChatViaSidebar: false })
		);

		await waitFor(() =>
			expect(profileData().liveChatViaSidebar).toBe(true)
		);
		expect(apiPatchUserData).toHaveBeenCalledTimes(1);
		expect(localStorage.getItem(LEGACY_SIDEBAR_KEY)).toBeNull();
	});

	it('keeps the local value when the migration PATCH fails and retries on the next load', async () => {
		localStorage.setItem(SIDEBAR_KEY, '1');
		vi.mocked(apiPatchUserData).mockRejectedValueOnce(new Error('503'));

		const first = renderWithProfile(
			consultant({ liveChatViaSidebar: false })
		);
		await waitFor(() => expect(apiPatchUserData).toHaveBeenCalledTimes(1));
		await act(async () => Promise.resolve());

		expect(localStorage.getItem(SIDEBAR_KEY)).toBe('1');
		expect(first.result.current.nav[0]).toBe(true);
		first.unmount();

		// Next page load: fresh module state, same stale profile.
		resetLiveChatViaSidebarMigrationForTests();
		const second = renderWithProfile(
			consultant({ liveChatViaSidebar: false })
		);
		await waitFor(() =>
			expect(second.profileData().liveChatViaSidebar).toBe(true)
		);
		expect(apiPatchUserData).toHaveBeenCalledTimes(2);
		expect(localStorage.getItem(SIDEBAR_KEY)).toBeNull();
	});

	it('drops leftover local keys without a PATCH when the profile already says on', async () => {
		localStorage.setItem(SIDEBAR_KEY, '1');

		const { result } = renderWithProfile(
			consultant({ liveChatViaSidebar: true })
		);

		await waitFor(() =>
			expect(localStorage.getItem(SIDEBAR_KEY)).toBeNull()
		);
		expect(result.current.nav[0]).toBe(true);
		expect(apiPatchUserData).not.toHaveBeenCalled();
	});

	it('falls back to the local value when an older backend does not return the field', () => {
		localStorage.setItem(SIDEBAR_KEY, '1');

		const { result } = renderWithProfile(consultant());

		expect(result.current.nav[0]).toBe(true);
		// Nothing to migrate into: the backend cannot store it yet.
		expect(apiPatchUserData).not.toHaveBeenCalled();
		expect(localStorage.getItem(SIDEBAR_KEY)).toBe('1');
	});

	it('keeps working locally on an older backend that rejects the field', async () => {
		vi.mocked(apiPatchUserData).mockRejectedValueOnce(new Error('400'));
		const { result } = renderWithProfile(consultant());

		await act(async () => result.current.profile[1](true));

		expect(result.current.nav[0]).toBe(true);
		expect(localStorage.getItem(SIDEBAR_KEY)).toBe('1');
	});
});
