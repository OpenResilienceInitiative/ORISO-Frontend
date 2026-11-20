/**
 * The new-entry flash of "Meine Termine" (prototype v17): what one just
 * created flashes twice in the grid, so the eye finds it.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { AppointmentDraft, CalendarEntry } from './calendarModel';

/** How long a new entry flashes: twice 1.4 s (prototype v17). */
export const FLASH_MS = 2800;
const minuteOf = (date: Date | string) =>
	Math.round(new Date(date).getTime() / 60_000);

/**
 * Entries just created flash twice (prototype v17). `expectCreated` takes
 * the drafts before they are saved; the next own entries that appear with
 * a draft's start and end are the new ones.
 */
export const useCreatedFlash = (entries: CalendarEntry[], ownerId: string) => {
	const expected = useRef<{ start: number; end: number }[]>([]);
	const known = useRef<Set<string> | null>(null);
	const [flashIds, setFlashIds] = useState<string[]>([]);
	useEffect(() => {
		const own = entries.filter((e) => e.ownerId === ownerId);
		const before = known.current;
		known.current = new Set(own.map((e) => e.id));
		if (!before || expected.current.length === 0) return;
		const matches =
			(e: CalendarEntry) => (d: { start: number; end: number }) =>
				d.start === minuteOf(e.start) && d.end === minuteOf(e.end);
		const fresh = own.filter(
			(e) => !before.has(e.id) && expected.current.some(matches(e))
		);
		if (fresh.length === 0) return;
		expected.current = expected.current.filter(
			(d) => !fresh.some((e) => matches(e)(d))
		);
		setFlashIds(fresh.map((e) => e.id));
	}, [entries, ownerId]);
	useEffect(() => {
		if (flashIds.length === 0) return undefined;
		const timer = window.setTimeout(() => setFlashIds([]), FLASH_MS);
		return () => window.clearTimeout(timer);
	}, [flashIds]);
	const expectCreated = useCallback((drafts: AppointmentDraft[]) => {
		expected.current = [
			...expected.current,
			...drafts.map((d) => ({
				start: minuteOf(d.start),
				end: minuteOf(d.end)
			}))
		];
	}, []);
	/** Flash these entries now, e.g. the one the calendar jumped to. */
	const flash = useCallback((ids: string[]) => setFlashIds(ids), []);
	return { flashIds, expectCreated, flash };
};
