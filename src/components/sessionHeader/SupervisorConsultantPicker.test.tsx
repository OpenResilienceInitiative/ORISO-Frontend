// @vitest-environment jsdom

import * as React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SupervisorConsultantPicker } from './SupervisorConsultantPicker';

afterEach(cleanup);

describe('SupervisorConsultantPicker', () => {
	it('announces that the directory is loading', () => {
		render(
			<SupervisorConsultantPicker
				state="loading"
				consultants={[]}
				selectedConsultantId=""
				onChange={vi.fn()}
				labels={{
					loading: 'Loading consultants',
					error: 'Consultants could not be loaded',
					empty: 'No consultants available',
					select: 'Select consultant'
				}}
			/>
		);

		expect(screen.getByRole('status').textContent).toBe(
			'Loading consultants'
		);
	});

	it('shows a request failure instead of claiming that no consultants are available', () => {
		render(
			<SupervisorConsultantPicker
				state="error"
				consultants={[]}
				selectedConsultantId=""
				onChange={vi.fn()}
				labels={{
					loading: 'Loading consultants',
					error: 'Consultants could not be loaded',
					empty: 'No consultants available',
					select: 'Select consultant'
				}}
			/>
		);

		expect(screen.getByRole('alert').textContent).toBe(
			'Consultants could not be loaded'
		);
		expect(screen.queryByText('No consultants available')).toBeNull();
	});

	it('shows the empty state only after a successful request', () => {
		render(
			<SupervisorConsultantPicker
				state="ready"
				consultants={[]}
				selectedConsultantId=""
				onChange={vi.fn()}
				labels={{
					loading: 'Loading consultants',
					error: 'Consultants could not be loaded',
					empty: 'No consultants available',
					select: 'Select consultant'
				}}
			/>
		);

		expect(screen.getByText('No consultants available')).toBeTruthy();
		expect(screen.queryByRole('alert')).toBeNull();
	});

	it('offers an eligible consultant and reports the selected id', () => {
		const onChange = vi.fn();
		render(
			<SupervisorConsultantPicker
				state="ready"
				consultants={[
					{
						consultantId: 'eligible-id',
						firstName: 'Elli',
						lastName: 'Eligible',
						displayName: '',
						username: 'elli',
						isSupervisor: true
					}
				]}
				selectedConsultantId=""
				onChange={onChange}
				labels={{
					loading: 'Loading consultants',
					error: 'Consultants could not be loaded',
					empty: 'No consultants available',
					select: 'Select consultant'
				}}
			/>
		);

		fireEvent.mouseDown(
			screen.getByRole('combobox', { name: 'Select consultant' })
		);
		fireEvent.click(screen.getByRole('option', { name: 'Elli Eligible' }));

		expect(onChange).toHaveBeenCalledWith('eligible-id');
	});
});
