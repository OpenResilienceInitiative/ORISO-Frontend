// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MarkAllReadButton } from './MarkAllReadButton';

vi.mock('@mui/icons-material/DoneAll', () => ({
	default: () => <svg data-testid="done-all-icon" />
}));

describe('MarkAllReadButton (#1200)', () => {
	afterEach(cleanup);

	it('calls onClick when there is unread activity', () => {
		const onClick = vi.fn();
		render(
			<MarkAllReadButton
				hasUnread
				onClick={onClick}
				label="Mark all as read"
			/>
		);
		const button = screen.getByRole('button', { name: 'Mark all as read' });
		expect((button as HTMLButtonElement).disabled).toBe(false);
		fireEvent.click(button);
		expect(onClick).toHaveBeenCalledTimes(1);
	});

	it('is disabled and inert when everything is already read', () => {
		const onClick = vi.fn();
		render(
			<MarkAllReadButton
				hasUnread={false}
				onClick={onClick}
				label="Mark all as read"
			/>
		);
		const button = screen.getByRole('button', { name: 'Mark all as read' });
		expect((button as HTMLButtonElement).disabled).toBe(true);
		fireEvent.click(button);
		expect(onClick).not.toHaveBeenCalled();
	});

	it('keeps the existing chip styling and tooltip', () => {
		render(
			<MarkAllReadButton
				hasUnread
				onClick={() => {}}
				label="Alle als gelesen"
			/>
		);
		const button = screen.getByRole('button', { name: 'Alle als gelesen' });
		expect(button.className).toContain(
			'sessionsListToolbar__chip--iconOnly'
		);
		expect(button.getAttribute('title')).toBe('Alle als gelesen');
		expect(screen.getByTestId('done-all-icon')).toBeTruthy();
	});
});
