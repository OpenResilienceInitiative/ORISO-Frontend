// @vitest-environment jsdom
import * as React from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { M3Snackbar } from './M3Snackbar';

afterEach(cleanup);

describe('M3Snackbar', () => {
	it('shows the message and, without handlers, nothing else', () => {
		render(<M3Snackbar placement="inline" message="Kurzer Hinweis" />);

		expect(screen.getByText('Kurzer Hinweis')).toBeTruthy();
		expect(screen.queryByRole('button')).toBeNull();
	});

	it('gives the close affordance the name it was handed, and calls back', async () => {
		const onClose = vi.fn();
		render(
			<M3Snackbar
				placement="inline"
				message="Kurzer Hinweis"
				onClose={onClose}
				closeLabel="Schließen"
			/>
		);

		await userEvent.click(
			screen.getByRole('button', { name: 'Schließen' })
		);

		expect(onClose).toHaveBeenCalledTimes(1);
	});

	it('renders at most the one action a snackbar may carry', async () => {
		const onClick = vi.fn();
		render(
			<M3Snackbar
				placement="inline"
				message="Kurzer Hinweis"
				action={{ label: 'Rückgängig', onClick }}
			/>
		);

		const buttons = screen.getAllByRole('button');
		expect(buttons).toHaveLength(1);
		await userEvent.click(buttons[0]);
		expect(onClick).toHaveBeenCalledTimes(1);
	});

	/* The long-action shape moves the action out of MUI's action slot and under
	   the message. Both buttons must survive that move — an earlier draft lost
	   the ✕ to it. */
	it('keeps both the long action and the close affordance', () => {
		render(
			<M3Snackbar
				placement="inline"
				message="Zweizeiliger Hinweis, der umbricht"
				action={{ label: 'Zur Datenschutzerklärung' }}
				actionOnOwnLine
				onClose={() => undefined}
				closeLabel="Schließen"
			/>
		);

		expect(
			screen.getByRole('button', { name: 'Zur Datenschutzerklärung' })
		).toBeTruthy();
		expect(screen.getByRole('button', { name: 'Schließen' })).toBeTruthy();
	});

	it('renders nothing inline when it is closed', () => {
		render(
			<M3Snackbar placement="inline" open={false} message="Unsichtbar" />
		);

		expect(screen.queryByText('Unsichtbar')).toBeNull();
	});

	/* A standing statement is not an event. `role="status"` waits its turn
	   instead of interrupting whatever a screen reader is currently saying. */
	it('can be a polite status rather than an alert', () => {
		render(
			<M3Snackbar
				placement="inline"
				role="status"
				message="Steht einfach da"
			/>
		);

		expect(screen.getByRole('status')).toBeTruthy();
		expect(screen.queryByRole('alert')).toBeNull();
	});

	it('floats over the page by default', () => {
		render(<M3Snackbar message="Schwebt" />);

		expect(
			document.querySelector('.MuiSnackbar-root .MuiAlert-root')
		).not.toBeNull();
	});
	/**
	 * M3 shows one snackbar at a time. A standing notice (the recovery
	 * reminder) and a transient one (the display-filter note in the sessions
	 * list) share the bottom-centre spot on desktop, so the transient one
	 * covered the other's action (#1505 review). The standing one steps aside
	 * while another is open and comes back when it closes.
	 */
	it('lets a standing notice step aside while another snackbar is open', async () => {
		const { rerender } = render(
			<>
				<M3Snackbar
					message="Standing"
					testId="standing"
					yieldToOthers
				/>
				<M3Snackbar message="Transient" testId="transient" open />
			</>
		);

		await waitFor(() =>
			expect(screen.queryByTestId('standing')).toBeNull()
		);
		expect(screen.getByTestId('transient')).toBeTruthy();

		rerender(
			<>
				<M3Snackbar
					message="Standing"
					testId="standing"
					yieldToOthers
				/>
				<M3Snackbar
					message="Transient"
					testId="transient"
					open={false}
				/>
			</>
		);

		expect(await screen.findByTestId('standing')).toBeTruthy();
	});

	it('shows a standing notice when nothing else is open', () => {
		render(
			<M3Snackbar message="Standing" testId="standing" yieldToOthers />
		);

		expect(screen.getByTestId('standing')).toBeTruthy();
	});
});
