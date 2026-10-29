// @vitest-environment jsdom
import * as React from 'react';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RecipientSplitButton } from './RecipientSplitButton';

const renderButton = (
	props: Partial<React.ComponentProps<typeof RecipientSplitButton>> = {}
) =>
	render(
		<RecipientSplitButton
			label="Alle"
			icon={<svg />}
			isOpen={false}
			onToggle={vi.fn()}
			chevronLabel="Open send-to menu"
			{...props}
		/>
	);

afterEach(cleanup);

describe('RecipientSplitButton — shared small atom (#1806)', () => {
	it.each(['all', 'targeted'] as const)(
		'uses neutral shared geometry for %s',
		(variant) => {
			const { container } = renderButton({ variant });
			const classes = (container.firstChild as HTMLElement).classList;
			expect(classes.contains('splitButton--small')).toBe(true);
			expect(
				classes.contains(
					variant === 'all'
						? 'splitButton--outlined'
						: 'splitButton--tonal'
				)
			).toBe(true);
			expect(classes.contains('splitButton--primary')).toBe(false);
		}
	);

	it('uses the shared elevated state while the recipient menu is open', () => {
		const { container, getAllByRole } = renderButton({ isOpen: true });
		expect(
			(container.firstChild as HTMLElement).classList.contains(
				'splitButton--elevated'
			)
		).toBe(true);
		getAllByRole('button').forEach((button) => {
			expect(button.getAttribute('aria-expanded')).toBe('true');
			expect(button.getAttribute('aria-haspopup')).toBe('dialog');
		});
	});

	it('keeps both segments operable and exposes the full label', () => {
		const onToggle = vi.fn();
		const label = 'absichtslose Schildkröte Andrea';
		const { getByRole } = renderButton({ label, onToggle });
		fireEvent.click(getByRole('button', { name: label }));
		fireEvent.click(getByRole('button', { name: 'Open send-to menu' }));
		expect(onToggle).toHaveBeenCalledTimes(2);
	});
	it('keeps both segments disabled when unavailable', () => {
		const onToggle = vi.fn();
		const { getAllByRole } = renderButton({ disabled: true, onToggle });
		getAllByRole('button').forEach((button) => {
			expect((button as HTMLButtonElement).disabled).toBe(true);
			fireEvent.click(button);
		});
		expect(onToggle).not.toHaveBeenCalled();
	});
});
