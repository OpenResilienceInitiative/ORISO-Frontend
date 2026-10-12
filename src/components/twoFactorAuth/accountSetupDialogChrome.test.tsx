// @vitest-environment jsdom

import * as React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	AccountSetupField,
	AccountSetupProgress
} from './accountSetupDialogChrome';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string) => key })
}));

afterEach(cleanup);

const renderField = (props: Record<string, unknown> = {}) => {
	render(
		<AccountSetupField
			id="probe"
			label="Bisheriges Passwort"
			name="probe"
			onChange={() => undefined}
			value=""
			{...props}
		/>
	);

	return screen.getByLabelText('Bisheriges Passwort');
};

describe('AccountSetupField', () => {
	it('points the input at its hint', () => {
		const input = renderField({ hint: 'Womit Sie sich angemeldet haben.' });

		expect(input.getAttribute('aria-describedby')).toBe('probe-hint');
		expect(document.getElementById('probe-hint').textContent).toBe(
			'Womit Sie sich angemeldet haben.'
		);
		expect(input.getAttribute('aria-invalid')).toBeNull();
	});

	// The hint says what belongs in the field; the message only says whether
	// what is in there works. Losing the hint on error loses the instruction.
	it('keeps the hint beside the error and marks the input invalid', () => {
		const input = renderField({
			errorMessage: 'Bitte wählen Sie ein neues.',
			hint: 'Womit Sie sich angemeldet haben.'
		});

		expect(input.getAttribute('aria-invalid')).toBe('true');
		expect(input.getAttribute('aria-describedby')).toBe(
			'probe-hint probe-error'
		);
		expect(
			screen.getByText('Womit Sie sich angemeldet haben.')
		).not.toBeNull();
		expect(screen.getByRole('alert').textContent).toContain(
			'Bitte wählen Sie ein neues.'
		);
	});

	it('describes the input by its ok message instead', () => {
		const input = renderField({ successMessage: 'Passwort ist sicher.' });

		expect(input.getAttribute('aria-describedby')).toBe('probe-ok');
		expect(input.getAttribute('aria-invalid')).toBeNull();
	});

	it('leaves aria-describedby off when it has nothing to say', () => {
		expect(renderField().getAttribute('aria-describedby')).toBeNull();
	});
});

describe('AccountSetupProgress', () => {
	it('marks the step the user is on and names both', () => {
		render(<AccountSetupProgress active="twoFactor" />);

		const group = screen.getByRole('group', {
			name: 'accountSetup.progress.label'
		});
		const password = screen.getByText(
			'accountSetup.progress.password'
		).parentElement;
		const twoFactor = screen.getByText(
			'accountSetup.progress.twoFactor'
		).parentElement;

		expect(group).not.toBeNull();
		expect(password.className).toContain(
			'twoFactorSetupDialog__progressStep--done'
		);
		expect(twoFactor.className).toContain(
			'twoFactorSetupDialog__progressStep--active'
		);
	});
});
