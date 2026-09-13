// @vitest-environment jsdom
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SessionRailPill } from './SessionRailPill';

describe('SessionRailPill accessibility', () => {
	it('portals an accessible tooltip and lets the keyboard inspect marks', () => {
		render(
			<SessionRailPill
				name="Case 42"
				avatar={<span />}
				marks={['supervision']}
				markLabels={{
					thread: 'Thread',
					supervision: 'Supervision',
					mail: 'Mail',
					unread: 'Unread'
				}}
			/>
		);
		const pill = screen.getByRole('button', { name: /Case 42/ });

		fireEvent.focus(pill);
		fireEvent.keyDown(pill, { key: 'ArrowDown' });
		const tooltip = screen.getByRole('tooltip');
		expect(tooltip.textContent).toBe('Supervision');
		expect(tooltip.parentElement).toBe(document.body);
		expect(pill.getAttribute('aria-describedby')).toBe(tooltip.id);

		fireEvent.keyDown(pill, { key: 'Escape' });
		expect(screen.queryByRole('tooltip')).toBeNull();
	});
});
