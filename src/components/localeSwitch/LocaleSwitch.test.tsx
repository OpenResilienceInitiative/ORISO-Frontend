// @vitest-environment jsdom
/** #1595 — a failed preferredLanguage PATCH must not be retried forever. */
import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	act,
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor
} from '@testing-library/react';
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
	LanguageSelectDropdown: ({ handleDropdownSelect }) => (
		<div>
			{['de', 'fr'].map((value) => (
				<button
					key={value}
					onClick={() => handleDropdownSelect({ value })}
				>
					{value}
				</button>
			))}
		</div>
	)
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
		expect(patchUserData).toHaveBeenCalledWith(
			{ preferredLanguage: 'en' },
			expect.objectContaining({ id: expect.any(String) })
		);
	});
});

const LocaleHarness = ({
	initialLocale = 'en',
	preferredLanguage = 'en',
	revision = 0
}) => {
	const [locale, setLocale] = React.useState(initialLocale);
	return (
		<UserDataContext.Provider
			value={
				{
					userData: { preferredLanguage },
					reloadUserData: vi.fn().mockResolvedValue(undefined),
					revision
				} as any
			}
		>
			<LocaleContext.Provider
				value={
					{
						locale,
						setLocale,
						selectableLocales: ['en', 'de', 'fr']
					} as any
				}
			>
				<LocaleSwitch updateUserData />
			</LocaleContext.Provider>
		</UserDataContext.Provider>
	);
};

describe('LocaleSwitch account action ownership', () => {
	afterEach(() => {
		cleanup();
		patchUserData.mockReset();
	});

	it('keeps one initial-sync intent through pending rerenders and an unknown reply without a loop', async () => {
		let rejectReply: (error: Error) => void;
		patchUserData.mockImplementation(
			() =>
				new Promise((_, reject) => {
					rejectReply = reject;
				})
		);
		const view = render(<LocaleHarness initialLocale="de" revision={0} />);
		await waitFor(() => expect(patchUserData).toHaveBeenCalledTimes(1));
		const initial = patchUserData.mock.calls[0];
		expect(initial[1].id).toEqual(expect.any(String));
		view.rerender(<LocaleHarness initialLocale="de" revision={1} />);
		expect(patchUserData).toHaveBeenCalledTimes(1);
		await act(async () => {
			rejectReply(new TypeError('reply lost'));
		});
		view.rerender(<LocaleHarness initialLocale="de" revision={2} />);
		await act(async () => {
			await Promise.resolve();
		});
		expect(patchUserData).toHaveBeenCalledTimes(1);
		expect(patchUserData.mock.calls[0]).toEqual(initial);
	});

	it('allocates fresh intents for actual de to fr to de selections after unknown replies', async () => {
		patchUserData.mockRejectedValue(new TypeError('reply lost'));
		render(<LocaleHarness />);
		for (const [index, locale] of ['de', 'fr', 'de'].entries()) {
			await act(async () => {
				fireEvent.click(screen.getByRole('button', { name: locale }));
			});
			await waitFor(() =>
				expect(patchUserData).toHaveBeenCalledTimes(index + 1)
			);
		}
		expect(patchUserData.mock.calls.map(([body]) => body)).toEqual([
			{ preferredLanguage: 'de' },
			{ preferredLanguage: 'fr' },
			{ preferredLanguage: 'de' }
		]);
		const ids = patchUserData.mock.calls.map(([, intent]) => intent.id);
		expect(new Set(ids).size).toBe(3);
	});
});
