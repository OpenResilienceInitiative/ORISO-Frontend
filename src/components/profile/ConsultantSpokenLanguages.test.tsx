// @vitest-environment jsdom

import * as React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { UserDataContext } from '../../globalState';
import { LanguagesContext } from '../../globalState/provider/LanguagesProvider';
import { ConsultantSpokenLanguages } from './ConsultantSpokenLanguages';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string) => {
			const labels: Record<string, string> = {
				'profile.spokenLanguages.title': 'My languages',
				'profile.spokenLanguages.info': 'German cannot be removed.',
				'languages.de': '(DE) German',
				'languages.en': '(EN) English',
				'languages.fr': '(FR) French'
			};

			return labels[key] ?? key;
		}
	})
}));

// The globalState barrel pulls lottie-web (crashes in jsdom).
vi.mock('../../globalState', () => {
	// eslint-disable-next-line @typescript-eslint/no-var-requires
	const react = require('react');

	return {
		UserDataContext: react.createContext(null)
	};
});

vi.mock('../../api', () => ({
	apiPutConsultantData: vi.fn()
}));

vi.mock('../button/Button', () => ({
	Button: () => null,
	BUTTON_TYPES: { LINK: 'LINK' }
}));

const userData = {
	languages: ['de'],
	email: 'consultant@example.test',
	firstName: 'Ada',
	lastName: 'Lovelace'
};

const renderSpokenLanguages = () =>
	render(
		<UserDataContext.Provider
			value={{
				userData: userData as any,
				setUserData: vi.fn(),
				reloadUserData: vi.fn()
			}}
		>
			<LanguagesContext.Provider
				value={{ fixed: ['de'], spoken: ['de', 'en', 'fr'] }}
			>
				<ConsultantSpokenLanguages />
			</LanguagesContext.Provider>
		</UserDataContext.Provider>
	);

afterEach(() => {
	cleanup();
});

describe('ConsultantSpokenLanguages', () => {
	it('keeps German selected after filtering and choosing another language', () => {
		renderSpokenLanguages();

		const combobox = screen.getByRole('combobox', { name: 'My languages' });
		fireEvent.mouseDown(combobox);
		fireEvent.change(screen.getByRole('textbox', { name: 'Search' }), {
			target: { value: 'fr' }
		});
		fireEvent.click(screen.getByRole('option', { name: /French/ }));

		expect(combobox.textContent).toContain('(DE) German');
		expect(combobox.textContent).toContain('(FR) French');
	});

	it('does not remove German when the filtered list still shows it', () => {
		renderSpokenLanguages();

		const combobox = screen.getByRole('combobox', { name: 'My languages' });
		fireEvent.mouseDown(combobox);
		fireEvent.change(screen.getByRole('textbox', { name: 'Search' }), {
			target: { value: 'ger' }
		});
		fireEvent.click(screen.getByRole('option', { name: /German/ }));

		expect(combobox.textContent).toContain('(DE) German');
	});
});
