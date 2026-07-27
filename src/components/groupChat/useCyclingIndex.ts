import { useEffect, useState } from 'react';

/**
 * Cycles through `0..count-1`, advancing one step every `intervalMs`.
 *
 * Pauses (stays at 0) when there is at most one item or when `enabled` is false —
 * the latter lets callers honour `prefers-reduced-motion` and keep the waiting-area
 * netiquette rules static for motion-sensitive users. The returned value is always
 * kept in range, so a shrinking `count` never points past the end.
 */
export const useCyclingIndex = (
	count: number,
	intervalMs: number,
	options: { enabled?: boolean } = {}
): number => {
	const { enabled = true } = options;
	const [index, setIndex] = useState(0);

	useEffect(() => {
		if (!enabled || count <= 1) {
			return;
		}
		const timer = setInterval(() => {
			setIndex((current) => (current + 1) % count);
		}, intervalMs);
		return () => clearInterval(timer);
	}, [enabled, count, intervalMs]);

	if (count <= 0) {
		return 0;
	}
	return index % count;
};
