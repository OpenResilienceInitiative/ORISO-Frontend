// @vitest-environment oriso-jsdom
/**
 * #2518 — the dropdown parts must keep their identity across re-renders.
 * When they were declared inside the component, every parent re-render
 * mounted a new value container, so the search field lost focus and text.
 */
import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { MENUPLACEMENT_BOTTOM, SelectDropdown } from './SelectDropdown';
import { LanguageSelectDropdown } from './LanguageSelectDropdown';

vi.mock('lottie-react', () => ({ default: () => null }));

vi.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string) => key })
}));

const options = [
	{ value: 'a', label: 'Alpha' },
	{ value: 'b', label: 'Beta' }
];

const dropdown = (errorMessage: string) => (
	<SelectDropdown
		id="remount-probe"
		selectedOptions={options}
		selectInputLabel="probe.label"
		handleDropdownSelect={() => undefined}
		menuPlacement={MENUPLACEMENT_BOTTOM}
		isSearchable
		hasError
		errorMessage={errorMessage}
	/>
);

const languageDropdown = (errorMessage: string) => (
	<LanguageSelectDropdown
		id="language-remount-probe"
		selectedOptions={options}
		selectInputLabel="probe.label"
		handleDropdownSelect={() => undefined}
		menuPlacement={MENUPLACEMENT_BOTTOM}
		isSearchable
		hasError
		errorMessage={errorMessage}
	/>
);

describe.each([
	['SelectDropdown', dropdown, '#remount-probe input'],
	[
		'LanguageSelectDropdown',
		languageDropdown,
		'#language-remount-probe input'
	]
])('%s keeps the search field across re-renders', (_name, build, selector) => {
	afterEach(() => {
		cleanup();
	});

	it('keeps the same input element, its focus and the typed text', () => {
		const { container, rerender } = render(build('first'));
		const input = container.querySelector<HTMLInputElement>(selector);
		expect(input).not.toBeNull();

		input.focus();
		fireEvent.change(input, { target: { value: 'Al' } });

		rerender(build('second'));

		const after = container.querySelector<HTMLInputElement>(selector);
		expect(after).toBe(input);
		expect(document.activeElement).toBe(input);
		expect(after.value).toBe('Al');
	});
});
