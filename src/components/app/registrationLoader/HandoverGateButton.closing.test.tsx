// @vitest-environment jsdom
import * as React from 'react';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string) => key })
}));

const play = vi.fn();
vi.mock('../../transition/closing/useClosingAnimation', () => ({
	useClosingAnimation: () => ({ play })
}));

/* What the room warms is the app's business (appChunks.test.ts); here only
   that the gate asks, when, and for which destination. */
const calls: string[] = [];
const warmClosingDestination = vi.fn((focal: string) => {
	calls.push(`warm:${focal}`);
});
let idle: Array<() => void> = [];
const stopWaiting = vi.fn();
vi.mock('../appChunks', () => ({
	warmClosingDestination: (focal: string) => warmClosingDestination(focal),
	warmWhenIdle: (task: () => void) => {
		idle.push(task);
		return stopWaiting;
	}
}));

const { HandoverGateButton } = await import('./HandoverGateButton');

const gate = () =>
	document.querySelector<HTMLButtonElement>(
		'[data-cy="handover-gate-button"]'
	)!;

/** A play that stays open until the test lets the screen "cover" and "finish". */
const controlledPlay = () => {
	let covered: () => unknown = () => undefined;
	let finish: () => void = () => undefined;
	play.mockImplementation(({ onCovered }: { onCovered: () => unknown }) => {
		covered = onCovered;
		return new Promise<{ played: boolean }>((resolve) => {
			finish = () => resolve({ played: true });
		});
	});
	return { cover: () => covered(), finish: () => finish() };
};

/**
 * ORISO-Frontend#1737. The gate button is the one place every waiting room
 * goes through: a room declares where the person arrives and the platform's
 * closing animation plays on the way. The registration form's submit button
 * does not declare it, and must behave exactly as before.
 */
describe('HandoverGateButton closing animation', () => {
	beforeEach(() => {
		// Braces matter: a function returned from a hook is run as its cleanup.
		play.mockReset();
		warmClosingDestination.mockClear();
		stopWaiting.mockClear();
		calls.length = 0;
		idle = [];
	});
	afterEach(cleanup);

	it('without a declared focal it enters at once and plays nothing', () => {
		const onEnter = vi.fn();
		render(<HandoverGateButton state="ready" onEnter={onEnter} />);
		fireEvent.click(gate());
		expect(onEnter).toHaveBeenCalledTimes(1);
		expect(play).not.toHaveBeenCalled();
	});

	it('with a declared focal it plays toward that focal and enters only once the screen is covered', async () => {
		const timeline = controlledPlay();
		const onEnter = vi.fn();
		render(
			<HandoverGateButton
				state="ready"
				closing="call"
				onEnter={onEnter}
			/>
		);

		fireEvent.click(gate());
		expect(play).toHaveBeenCalledTimes(1);
		expect(play.mock.calls[0][0]).toMatchObject({ focal: 'call' });
		expect(
			onEnter,
			'the room is not left before it is covered'
		).not.toHaveBeenCalled();

		await act(async () => timeline.cover());
		expect(onEnter).toHaveBeenCalledTimes(1);
		await act(async () => timeline.finish());
	});

	it('says in the markup where the room has it arrive, so every room can be held to it', () => {
		const { rerender } = render(
			<HandoverGateButton state="ready" closing="call" />
		);
		expect(gate().getAttribute('data-cy-closing')).toBe('call');
		rerender(<HandoverGateButton state="ready" />);
		expect(gate().hasAttribute('data-cy-closing')).toBe(false);
	});

	it('opens the circle at the centre of the button that was pressed', async () => {
		const timeline = controlledPlay();
		render(
			<HandoverGateButton
				state="ready"
				closing="messageField"
				onEnter={vi.fn()}
			/>
		);
		vi.spyOn(gate(), 'getBoundingClientRect').mockReturnValue({
			left: 100,
			top: 500,
			width: 300,
			height: 60,
			right: 400,
			bottom: 560,
			x: 100,
			y: 500,
			toJSON: () => ({})
		});

		fireEvent.click(gate());
		expect(play.mock.calls[0][0].origin).toEqual({ x: 250, y: 530 });

		await act(async () => timeline.finish());
	});

	it('answers the press at once: the button reads as entering and cannot be pressed twice', async () => {
		const timeline = controlledPlay();
		render(
			<HandoverGateButton
				state="ready"
				closing="messageField"
				onEnter={vi.fn()}
			/>
		);

		fireEvent.click(gate());
		expect(gate().getAttribute('aria-busy')).toBe('true');
		expect(gate().getAttribute('data-cy-state')).toBe('entering');
		expect(gate().disabled).toBe(true);
		fireEvent.click(gate());
		expect(play).toHaveBeenCalledTimes(1);

		await act(async () => timeline.finish());
	});

	it('gives the button back when the animation is over and the room stayed', async () => {
		const timeline = controlledPlay();
		render(
			<HandoverGateButton
				state="ready"
				closing="messageField"
				onEnter={vi.fn()}
			/>
		);

		fireEvent.click(gate());
		await act(async () => timeline.finish());

		expect(gate().getAttribute('aria-busy')).toBe('false');
		expect(gate().getAttribute('data-cy-state')).toBe('ready');
		expect(gate().disabled).toBe(false);
	});

	/* The button is shut while the screen is covered, so the closing animation
	   cannot hand the keyboard back to it (a browser ignores focus on a disabled
	   button). The gate does it itself once it is open again. */
	describe('the keyboard after a refused entry', () => {
		const refused = () => (
			<HandoverGateButton
				state="ready"
				closing="messageField"
				onEnter={() => false}
			/>
		);

		it('is back on the button once the gate is open again', async () => {
			const timeline = controlledPlay();
			render(refused());
			gate().focus();
			fireEvent.click(gate());
			expect(gate().disabled).toBe(true);
			// A browser drops the focus of a button that is shut.
			gate().blur();
			await act(async () => timeline.cover());
			await act(async () => timeline.finish());

			expect(gate().disabled).toBe(false);
			expect(document.activeElement).toBe(gate());
		});

		it('is not taken from something that has it by then', async () => {
			const timeline = controlledPlay();
			render(refused());
			gate().focus();
			fireEvent.click(gate());
			gate().blur();
			const other = document.createElement('button');
			document.body.appendChild(other);
			other.focus();
			await act(async () => timeline.finish());

			expect(document.activeElement).toBe(other);
			other.remove();
		});

		it('is not put on a button that a mouse pressed without focusing it', async () => {
			const timeline = controlledPlay();
			render(refused());
			// A mouse click carries a count; a key press or a script has none.
			fireEvent.click(gate(), { detail: 1 });
			await act(async () => timeline.finish());

			expect(gate().disabled).toBe(false);
			expect(document.activeElement).toBe(document.body);
		});

		it('is put on a button that a key or a script pressed, such as the leave dialog starting the chat', async () => {
			const timeline = controlledPlay();
			render(refused());
			// The dialog's own button had the focus, and it is gone by then.
			fireEvent.click(gate());
			await act(async () => timeline.finish());

			expect(gate().disabled).toBe(false);
			expect(document.activeElement).toBe(gate());
		});
	});

	it('does not play, and does not enter, when the room refuses first', () => {
		const onEnter = vi.fn();
		const beforeEnter = vi.fn(() => false);
		render(
			<HandoverGateButton
				state="ready"
				closing="messageField"
				onEnter={onEnter}
				beforeEnter={beforeEnter}
			/>
		);
		fireEvent.click(gate());
		expect(beforeEnter).toHaveBeenCalledTimes(1);
		expect(play).not.toHaveBeenCalled();
		expect(onEnter).not.toHaveBeenCalled();
		expect(gate().getAttribute('data-cy-state')).toBe('ready');
	});

	it('plays when the room agrees', async () => {
		const timeline = controlledPlay();
		render(
			<HandoverGateButton
				state="ready"
				closing="messageField"
				onEnter={vi.fn()}
				beforeEnter={() => true}
			/>
		);
		fireEvent.click(gate());
		expect(play).toHaveBeenCalledTimes(1);
		await act(async () => timeline.finish());
	});

	/**
	 * For the 340 ms the screen takes to cover, the room can still change under
	 * the person's hand (a key press is never stopped by the overlay): an
	 * unticked consent box must not be walked past.
	 */
	it('asks the room once more when the screen is covered, and stays put if it says no now', async () => {
		const timeline = controlledPlay();
		const onEnter = vi.fn();
		let agreed = true;
		render(
			<HandoverGateButton
				state="ready"
				closing="messageField"
				onEnter={onEnter}
				beforeEnter={() => agreed}
			/>
		);

		fireEvent.click(gate());
		expect(play).toHaveBeenCalledTimes(1);
		agreed = false;
		let told: unknown;
		await act(async () => {
			told = timeline.cover();
		});
		expect(
			onEnter,
			'the person took the consent back'
		).not.toHaveBeenCalled();
		expect(
			told,
			'the animation is told the person stays, so it does not wait for a destination'
		).toBe(false);

		await act(async () => timeline.finish());
		expect(gate().getAttribute('data-cy-state')).toBe('ready');
	});

	it("hands the room's own answer on, so a refused or failed entry can say the person stays", async () => {
		const timeline = controlledPlay();
		const onEnter = vi.fn(() => Promise.resolve(false));
		render(
			<HandoverGateButton
				state="ready"
				closing="messageField"
				onEnter={onEnter}
			/>
		);
		fireEvent.click(gate());

		let told: unknown;
		await act(async () => {
			told = timeline.cover();
		});
		await expect(told).resolves.toBe(false);
		await act(async () => timeline.finish());
	});

	it('asks the room as it is now, not as it was at the press', async () => {
		const timeline = controlledPlay();
		const onEnter = vi.fn();
		const { rerender } = render(
			<HandoverGateButton
				state="ready"
				closing="messageField"
				onEnter={onEnter}
				beforeEnter={() => true}
			/>
		);
		fireEvent.click(gate());

		rerender(
			<HandoverGateButton
				state="ready"
				closing="messageField"
				onEnter={onEnter}
				beforeEnter={() => false}
			/>
		);
		await act(async () => timeline.cover());
		expect(onEnter).not.toHaveBeenCalled();
		await act(async () => timeline.finish());
	});

	it('enters through the room as it is now, not through the one that was pressed', async () => {
		const timeline = controlledPlay();
		const pressedOnEnter = vi.fn();
		const currentOnEnter = vi.fn();
		const { rerender } = render(
			<HandoverGateButton
				state="ready"
				closing="messageField"
				onEnter={pressedOnEnter}
			/>
		);
		fireEvent.click(gate());
		rerender(
			<HandoverGateButton
				state="ready"
				closing="messageField"
				onEnter={currentOnEnter}
			/>
		);
		await act(async () => timeline.cover());

		expect(currentOnEnter).toHaveBeenCalledTimes(1);
		expect(pressedOnEnter).not.toHaveBeenCalled();
		await act(async () => timeline.finish());
	});

	it("hands the room's own wait to the animation, so the screen stays covered until it is done", async () => {
		const timeline = controlledPlay();
		const waiting = new Promise<void>(() => undefined);
		render(
			<HandoverGateButton
				state="ready"
				closing="messageField"
				onEnter={() => waiting}
			/>
		);
		fireEvent.click(gate());

		expect(timeline.cover()).toBe(waiting);
		await act(async () => timeline.finish());
	});

	it('reports an animation that failed and gives the button back', async () => {
		const failure = new Error('the swap failed');
		play.mockImplementation(() => Promise.reject(failure));
		const report = vi
			.spyOn(console, 'error')
			.mockImplementation(() => undefined);
		render(
			<HandoverGateButton
				state="ready"
				closing="messageField"
				onEnter={vi.fn()}
			/>
		);

		fireEvent.click(gate());
		await act(async () => undefined);

		expect(report).toHaveBeenCalledWith(
			'Closing animation failed',
			failure
		);
		expect(gate().getAttribute('data-cy-state')).toBe('ready');
		report.mockRestore();
	});

	it('does nothing while the gate is still shut', () => {
		const onEnter = vi.fn();
		render(
			<HandoverGateButton
				state="preparing"
				closing="messageField"
				onEnter={onEnter}
			/>
		);
		fireEvent.click(gate());
		expect(play).not.toHaveBeenCalled();
		expect(onEnter).not.toHaveBeenCalled();
	});
});

/**
 * ORISO-Frontend#1737. A person who presses the button must arrive in a screen
 * that is already there. The gate warms the destination its room declared while
 * the person reads, and once more at the press, 340 ms before the room is
 * swapped.
 */
describe('HandoverGateButton warms the destination', () => {
	beforeEach(() => {
		play.mockReset();
		warmClosingDestination.mockClear();
		stopWaiting.mockClear();
		calls.length = 0;
		idle = [];
	});
	afterEach(cleanup);

	it('when the browser is idle, for the focal point the room declared', () => {
		render(<HandoverGateButton state="preparing" closing="messageField" />);
		expect(
			warmClosingDestination,
			'not before the browser has time'
		).not.toHaveBeenCalled();
		idle.forEach((task) => task());
		expect(warmClosingDestination).toHaveBeenCalledWith('messageField');
	});

	it('for the call when the room ends on the call', () => {
		render(<HandoverGateButton state="preparing" closing="call" />);
		idle.forEach((task) => task());
		expect(warmClosingDestination).toHaveBeenCalledWith('call');
	});

	it('not at all for a button that does not leave the room (the registration form)', () => {
		render(<HandoverGateButton state="preparing" />);
		expect(idle).toHaveLength(0);
		fireEvent.click(gate());
		expect(warmClosingDestination).not.toHaveBeenCalled();
	});

	it('stops waiting for idle time when the room goes away first', () => {
		const { unmount } = render(
			<HandoverGateButton state="preparing" closing="messageField" />
		);
		unmount();
		expect(stopWaiting).toHaveBeenCalledTimes(1);
	});

	it('at the press as well, before the animation starts and long before the room is swapped', async () => {
		play.mockImplementation(() => {
			calls.push('play');
			return new Promise(() => undefined);
		});
		render(<HandoverGateButton state="ready" closing="messageField" />);
		fireEvent.click(gate());
		expect(calls).toEqual(['warm:messageField', 'play']);
	});
});
