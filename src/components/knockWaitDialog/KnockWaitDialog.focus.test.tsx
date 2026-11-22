// @vitest-environment oriso-jsdom

import * as React from 'react';
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { KnockWaitDialog, KnockWaitDialogProps } from './KnockWaitDialog';

/*
 * "Nicht mehr warten" removes itself: the knock is withdrawn and the window
 * is back at "Jetzt beitreten". Focus must not drop to the page then, or
 * Escape and Tab do nothing until the dialog's focus trap pulls it back
 * (CallMessageLobby story 4 failed on that race in CI on #2038).
 */

const props = (knocking: boolean): KnockWaitDialogProps => ({
	variant: 'call',
	phase: 'ready',
	knocking,
	onJoin: vi.fn(),
	onCancel: vi.fn(),
	onClose: vi.fn()
});

/* The unit tests run without translations: buttons are named by key. */
const stopWaiting = () =>
	screen.queryByRole('button', { name: 'knockWait.waiting.cancel' });
const joinNow = () =>
	screen.getByRole('button', { name: 'knockWait.ready.join' });

afterEach(cleanup);

describe('KnockWaitDialog: the wait withdrawn', () => {
	it('moves focus from "Nicht mehr warten" to "Jetzt beitreten"', () => {
		const { rerender } = render(<KnockWaitDialog {...props(true)} />);
		act(() => stopWaiting()!.focus());

		rerender(<KnockWaitDialog {...props(false)} />);

		expect(stopWaiting()).toBeNull();
		expect(document.activeElement).toBe(joinNow());
	});

	it('leaves focus where the person put it inside the dialog', () => {
		const { rerender } = render(<KnockWaitDialog {...props(true)} />);
		const join = screen.getByRole('button', {
			name: 'knockWait.ready.knocking'
		});
		const other = document.createElement('button');
		join.parentElement!.appendChild(other);
		act(() => other.focus());

		rerender(<KnockWaitDialog {...props(false)} />);

		expect(document.activeElement).toBe(other);
	});
});
