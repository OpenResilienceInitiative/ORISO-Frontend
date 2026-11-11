import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import {
	loadTimelineListWidth,
	normalizeTimelineListWidth,
	readTimelineListWidth,
	saveTimelineListWidth
} from './timelineListWidth';

describe('Activity desktop list width', () => {
	it.each([80, 110, 150, 220, 300, 307])(
		'snaps narrow width %s to the canonical80px rail',
		(width) => {
			expect(normalizeTimelineListWidth(width)).toBe(80);
		}
	);
	it.each([308, 350, 397])(
		'snaps %s to the readable expanded floor',
		(width) => {
			expect(normalizeTimelineListWidth(width)).toBe(397);
		}
	);
	it('keeps the current default and wide preference and clamps the extremes', () => {
		expect(normalizeTimelineListWidth(400)).toBe(400);
		expect(normalizeTimelineListWidth(560)).toBe(560);
		expect(normalizeTimelineListWidth(-1)).toBe(80);
		expect(normalizeTimelineListWidth(999)).toBe(600);
	});
	it.each([null, '', 'not-a-width', 'Infinity', '400px'])(
		'defaults invalid saved width %s to400',
		(saved) => {
			expect(readTimelineListWidth(saved)).toBe(400);
		}
	);
	it('restores the same saved compact mode and normalizes legacy narrow cards', () => {
		expect(readTimelineListWidth('80')).toBe(80);
		expect(readTimelineListWidth('220')).toBe(80);
		expect(readTimelineListWidth('300')).toBe(80);
		expect(readTimelineListWidth('420')).toBe(420);
	});
});

describe('Activity width storage', () => {
	afterEach(() => vi.unstubAllGlobals());

	it('uses the default when accessing storage fails', () => {
		vi.stubGlobal('window', {
			get localStorage() {
				throw new Error('storage unavailable');
			}
		});
		expect(loadTimelineListWidth()).toBe(400);
	});

	it('uses the default when reading fails', () => {
		vi.stubGlobal('window', {
			localStorage: {
				getItem: () => {
					throw new Error('blocked');
				}
			}
		});
		expect(loadTimelineListWidth()).toBe(400);
	});

	it('ignores write failures', () => {
		vi.stubGlobal('window', {
			localStorage: {
				setItem: () => {
					throw new Error('quota');
				}
			}
		});
		expect(() => saveTimelineListWidth(420)).not.toThrow();
	});

	it('reads and writes a preference when storage works', () => {
		const setItem = vi.fn();
		vi.stubGlobal('window', {
			localStorage: { getItem: () => '420', setItem }
		});
		expect(loadTimelineListWidth()).toBe(420);
		saveTimelineListWidth(560);
		expect(setItem).toHaveBeenCalledWith(
			'notificationsTimeline_width',
			'560'
		);
	});
});
