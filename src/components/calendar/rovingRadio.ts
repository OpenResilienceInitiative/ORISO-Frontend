import type * as React from 'react';

/** Where an arrow, Home or End key moves in a row of options. */
const ROVING_KEYS: Partial<
	Record<string, (at: number, count: number) => number>
> = {
	ArrowRight: (at, count) => (at + 1) % count,
	ArrowDown: (at, count) => (at + 1) % count,
	ArrowLeft: (at, count) => (at - 1 + count) % count,
	ArrowUp: (at, count) => (at - 1 + count) % count,
	Home: () => 0,
	End: (_at, count) => count - 1
};

/**
 * Keyboard for a radiogroup of buttons with roving focus (WAI-ARIA radio
 * group): the arrows, Home and End choose the next option and move the
 * focus onto it, as the tabs of "Neuer Eintrag" do (FE#2494 review).
 */
export const onRovingRadioKey = <T>(
	event: React.KeyboardEvent<HTMLElement>,
	values: readonly T[],
	current: T,
	choose: (value: T) => void
) => {
	const step = ROVING_KEYS[event.key];
	if (!step || values.length === 0) return;
	event.preventDefault();
	const index = step(Math.max(0, values.indexOf(current)), values.length);
	choose(values[index]);
	const group = event.currentTarget.closest('[role="radiogroup"]');
	group?.querySelectorAll<HTMLElement>('[role="radio"]')[index]?.focus();
};
