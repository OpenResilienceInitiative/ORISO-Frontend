// @vitest-environment jsdom

import * as React from 'react';
import { useRef } from 'react';
import { render, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LAMP_MAP_MIN_WIDTH, useLampMap } from './useLampMap';

/**
 * The whole point of the gate: on a phone the effect chunk must never go over
 * the wire. `createLampMap` living behind a dynamic import is what makes that
 * true, so the test asserts the import never happens rather than inspecting
 * the rendered canvas.
 */
const createLampMap = vi.fn(async () => ({
	setCarrier: vi.fn(),
	setHeroEnabled: vi.fn(),
	prewarm: vi.fn(),
	destroy: vi.fn()
}));

vi.mock('./lampMapEffect', () => ({ createLampMap }));

const mockMatchMedia = (matches: (query: string) => boolean) => {
	vi.stubGlobal(
		'matchMedia',
		vi.fn((query: string) => ({
			matches: matches(query),
			media: query,
			addEventListener: vi.fn(),
			removeEventListener: vi.fn(),
			addListener: vi.fn(),
			removeListener: vi.fn(),
			onchange: null,
			dispatchEvent: vi.fn()
		}))
	);
};

const Harness = () => {
	const containerRef = useRef<HTMLDivElement>(null);
	const { canvasRef } = useLampMap({ containerRef });
	return (
		<div ref={containerRef}>
			<canvas ref={canvasRef} />
		</div>
	);
};

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

/**
 * jsdom reports every element as 0x0 and has no IntersectionObserver, so the
 * "near the viewport" check can never pass on its own. Give the container a
 * real box and run idle callbacks straight away.
 */
const makeStageVisible = () => {
	vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
		x: 0,
		y: 0,
		top: 0,
		left: 0,
		right: 600,
		bottom: 800,
		width: 600,
		height: 800,
		toJSON: () => ({})
	} as DOMRect);
	vi.stubGlobal('requestIdleCallback', (callback: () => void) => {
		callback();
		return 1;
	});
	vi.stubGlobal('cancelIdleCallback', vi.fn());
};

afterEach(() => {
	cleanup();
	createLampMap.mockClear();
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

describe('useLampMap gate', () => {
	it('never loads the effect below the desktop breakpoint', async () => {
		mockMatchMedia((query) => !query.includes(`${LAMP_MAP_MIN_WIDTH}px`));

		render(<Harness />);
		await flush();

		expect(createLampMap).not.toHaveBeenCalled();
	});

	it('never loads the effect when reduced motion is requested', async () => {
		mockMatchMedia(() => true);

		render(<Harness />);
		await flush();

		expect(createLampMap).not.toHaveBeenCalled();
	});

	it('loads the effect on a desktop viewport that allows motion', async () => {
		mockMatchMedia((query) => query.includes(`${LAMP_MAP_MIN_WIDTH}px`));
		makeStageVisible();

		render(<Harness />);
		await flush();
		await flush();

		expect(createLampMap).toHaveBeenCalledTimes(1);
	});
});
