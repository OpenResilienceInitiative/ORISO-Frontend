// @vitest-environment jsdom
import * as React from 'react';
import {
	act,
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
	within
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string, options?: { count?: number }) =>
			options?.count !== undefined ? `${key}:${options.count}` : key
	})
}));

const { M3SnackbarHost } = await import('./M3SnackbarHost');
const { createSnackbarStack } = await import('./snackbarStack');
const { M3Snackbar } = await import('./M3Snackbar');

afterEach(() => {
	cleanup();
	vi.useRealTimers();
});

const note = (text: string) => ({
	announcement: text,
	render: () => <p>{text}</p>
});

const visibleTexts = () =>
	screen
		.getAllByTestId('m3-snackbar-host-item')
		.map((item) => item.textContent);

describe('M3SnackbarHost', () => {
	it('stacks every queued snackbar, oldest at the top, newest at the bottom edge', () => {
		const stack = createSnackbarStack();
		render(<M3SnackbarHost stack={stack} />);

		act(() => {
			stack.enqueue(note('erste'));
			stack.enqueue(note('zweite'));
		});

		expect(visibleTexts()).toEqual(['erste', 'zweite']);
	});

	it('shows only the newest ones beyond the limit and folds the rest into "+N more"', async () => {
		const stack = createSnackbarStack();
		render(<M3SnackbarHost stack={stack} maxVisible={3} />);

		act(() => {
			['a', 'b', 'c', 'd', 'e'].forEach((text) =>
				stack.enqueue(note(text))
			);
		});

		expect(visibleTexts()).toEqual(['c', 'd', 'e']);
		const more = screen.getByRole('button', {
			name: 'snackbar.stack.more:2'
		});
		expect(more.getAttribute('aria-expanded')).toBe('false');

		await userEvent.click(more);

		expect(visibleTexts()).toEqual(['a', 'b', 'c', 'd', 'e']);
		await userEvent.click(
			screen.getByRole('button', { name: 'snackbar.stack.less' })
		);
		expect(visibleTexts()).toEqual(['c', 'd', 'e']);
	});

	it('removes a snackbar that is dismissed, from outside or from inside', async () => {
		const stack = createSnackbarStack();
		render(<M3SnackbarHost stack={stack} />);
		let outside = '';
		act(() => {
			outside = stack.enqueue(note('von außen'));
			stack.enqueue({
				announcement: 'von innen',
				render: ({ dismiss }) => (
					<button type="button" onClick={dismiss}>
						schließen
					</button>
				)
			});
		});

		act(() => stack.dismiss(outside));
		expect(screen.queryByText('von außen')).toBeNull();

		await userEvent.click(
			screen.getByRole('button', { name: 'schließen' })
		);
		expect(screen.queryByTestId('m3-snackbar-host-item')).toBeNull();
	});

	it('lets a timed snackbar go after its duration, but not while someone is reading it', () => {
		vi.useFakeTimers();
		const stack = createSnackbarStack();
		render(<M3SnackbarHost stack={stack} />);
		act(() => {
			stack.enqueue({ ...note('kurz'), autoHideDuration: 4000 });
			stack.enqueue(note('bleibt'));
		});
		const region = screen.getByRole('region');

		fireEvent.mouseEnter(region);
		act(() => vi.advanceTimersByTime(10_000));
		expect(visibleTexts()).toEqual(['kurz', 'bleibt']);

		fireEvent.mouseLeave(region);
		act(() => vi.advanceTimersByTime(4000));
		expect(visibleTexts()).toEqual(['bleibt']);
	});

	it('closes a dismissible snackbar with Escape, but never one that waits for a decision', async () => {
		const stack = createSnackbarStack();
		render(<M3SnackbarHost stack={stack} />);
		act(() => {
			stack.enqueue({
				announcement: 'Entscheidung',
				dismissible: false,
				render: () => <button type="button">Reinlassen</button>
			});
			stack.enqueue({
				announcement: 'Hinweis',
				render: () => <button type="button">Ok</button>
			});
		});

		screen.getByRole('button', { name: 'Reinlassen' }).focus();
		await userEvent.keyboard('{Escape}');
		expect(screen.queryByText('Reinlassen')).not.toBeNull();

		screen.getByRole('button', { name: 'Ok' }).focus();
		await userEvent.keyboard('{Escape}');
		expect(screen.queryByText('Ok')).toBeNull();
	});

	it('announces the newest arrival once, politely, without moving focus', () => {
		const stack = createSnackbarStack();
		render(
			<>
				<button type="button">Composer</button>
				<M3SnackbarHost stack={stack} />
			</>
		);
		screen.getByRole('button', { name: 'Composer' }).focus();

		act(() => {
			stack.enqueue(note('Anna möchte beitreten'));
		});

		const status = screen.getByRole('status');
		expect(status.textContent).toBe('Anna möchte beitreten');
		expect(document.activeElement).toBe(
			screen.getByRole('button', { name: 'Composer' })
		);
	});

	it('is a named landmark, so a keyboard user can jump to it', () => {
		const stack = createSnackbarStack();
		render(<M3SnackbarHost stack={stack} />);
		act(() => {
			stack.enqueue(note('x'));
		});

		const region = screen.getByRole('region', {
			name: 'snackbar.stack.region'
		});
		expect(within(region).getByText('x')).toBeTruthy();
	});

	it('makes a standing notice step aside while the stack holds anything', async () => {
		const stack = createSnackbarStack();
		render(
			<>
				<M3Snackbar message="Stehender Hinweis" yieldToOthers />
				<M3SnackbarHost stack={stack} />
			</>
		);
		expect(screen.queryByText('Stehender Hinweis')).not.toBeNull();

		let id = '';
		act(() => {
			id = stack.enqueue(note('neu'));
		});
		await waitFor(() =>
			expect(screen.queryByText('Stehender Hinweis')).toBeNull()
		);

		act(() => stack.dismiss(id));
		await waitFor(() =>
			expect(screen.queryByText('Stehender Hinweis')).not.toBeNull()
		);
	});
});
