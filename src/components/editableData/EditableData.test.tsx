// @vitest-environment oriso-jsdom
import * as React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { EditableData } from './EditableData';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string) => key })
}));

afterEach(cleanup);

describe('EditableData', () => {
	it('passes a maximum length on to the input', () => {
		render(<EditableData label="Link name" type="text" maxLength={50} />);

		expect(
			screen
				.getByRole('textbox', { name: 'Link name' })
				.getAttribute('maxLength')
		).toBe('50');
	});

	it('sets no maximum length unless one is given', () => {
		render(<EditableData label="Link name" type="text" />);

		expect(
			screen
				.getByRole('textbox', { name: 'Link name' })
				.hasAttribute('maxLength')
		).toBe(false);
	});
});
