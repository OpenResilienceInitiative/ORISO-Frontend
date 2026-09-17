// @vitest-environment jsdom

/**
 * The handle's keyboard contract, tested where `userEvent` is reliable.
 *
 * This exists because of a real failure, not for coverage's sake. The 320 px
 * side-panel work proved the drag through a Storybook story that pressed keys
 * on the rendered stage. That story failed roughly one run in six with
 * Storybook's "Not implemented. The result of this interaction is
 * unreliable." — the product assertions never failed, only the instrumented
 * interaction did. Reducing the number of presses did not help, so the drag
 * moved down here, to the component that owns the keys, in jsdom, outside the
 * instrumenter. The template stories now mount at their width through the
 * persisted value and assert layout only.
 *
 * `snapping={false}` is the side panel's configuration (the session list uses
 * the snapping variant); with it `normalizeWidth` is a plain clamp, so Home
 * and End must hand back exactly the bounds they were given.
 */

import * as React from 'react';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ResizableHandle } from './ResizableHandle';

afterEach(cleanup);

const PANEL_MIN = 320;
const PANEL_MAX = 900;

const renderPanelHandle = (currentWidth: number) => {
	const onResize = vi.fn();
	render(
		<ResizableHandle
			anchor="start"
			snapping={false}
			currentWidth={currentWidth}
			onResize={onResize}
			minWidth={PANEL_MIN}
			maxWidth={PANEL_MAX}
		/>
	);
	return { onResize, handle: screen.getByRole('separator') };
};

describe('side-panel resize handle — keyboard', () => {
	it('Home drags the panel down to its floor', () => {
		const { onResize, handle } = renderPanelHandle(600);
		fireEvent.keyDown(handle, { key: 'Home' });
		expect(onResize).toHaveBeenCalledWith(PANEL_MIN);
	});

	it('End drags the panel up to its ceiling', () => {
		const { onResize, handle } = renderPanelHandle(600);
		fireEvent.keyDown(handle, { key: 'End' });
		expect(onResize).toHaveBeenCalledWith(PANEL_MAX);
	});

	it('the floor holds — Home from the floor asks for the floor again', () => {
		const { onResize, handle } = renderPanelHandle(PANEL_MIN);
		fireEvent.keyDown(handle, { key: 'Home' });
		expect(onResize).toHaveBeenCalledWith(PANEL_MIN);
	});

	it('a step below the floor is clamped, never handed through', () => {
		const { onResize, handle } = renderPanelHandle(PANEL_MIN);
		// ArrowLeft grows a start-anchored pane, ArrowRight shrinks it — so
		// this is the step that would go under 320 if nothing clamped it.
		fireEvent.keyDown(handle, { key: 'ArrowRight' });
		for (const [width] of onResize.mock.calls) {
			expect(width).toBeGreaterThanOrEqual(PANEL_MIN);
		}
	});
});
