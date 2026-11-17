// @vitest-environment oriso-jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import type { CalendarEntry } from './calendarModel';
import { FLASH_MS, useCreatedFlash } from './useCreatedFlash';

afterEach(() => vi.useRealTimers());

const at = (hour: number) => new Date(2026, 10, 17, hour);
const entry = (id: string, from: number, to: number, ownerId = 'me') =>
	({
		id,
		type: 'appointment',
		kind: 'video',
		start: at(from).toISOString(),
		end: at(to).toISOString(),
		ownerId
	}) as CalendarEntry;

const OLD = entry('old', 9, 10);

describe('the new-entry flash (prototype v17)', () => {
	it('flashes the entry that arrives with the created times, then stops', () => {
		vi.useFakeTimers();
		const { result, rerender } = renderHook(
			({ entries }) => useCreatedFlash(entries, 'me'),
			{ initialProps: { entries: [OLD] } }
		);
		act(() =>
			result.current.expectCreated([
				{ type: 'appointment', start: at(14), end: at(15) }
			])
		);
		// A colleague's entry at that time is not the one created.
		rerender({ entries: [OLD, entry('kaya', 14, 15, 'kaya')] });
		expect(result.current.flashIds).toEqual([]);
		rerender({
			entries: [OLD, entry('kaya', 14, 15, 'kaya'), entry('new', 14, 15)]
		});
		expect(result.current.flashIds).toEqual(['new']);
		act(() => vi.advanceTimersByTime(FLASH_MS));
		expect(result.current.flashIds).toEqual([]);
	});

	it('does not flash entries that merely load', () => {
		const { result, rerender } = renderHook(
			({ entries }) => useCreatedFlash(entries, 'me'),
			{ initialProps: { entries: [] as CalendarEntry[] } }
		);
		rerender({ entries: [OLD, entry('later', 14, 15)] });
		expect(result.current.flashIds).toEqual([]);
	});
});
