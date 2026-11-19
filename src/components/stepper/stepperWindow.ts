/**
 * Which steps a stepper shows when there are more than fit (Frank, 2026-11-19: "nach drei oder
 * vier zusammenschieben"). Up to `maxVisible` steps every step shows. Beyond that, the steps
 * around the current one stay and the rest fold into one marker per side — "3 erledigt" before,
 * "+4" after — so the row keeps its width and the current step never folds away.
 */
export type StepperSlot =
	| { kind: 'step'; index: number }
	| {
			kind: 'folded';
			side: 'before' | 'after';
			from: number;
			to: number;
			count: number;
	  };

export const stepperWindow = (
	total: number,
	currentIndex: number,
	maxVisible: number
): StepperSlot[] => {
	const all = Array.from(
		{ length: total },
		(_unused, index): StepperSlot => ({ kind: 'step', index })
	);
	if (total <= maxVisible || maxVisible < 3) return all;
	const current = Math.min(Math.max(currentIndex, 0), total - 1);
	// One step before the current one stays visible, so the way back is never hidden.
	const start = Math.min(Math.max(current - 1, 0), total - maxVisible);
	const end = start + maxVisible - 1;
	const slots: StepperSlot[] = [];
	if (start > 0)
		slots.push({
			kind: 'folded',
			side: 'before',
			from: 0,
			to: start,
			count: start + 1
		});
	for (
		let index = start > 0 ? start + 1 : start;
		index <= (end < total - 1 ? end - 1 : end);
		index += 1
	) {
		slots.push({ kind: 'step', index });
	}
	if (end < total - 1)
		slots.push({
			kind: 'folded',
			side: 'after',
			from: end,
			to: total - 1,
			count: total - end
		});
	return slots;
};
