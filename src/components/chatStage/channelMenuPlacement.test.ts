import { describe, expect, it } from 'vitest';
import {
	CHANNEL_MENU_MIN_HEIGHT,
	placeChannelMenu
} from './channelMenuPlacement';

/**
 * Review v6 (T20): the card must never be cut by the viewport or slide
 * behind the composer — it clamps its height (the list scrolls inside) and
 * the FAB's card flips below the FAB when there is no room above.
 */
describe('placeChannelMenu', () => {
	// A 480 px tall container; the FAB sits near the bottom (y 400–456).
	const fabNearBottom = {
		anchorTop: 400,
		anchorBottom: 456,
		boundsTop: 0,
		boundsBottom: 480
	};

	it('opens on the preferred side and offers all the room there', () => {
		expect(
			placeChannelMenu({
				...fabNearBottom,
				needed: 300,
				prefer: 'up'
			})
		).toEqual({ side: 'up', maxHeight: 396 });
	});

	it('clamps to the preferred side when it does not fit but is still the larger side', () => {
		expect(
			placeChannelMenu({
				...fabNearBottom,
				needed: 600,
				prefer: 'up'
			})
		).toEqual({ side: 'up', maxHeight: 396 });
	});

	it('flips to the other side when the preferred side is too small and the other one is larger', () => {
		// FAB near the top (y 24–80): 20 px above, 396 px below.
		expect(
			placeChannelMenu({
				anchorTop: 24,
				anchorBottom: 80,
				boundsTop: 0,
				boundsBottom: 480,
				needed: 300,
				prefer: 'up'
			})
		).toEqual({ side: 'down', maxHeight: 396 });
	});

	it('never flips when the host forbids it (the header card only hangs down)', () => {
		expect(
			placeChannelMenu({
				anchorTop: 100,
				anchorBottom: 148,
				boundsTop: 0,
				boundsBottom: 400,
				needed: 500,
				prefer: 'down',
				flip: false
			})
		).toEqual({ side: 'down', maxHeight: 248 });
	});

	it('keeps a usable minimum height even in a tiny space', () => {
		const placement = placeChannelMenu({
			anchorTop: 60,
			anchorBottom: 116,
			boundsTop: 0,
			boundsBottom: 140,
			needed: 400,
			prefer: 'up'
		});
		expect(placement.maxHeight).toBe(CHANNEL_MENU_MIN_HEIGHT);
	});

	it('honours the gap between anchor and card', () => {
		expect(
			placeChannelMenu({
				...fabNearBottom,
				needed: 100,
				prefer: 'up',
				gap: 16
			}).maxHeight
		).toBe(384);
	});
});
