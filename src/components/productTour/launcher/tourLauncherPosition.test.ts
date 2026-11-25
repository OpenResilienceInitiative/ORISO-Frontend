// @vitest-environment oriso-jsdom
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { act, renderHook } from '@testing-library/react';
import {
	clampTourLauncherPosition,
	moveTourLauncherPosition,
	positionFromBox,
	readTourLauncherPosition,
	TOUR_LAUNCHER_EDGE_GAP,
	useTourLauncherPosition,
	writeTourLauncherPosition
} from './tourLauncherPosition';

const viewport = { width: 1000, height: 800 };
const size = { width: 56, height: 56 };

describe('tour launcher position', () => {
	afterEach(() => window.localStorage.clear());

	it('anchors to the nearer edges, so a resize keeps the button in its corner', () => {
		expect(positionFromBox(40, 60, viewport, size)).toEqual({
			h: 'left',
			x: 40,
			v: 'top',
			y: 60
		});
		// Centre in the right/bottom half: distances from those edges.
		expect(positionFromBox(900, 700, viewport, size)).toEqual({
			h: 'right',
			x: 1000 - 900 - 56,
			v: 'bottom',
			y: 800 - 700 - 56
		});
	});

	it('never leaves the viewport, also when the window shrinks', () => {
		expect(positionFromBox(-300, 5000, viewport, size)).toEqual({
			h: 'left',
			x: TOUR_LAUNCHER_EDGE_GAP,
			v: 'bottom',
			y: TOUR_LAUNCHER_EDGE_GAP
		});
		const farLeft = { h: 'left', x: 900, v: 'top', y: 700 } as const;
		expect(
			clampTourLauncherPosition(
				farLeft,
				{ width: 390, height: 600 },
				size
			)
		).toEqual({
			h: 'left',
			x: 390 - 56 - TOUR_LAUNCHER_EDGE_GAP,
			v: 'top',
			y: 600 - 56 - TOUR_LAUNCHER_EDGE_GAP
		});
	});

	it('moves by a keyboard step from where the button is now', () => {
		const rect = { left: 928, top: 688 };
		expect(moveTourLauncherPosition(rect, -16, 0, viewport, size)).toEqual({
			h: 'right',
			x: 1000 - 912 - 56,
			v: 'bottom',
			y: 800 - 688 - 56
		});
	});

	it('is saved per user and synced to every reader', () => {
		const pos = { h: 'left', x: 24, v: 'top', y: 80 } as const;
		const first = renderHook(() => useTourLauncherPosition('u1'));
		const second = renderHook(() => useTourLauncherPosition('u1'));
		const other = renderHook(() => useTourLauncherPosition('u2'));
		expect(first.result.current[0]).toBeNull();
		act(() => first.result.current[1](pos));
		expect(second.result.current[0]).toEqual(pos);
		expect(other.result.current[0]).toBeNull();
		expect(
			JSON.parse(
				window.localStorage.getItem('oriso.tourLauncher.position.u1') ??
					'null'
			)
		).toEqual(pos);
		// Reset: back to the default corner, the key is gone.
		act(() => second.result.current[1](null));
		expect(first.result.current[0]).toBeNull();
		expect(
			window.localStorage.getItem('oriso.tourLauncher.position.u1')
		).toBeNull();
	});

	it('follows a change from another tab', () => {
		const reader = renderHook(() => useTourLauncherPosition('u1'));
		window.localStorage.setItem(
			'oriso.tourLauncher.position.u1',
			JSON.stringify({ h: 'left', x: 16, v: 'bottom', y: 16 })
		);
		act(() => {
			window.dispatchEvent(
				new StorageEvent('storage', {
					key: 'oriso.tourLauncher.position.u1'
				})
			);
		});
		expect(reader.result.current[0]).toEqual({
			h: 'left',
			x: 16,
			v: 'bottom',
			y: 16
		});
	});

	it('falls back to the default corner when storage throws or holds junk', () => {
		expect(readTourLauncherPosition(undefined)).toBeNull();
		window.localStorage.setItem('oriso.tourLauncher.position.u1', '{oops');
		expect(readTourLauncherPosition('u1')).toBeNull();
		window.localStorage.setItem(
			'oriso.tourLauncher.position.u1',
			JSON.stringify({ h: 'middle', x: 1, v: 'top', y: 1 })
		);
		expect(readTourLauncherPosition('u1')).toBeNull();
		const get = vi
			.spyOn(Storage.prototype, 'getItem')
			.mockImplementation(() => {
				throw new Error('blocked');
			});
		const set = vi
			.spyOn(Storage.prototype, 'setItem')
			.mockImplementation(() => {
				throw new Error('blocked');
			});
		expect(readTourLauncherPosition('u1')).toBeNull();
		expect(() =>
			writeTourLauncherPosition('u1', {
				h: 'left',
				x: 1,
				v: 'top',
				y: 1
			})
		).not.toThrow();
		get.mockRestore();
		set.mockRestore();
	});
});
