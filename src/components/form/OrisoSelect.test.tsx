// @vitest-environment jsdom

import * as React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SelectChangeEvent } from '@mui/material/Select';
import { OrisoMultiSelect } from './OrisoSelect';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string) => key
	})
}));

const languageOptions = [
	{ value: 'de', label: '(DE) German', disabled: true },
	{ value: 'en', label: '(EN) English' },
	{ value: 'fr', label: '(FR) French' },
	{ value: 'es', label: '(ES) Spanish' }
];

const Harness = ({
	searchable = true,
	initialValue = ['de']
}: {
	searchable?: boolean;
	initialValue?: string[];
}) => {
	const [value, setValue] = React.useState(initialValue);

	const handleChange = (event: SelectChangeEvent<string[]>) => {
		const nextValue = event.target.value;
		setValue(
			typeof nextValue === 'string' ? nextValue.split(',') : nextValue
		);
	};

	return (
		<OrisoMultiSelect
			id="spoken-languages-select"
			label="My languages"
			options={languageOptions}
			value={value}
			searchable={searchable}
			onChange={handleChange}
		/>
	);
};

const openMenu = () => {
	fireEvent.mouseDown(screen.getByRole('combobox', { name: 'My languages' }));
};

afterEach(() => {
	cleanup();
});

describe('OrisoMultiSelect searchable', () => {
	it('does not render a search field by default', () => {
		render(<Harness searchable={false} />);
		openMenu();

		expect(
			screen.queryByRole('textbox', { name: 'form.select.search' })
		).toBeNull();
		expect(screen.getByRole('option', { name: /German/ })).toBeTruthy();
		expect(screen.getByRole('option', { name: /French/ })).toBeTruthy();
	});

	it('filters options by label', () => {
		render(<Harness />);
		openMenu();

		fireEvent.change(
			screen.getByRole('textbox', { name: 'form.select.search' }),
			{
				target: { value: 'fr' }
			}
		);

		expect(screen.getByRole('option', { name: /French/ })).toBeTruthy();
		expect(screen.queryByRole('option', { name: /English/ })).toBeNull();
		expect(screen.queryByRole('option', { name: /Spanish/ })).toBeNull();
	});

	it('keeps a disabled selected option after filtering and selecting another', () => {
		const onChange = vi.fn();

		render(
			<OrisoMultiSelect
				id="spoken-languages-select"
				label="My languages"
				options={languageOptions}
				value={['de']}
				searchable
				onChange={onChange}
			/>
		);
		openMenu();

		fireEvent.change(
			screen.getByRole('textbox', { name: 'form.select.search' }),
			{
				target: { value: 'fr' }
			}
		);
		fireEvent.click(screen.getByRole('option', { name: /French/ }));

		const nextValue = onChange.mock.calls[0][0].target.value as string[];
		expect(nextValue).toContain('de');
		expect(nextValue).toContain('fr');
	});
});
