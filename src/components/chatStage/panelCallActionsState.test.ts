import { describe, expect, it } from 'vitest';
import { resolvePanelCallActions } from './panelCallActionsState';
import { HEADER_COMPACT_WIDTH } from '../sessionHeader/roomHeaderDensity';

const wide = { width: 640, participantCount: 2 };

describe('resolvePanelCallActions (Frank 09.09.2026: calls in the side room)', () => {
	it('offers video and audio in the header row when the column is wide', () => {
		const state = resolvePanelCallActions({
			...wide,
			audioEnabled: true,
			videoEnabled: true
		});
		expect(state.visible).toBe(true);
		expect(state.placement).toBe('row');
		expect(state.kinds).toEqual(['video', 'audio']);
		expect(state.disabled).toBe(false);
	});

	it('folds them into the kebab as soon as the column is narrow', () => {
		expect(
			resolvePanelCallActions({
				...wide,
				width: HEADER_COMPACT_WIDTH - 1,
				audioEnabled: true,
				videoEnabled: true
			}).placement
		).toBe('menu');
		expect(
			resolvePanelCallActions({
				...wide,
				width: 320,
				audioEnabled: true,
				videoEnabled: true
			}).placement
		).toBe('menu');
	});

	it('folds them into the kebab on the phone whatever it measures', () => {
		expect(
			resolvePanelCallActions({
				...wide,
				phone: true,
				audioEnabled: true,
				videoEnabled: true
			}).placement
		).toBe('menu');
	});

	it('disables — never hides — while nobody else is in the side room', () => {
		const alone = resolvePanelCallActions({
			width: 640,
			participantCount: 1,
			audioEnabled: true,
			videoEnabled: true
		});
		expect(alone.visible).toBe(true);
		expect(alone.disabled).toBe(true);
		expect(alone.kinds).toEqual(['video', 'audio']);
	});

	it('follows the tenant gates for supervision calls', () => {
		expect(
			resolvePanelCallActions({
				...wide,
				audioEnabled: true,
				videoEnabled: false
			}).kinds
		).toEqual(['audio']);
		expect(
			resolvePanelCallActions({
				...wide,
				audioEnabled: false,
				videoEnabled: true
			}).kinds
		).toEqual(['video']);
		// Both switched off is the tenant saying "no calls here" — then there
		// is nothing to disable, and the controls are gone.
		const off = resolvePanelCallActions({
			...wide,
			audioEnabled: false,
			videoEnabled: false
		});
		expect(off.visible).toBe(false);
		expect(off.kinds).toEqual([]);
	});

	it('waits for the first measurement before choosing a placement', () => {
		expect(
			resolvePanelCallActions({
				width: null,
				participantCount: 2,
				audioEnabled: true,
				videoEnabled: true
			}).placement
		).toBe('row');
	});
});
