// @vitest-environment jsdom
import * as React from 'react';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ChannelMenu } from './ChannelMenu';
import type { SecondaryChannel } from './channelSwitcherState';

afterEach(() => cleanup());

const channels: SecondaryChannel[] = [
	{ id: 'supervision', kind: 'supervision', label: 'Bettina B.' },
	{ id: '$thread-1', kind: 'thread', label: 'Thread #1' }
];

const nextTick = () =>
	act(() => new Promise<void>((resolve) => setTimeout(resolve, 0)));

/**
 * Review v6 (T20): the card owns keyboard focus while it is open. The
 * composer's deferred autofocus used to steal it a tick after the card
 * mounted, so ↓/↑ moved nothing (story (d3) failed 2 of 5 runs).
 */
describe('ChannelMenu focus ownership', () => {
	it('takes focus back when something outside steals it while the card is open', async () => {
		const { getAllByRole, container } = render(
			<>
				<input data-testid="composer" />
				<ChannelMenu
					channels={channels}
					onSelect={vi.fn()}
					onClose={vi.fn()}
				/>
			</>
		);
		const items = getAllByRole('menuitem');
		expect(document.activeElement).toBe(items[0]);

		const composer = container.querySelector<HTMLInputElement>(
			'[data-testid="composer"]'
		)!;
		act(() => composer.focus());
		expect(document.activeElement).toBe(composer);

		await nextTick();
		expect(document.activeElement).toBe(items[0]);
	});

	it('follows the roving index: the row focused last is the one it returns to', async () => {
		const { getAllByRole, container } = render(
			<>
				<input data-testid="composer" />
				<ChannelMenu
					channels={channels}
					onSelect={vi.fn()}
					onClose={vi.fn()}
				/>
			</>
		);
		const items = getAllByRole('menuitem');
		act(() => items[1].focus());
		act(() =>
			container
				.querySelector<HTMLInputElement>('[data-testid="composer"]')!
				.focus()
		);
		await nextTick();
		expect(document.activeElement).toBe(items[1]);
	});

	it('lets the host move focus away when it closes the card (Escape → channel button)', async () => {
		const Host = () => {
			const [open, setOpen] = React.useState(true);
			const buttonRef = React.useRef<HTMLButtonElement | null>(null);
			return (
				<>
					<button ref={buttonRef} data-testid="channel-button">
						Thread
					</button>
					{open && (
						<ChannelMenu
							channels={channels}
							onSelect={vi.fn()}
							onClose={() => {
								setOpen(false);
								buttonRef.current?.focus();
							}}
						/>
					)}
				</>
			);
		};
		const { getByRole, getByTestId } = render(<Host />);
		fireEvent.keyDown(getByRole('menu'), { key: 'Escape' });
		await nextTick();
		expect(document.activeElement).toBe(getByTestId('channel-button'));
	});

	it('does not fight a pointer that closes the card by clicking elsewhere', async () => {
		const Host = () => {
			const [open, setOpen] = React.useState(true);
			return (
				<>
					<input
						data-testid="composer"
						onPointerDown={() => setOpen(false)}
					/>
					{open && (
						<ChannelMenu
							channels={channels}
							onSelect={vi.fn()}
							onClose={vi.fn()}
						/>
					)}
				</>
			);
		};
		const { getByTestId, queryByRole } = render(<Host />);
		const composer = getByTestId('composer');
		act(() => {
			fireEvent.pointerDown(composer);
			composer.focus();
		});
		await nextTick();
		expect(queryByRole('menu')).toBeNull();
		expect(document.activeElement).toBe(composer);
	});
});
