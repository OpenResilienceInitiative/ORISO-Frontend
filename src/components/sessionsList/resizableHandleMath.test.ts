import { describe, expect, it } from 'vitest';
import {
	clampWidth,
	snapSessionsListWidth,
	widthFromPointer
} from './resizableHandleMath';

describe('widthFromPointer (T2: one handle, two anchors)', () => {
	it('grows the session list with the pointer moving right (end anchor)', () => {
		expect(
			widthFromPointer({
				clientX: 420,
				left: 0,
				right: 397,
				anchor: 'end'
			})
		).toBe(420);
	});

	it('grows the side panel with the pointer moving left (start anchor)', () => {
		// Panel spans 880–1280; pointer at 800 → 480 wide.
		expect(
			widthFromPointer({
				clientX: 800,
				left: 880,
				right: 1280,
				anchor: 'start'
			})
		).toBe(480);
	});

	it('rounds to whole pixels', () => {
		expect(
			widthFromPointer({
				clientX: 10.4,
				left: 0,
				right: 0,
				anchor: 'end'
			})
		).toBe(10);
	});
});

describe('clampWidth', () => {
	it('keeps a width inside [min, max]', () => {
		expect(clampWidth(700, 80, 600)).toBe(600);
		expect(clampWidth(10, 80, 600)).toBe(80);
		expect(clampWidth(300, 80, 600)).toBe(300);
	});
});

describe('snapSessionsListWidth (unchanged list rule)', () => {
	it('snaps the truncated mid-range to rail or icon-only', () => {
		expect(snapSessionsListWidth(120, 80, 600)).toBe(80);
		expect(snapSessionsListWidth(180, 80, 600)).toBe(220);
	});

	it('snaps between icon-only and the expanded minimum', () => {
		expect(snapSessionsListWidth(260, 80, 600)).toBe(220);
		expect(snapSessionsListWidth(350, 80, 600)).toBe(397);
	});

	it('leaves the expanded band alone', () => {
		expect(snapSessionsListWidth(450, 80, 600)).toBe(450);
	});
});
