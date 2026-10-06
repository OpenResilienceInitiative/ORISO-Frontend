// @vitest-environment jsdom
/** #1595 — a failed preferredLanguage PATCH must not be retried forever. */
import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, waitFor } from '@testing-library/react';
import { LocaleSwitch } from './LocaleSwitch';
import { UserDataContext, LocaleContext } from '../../globalState';

const { patchUserData } = vi.hoisted(() => ({ patchUserData: vi.fn() }));

vi.mock('../../api/apiPatchUserData', () => ({
	apiPatchUserData: patchUserData
}));

// External animation player needs canvas; this test does not render animations.
vi.mock('lottie-react', () => ({ default: () => null }));

vi.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string) => key })
}));

// The dropdown tree pulls in lottie-web, which needs a real canvas. Nothing
// here renders it: the component returns null for a single selectable locale.
vi.mock('../select/SelectDropdown', () => ({
	MENUPLACEMENT_BOTTOM: 'bottom',
	MENUPLACEMENT_RIGHT: 'right'
}));

vi.mock('../select/LanguageSelectDropdown', () => ({
	LanguageSelectDropdown: () => null
}));

// One selectable locale makes the component render null, so the dropdown and
// its MUI tree stay out of the way. The effect under test runs either way.
const renderSwitch = (reloadUserData = vi.fn()) =>
	render(
		<UserDataContext.Provider
			value={
				{
					userData: { preferredLanguage: 'de' },
					reloadUserData
				} as any
			}
		>
			<LocaleContext.Provider
				value={
					{
						locale: 'en',
						setLocale: vi.fn(),
						selectableLocales: ['de']
					} as any
				}
			>
				<LocaleSwitch updateUserData />
			</LocaleContext.Provider>
		</UserDataContext.Provider>
	);

describe('LocaleSwitch preferredLanguage sync', () => {
	afterEach(() => {
		cleanup();
		patchUserData.mockReset();
	});

	it('gives up on a locale whose patch failed instead of re-sending it', async () => {
		patchUserData.mockRejectedValue(new Error('404'));

		renderSwitch();

		await waitFor(() => expect(patchUserData).toHaveBeenCalledTimes(1));
		// userData still carries the old preferredLanguage because the request
		// failed, so a guard that only looks at that value would fire again.
		await new Promise((resolve) => setTimeout(resolve, 250));
		expect(patchUserData).toHaveBeenCalledTimes(1);
	});

	it('reloads user data once when the patch succeeds', async () => {
		patchUserData.mockResolvedValue(undefined);
		const reloadUserData = vi.fn().mockResolvedValue(undefined);

		renderSwitch(reloadUserData);

		await waitFor(() => expect(reloadUserData).toHaveBeenCalledTimes(1));
		expect(patchUserData).toHaveBeenCalledWith({ preferredLanguage: 'en' });
	});
});
