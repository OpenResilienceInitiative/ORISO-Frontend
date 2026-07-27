// @vitest-environment jsdom
/**
 * FE#513 — the "+" add affordance must never render as a dead decorative
 * element: it is either an interactive button or a real disabled button with
 * an honest tooltip/label.
 */
import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ChatroomMainInteractionIcon } from './ChatroomMainInteractionIcon';

describe('ChatroomMainInteractionIcon', () => {
	afterEach(cleanup);

	it('renders an interactive add button when a click handler is provided', () => {
		const onAddClick = vi.fn();
		render(
			<ChatroomMainInteractionIcon
				type="nearby"
				showAddIcon
				addLabel="Supervisor verwalten"
				onAddClick={onAddClick}
			/>
		);
		const button = screen.getByRole('button', {
			name: 'Supervisor verwalten'
		});
		expect(button.hasAttribute('disabled')).toBe(false);
		fireEvent.click(button);
		expect(onAddClick).toHaveBeenCalledTimes(1);
	});

	it('renders a disabled button with an honest tooltip when no handler is provided', () => {
		render(
			<ChatroomMainInteractionIcon
				type="nearby"
				showAddIcon
				addLabel="Supervision wird vom Beratungsteam verwaltet"
			/>
		);
		const button = screen.getByRole('button', {
			name: 'Supervision wird vom Beratungsteam verwaltet'
		});
		expect(button.hasAttribute('disabled')).toBe(true);
		expect(button.getAttribute('title')).toBe(
			'Supervision wird vom Beratungsteam verwaltet'
		);
	});

	it('renders no add affordance at all when showAddIcon is false', () => {
		render(<ChatroomMainInteractionIcon type="nearby" />);
		expect(screen.queryByRole('button')).toBeNull();
	});
});
