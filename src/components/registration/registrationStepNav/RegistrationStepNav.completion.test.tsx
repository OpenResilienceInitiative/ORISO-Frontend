// @vitest-environment jsdom
import * as React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RegistrationStepNav } from './RegistrationStepNav';

afterEach(cleanup);

describe('RegistrationStepNav completion layout and navigation', () => {
	it.each([
		{ nextStepUrl: null, label: 'Registrieren', direction: 'row' },
		{ nextStepUrl: '/account', label: 'Weiter', direction: 'row' }
	])(
		'keeps $label usable with back navigation in its $direction layout',
		({ nextStepUrl, label, direction }) => {
			const onSubmit = vi.fn();
			const onPrevClick = vi.fn();
			const { container } = render(
				<MemoryRouter>
					<form
						onSubmit={(event) => {
							event.preventDefault();
							onSubmit();
						}}
					>
						<RegistrationStepNav
							prevStepUrl="/agency"
							onPrevClick={onPrevClick}
							backLabel="Zurück"
							nextStepUrl={nextStepUrl}
							nextLabel="Weiter"
							registerLabel="Registrieren"
							registeringLabel="Wird registriert"
						/>
					</form>
				</MemoryRouter>
			);
			const nav = container.querySelector(
				'[data-cy="registration-step-nav"]'
			) as HTMLElement;
			expect(window.getComputedStyle(nav).flexDirection).toBe(direction);
			fireEvent.click(screen.getByRole('button', { name: label }));
			expect(onSubmit).toHaveBeenCalledTimes(1);
			fireEvent.click(screen.getByRole('link', { name: 'Zurück' }));
			expect(onPrevClick).toHaveBeenCalledTimes(1);
		}
	);
});
