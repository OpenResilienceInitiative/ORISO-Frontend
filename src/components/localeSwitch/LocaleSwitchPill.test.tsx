// @vitest-environment jsdom
/** #1844 — a language picked in the login-screen switcher counts as a choice. */
import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { LocaleSwitchPill } from './LocaleSwitchPill';
import { LocaleContext } from '../../globalState';
import { getChosenLocale } from '../../globalState/provider/LocaleProvider';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string | string[]) => (Array.isArray(key) ? key[0] : key)
	})
}));

describe('LocaleSwitchPill', () => {
	afterEach(() => {
		cleanup();
		window.sessionStorage.clear();
	});

	it('marks the picked language as chosen, even when it is already shown', () => {
		const setLocale = vi.fn();
		render(
			<LocaleContext.Provider
				value={
					{
						locale: 'en',
						setLocale,
						selectableLocales: ['de', 'en']
					} as any
				}
			>
				<LocaleSwitchPill />
			</LocaleContext.Provider>
		);

		fireEvent.click(screen.getByLabelText('app.selectLanguage'));
		fireEvent.click(screen.getAllByRole('option')[1]);

		expect(setLocale).toHaveBeenCalledWith('en');
		expect(getChosenLocale()).toBe('en');
	});
});
