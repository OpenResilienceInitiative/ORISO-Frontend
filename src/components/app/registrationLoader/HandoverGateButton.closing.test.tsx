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

const { HandoverGateButton } = await import('./HandoverGateButton');

const gate = () =>
	document.querySelector<HTMLButtonElement>(
		'[data-cy="handover-gate-button"]'
	)!;

/** A play that stays open until the test lets the screen "cover" and "finish". */
const controlledPlay = () => {
	let covered: () => void = () => undefined;
	let finish: () => void = () => undefined;
	play.mockImplementation(({ onCovered }: { onCovered: () => void }) => {
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
