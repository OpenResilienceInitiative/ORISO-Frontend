// @vitest-environment jsdom
import * as React from 'react';
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { OrbitalTrails } from './OrbitalTrails';
import { THEME_APPLIED_EVENT } from '../../utils/theme/themeEvents';

let tokens: Record<string, string>;
let draws: { color: string; alpha: number; kind: string }[];

beforeEach(() => {
	tokens = Object.fromEntries(
		[1, 2, 3, 4].map((index) => [
			`--orbital-trails-color-${index}`,
			'#a5000a'
		])
	);
	draws = [];
	vi.spyOn(window, 'getComputedStyle').mockImplementation(
		() =>
			({
				getPropertyValue: (name: string) => tokens[name] || ''
			}) as CSSStyleDeclaration
	);
	vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
		() => {
			const context = { strokeStyle: '', fillStyle: '', globalAlpha: 1 };
			return new Proxy(context, {
				get(target, key) {
					if (key === 'stroke' || key === 'fill') {
						return () =>
							draws.push({
								color:
									key === 'stroke'
										? target.strokeStyle
										: target.fillStyle,
								alpha: target.globalAlpha,
								kind: key
							});
					}
					return key in target
						? target[key as keyof typeof target]
						: () => undefined;
				}
			}) as never;
		}
	);
	vi.stubGlobal(
		'requestAnimationFrame',
		vi.fn(() => 1)
	);
	vi.stubGlobal('cancelAnimationFrame', vi.fn());
	vi.stubGlobal('IntersectionObserver', undefined);
});

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

it('repaints an already mounted paused loader with the new tenant colour', () => {
	const { container } = render(
		<OrbitalTrails
			label="Loading"
			variant="single"
			paused
			warmupFrames={2}
		/>
	);
	const canvas = container.querySelector('canvas');
	expect(draws.every(({ color }) => color === '#a5000a')).toBe(true);
	Object.keys(tokens).forEach((name) => {
		tokens[name] = '#004488';
	});
	draws.length = 0;
	act(() => {
		window.dispatchEvent(new CustomEvent(THEME_APPLIED_EVENT));
	});
	expect(container.querySelector('canvas')).toBe(canvas);
	expect(draws.length).toBeGreaterThan(0);
	expect(draws.every(({ color }) => color === '#004488')).toBe(true);
	expect(window.requestAnimationFrame).not.toHaveBeenCalled();
});

it('uses the loader opacity tokens and refreshes them when the theme changes', () => {
	tokens['--oriso-loader-trail-opacity'] = '0.08';
	tokens['--oriso-loader-orbit-opacity'] = '0.16';
	tokens['--oriso-loader-dot-opacity'] = '0.75';
	render(
		<OrbitalTrails
			label="Loading"
			variant="single"
			paused
			warmupFrames={1}
		/>
	);
	expect(draws.map(({ alpha }) => alpha)).toEqual([
		0.08, 0.16, 0.75, 0.16, 0.75, 0.16, 0.75
	]);
	tokens['--oriso-loader-trail-opacity'] = '0.10';
	draws.length = 0;
	act(() => {
		window.dispatchEvent(new CustomEvent(THEME_APPLIED_EVENT));
	});
	expect(draws[0].alpha).toBe(0.1);
});

it('keeps safe default opacity values when tokens are absent or invalid', () => {
	tokens['--oriso-loader-trail-opacity'] = 'invalid';
	tokens['--oriso-loader-orbit-opacity'] = '2';
	tokens['--oriso-loader-dot-opacity'] = '-1';
	render(
		<OrbitalTrails
			label="Loading"
			variant="single"
			paused
			warmupFrames={1}
		/>
	);
	expect(draws.map(({ alpha }) => alpha)).toEqual([
		0.045, 0.48, 0.9, 0.48, 0.9, 0.48, 0.9
	]);
});

it('replaces the old animation loop on a theme change and removes its listener on unmount', () => {
	const { unmount } = render(
		<OrbitalTrails label="Loading" warmupFrames={1} />
	);
	expect(window.requestAnimationFrame).toHaveBeenCalledTimes(1);
	act(() => {
		window.dispatchEvent(new CustomEvent(THEME_APPLIED_EVENT));
	});
	expect(window.cancelAnimationFrame).toHaveBeenCalledTimes(1);
	expect(window.requestAnimationFrame).toHaveBeenCalledTimes(2);
	unmount();
	act(() => {
		window.dispatchEvent(new CustomEvent(THEME_APPLIED_EVENT));
	});
	expect(window.requestAnimationFrame).toHaveBeenCalledTimes(2);
	expect(window.cancelAnimationFrame).toHaveBeenCalledTimes(2);
});

it('refreshes the reduced-motion drawing without starting an animation', () => {
	vi.stubGlobal('matchMedia', () => ({ matches: true }));
	render(<OrbitalTrails label="Loading" warmupFrames={1} />);
	draws.length = 0;
	act(() => {
		window.dispatchEvent(new CustomEvent(THEME_APPLIED_EVENT));
	});
	expect(draws.length).toBeGreaterThan(0);
	expect(window.requestAnimationFrame).not.toHaveBeenCalled();
});

it('allows fully transparent and fully opaque token values', () => {
	tokens['--oriso-loader-trail-opacity'] = '0';
	tokens['--oriso-loader-orbit-opacity'] = '1';
	tokens['--oriso-loader-dot-opacity'] = '0.5';
	render(
		<OrbitalTrails
			label="Loading"
			variant="single"
			paused
			warmupFrames={1}
		/>
	);
	expect(draws.map(({ alpha }) => alpha)).toEqual([
		0, 1, 0.5, 1, 0.5, 1, 0.5
	]);
});
