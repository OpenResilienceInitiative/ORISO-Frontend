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

afterEach(cleanup);

describe('KnockWaitDialog: the wait withdrawn', () => {
	it('moves focus from "Nicht mehr warten" to "Jetzt beitreten"', () => {
		const { rerender } = render(<KnockWaitDialog {...props(true)} />);
		act(() => screen.getByTestId('knock-wait-cancel').focus());

		rerender(<KnockWaitDialog {...props(false)} />);

		expect(screen.queryByTestId('knock-wait-cancel')).toBeNull();
		expect(document.activeElement).toBe(
			screen.getByTestId('knock-wait-join')
		);
	});

	it('leaves focus where the person put it inside the dialog', () => {
		const { rerender } = render(<KnockWaitDialog {...props(true)} />);
		const join = screen.getByTestId('knock-wait-join');
		const other = document.createElement('button');
		join.parentElement!.appendChild(other);
		act(() => other.focus());

		rerender(<KnockWaitDialog {...props(false)} />);

		expect(document.activeElement).toBe(other);
	});
});
