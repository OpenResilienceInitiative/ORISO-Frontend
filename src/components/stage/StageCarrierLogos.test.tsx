// @vitest-environment jsdom

import * as React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ALL_CARRIER_IDS, StageCarrierLogos } from './StageCarrierLogos';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string, options?: { name?: string }) =>
			`${key}:${options?.name ?? ''}`
	})
}));

afterEach(cleanup);

describe('StageCarrierLogos', () => {
	it('shows every mark while the tenant setting is absent', () => {
		render(<StageCarrierLogos />);
		expect(screen.getAllByRole('button')).toHaveLength(
			ALL_CARRIER_IDS.length
		);
	});

	it('shows only the marks the tenant allows', () => {
		render(<StageCarrierLogos allowed={['caritas', 'malteser']} />);
		const labels = screen
			.getAllByRole('button')
			.map((button) => button.getAttribute('aria-label'));
		expect(labels).toEqual([
			'app.stage.carrierLogoAlt:Caritas',
			'app.stage.carrierLogoAlt:Malteser'
		]);
	});

	it('renders nothing when the tenant switched every mark off', () => {
		const { container } = render(<StageCarrierLogos allowed={[]} />);
		expect(container.innerHTML).toBe('');
	});

	it('ignores ids it does not know', () => {
		render(<StageCarrierLogos allowed={['caritas', 'not-a-carrier']} />);
		expect(screen.getAllByRole('button')).toHaveLength(1);
	});

	it('highlights on hover and on keyboard focus alike', () => {
		const onHighlight = vi.fn();
		render(
			<StageCarrierLogos
				allowed={['caritas']}
				onHighlight={onHighlight}
			/>
		);
		const button = screen.getByRole('button');

		fireEvent.mouseEnter(button);
		expect(onHighlight).toHaveBeenLastCalledWith('caritas');
		fireEvent.mouseLeave(button);
		expect(onHighlight).toHaveBeenLastCalledWith(null);

		fireEvent.focus(button);
		expect(onHighlight).toHaveBeenLastCalledWith('caritas');
		fireEvent.blur(button);
		expect(onHighlight).toHaveBeenLastCalledWith(null);
	});
});
