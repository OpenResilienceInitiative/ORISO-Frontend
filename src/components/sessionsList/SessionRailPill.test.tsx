// @vitest-environment jsdom
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SessionRailPill } from './SessionRailPill';

describe('SessionRailPill accessibility', () => {
	const labels = {
		thread: 'Thread',
		supervision: 'Supervision',
		mail: 'Mail',
		unread: 'Unread'
	};

	it('portals an accessible tooltip and lets the keyboard inspect marks', () => {
		render(
			<SessionRailPill
				name="Case 42"
				avatar={<span />}
				marks={['supervision']}
				markLabels={labels}
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

	it('does not bubble mark navigation into the multi-row list handler', () => {
		let secondRow: HTMLButtonElement | null = null;
		render(
			<>
				<SessionRailPill
					name="First case"
					avatar={<span />}
					marks={['mail', 'supervision']}
					markLabels={labels}
					onKeyDown={(event) => {
						if (event.key === 'ArrowDown') secondRow?.focus();
					}}
				/>
				<SessionRailPill
					name="Second case"
					avatar={<span />}
					marks={['mail']}
					markLabels={labels}
					buttonRef={(element) => {
						secondRow = element;
					}}
				/>
			</>
		);

		const first = screen.getByRole('button', { name: /First case/ });
		first.focus();
		fireEvent.keyDown(first, { key: 'ArrowDown' });

		expect(document.activeElement).toBe(first);
		expect(screen.getByRole('tooltip').textContent).toBe('Mail');
	});
});
