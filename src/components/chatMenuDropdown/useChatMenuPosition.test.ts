import { describe, expect, it } from 'vitest';
import { getChatMenuPosition } from './useChatMenuPosition';

describe('chat menu placement', () => {
	const menu = { width: 301, height: 400 };
	it('opens beside the trigger at the same height when right space is available', () => {
		expect(
			getChatMenuPosition(
				{ left: 100, right: 148, top: 80 },
				{ width: 1000, height: 800 },
				menu
			)
		).toMatchObject({ left: 156, top: 80, transformOrigin: 'left 0px' });
	});
	it('flips left when the right side cannot fit', () => {
		expect(
			getChatMenuPosition(
				{ left: 900, right: 948, top: 80 },
				{ width: 1000, height: 800 },
				menu
			)
		).toMatchObject({ left: 591, top: 80, transformOrigin: 'right 0px' });
	});
	it('moves tall menus upward and keeps the animation origin against the trigger', () => {
		expect(
			getChatMenuPosition(
				{ left: 900, right: 948, top: 700 },
				{ width: 1000, height: 800 },
				menu
			)
		).toMatchObject({ top: 388, transformOrigin: 'right 312px' });
	});
	/*
	 * FE#1115 follow-up — Frank, 15.09.2026: "Es soll kein Overlap da sein,
	 * sondern ein Nebeneinander." Passing the card as the surface is what
	 * makes "beside" mean beside the CARD rather than beside the button
	 * that sits inside it.
	 */
	const card = { left: 60, right: 460, top: 70, bottom: 230 };

	it('opens beside the card, not beside the trigger inside it', () => {
		// The trigger sits at the card's right edge. Anchored to the button
		// the menu would start at 428 — on top of the card. Anchored to the
		// card it clears it.
		expect(
			getChatMenuPosition(
				{ left: 372, right: 420, top: 80 },
				{ width: 1000, height: 800 },
				menu,
				card
			)
		).toMatchObject({ left: 468, placement: 'right' });
	});

	it('goes to the other side of the card when the right has no room', () => {
		// Card hugs the right edge: 900 + 8 + 301 would overflow, 500 - 8 -
		// 301 = 191 fits.
		expect(
			getChatMenuPosition(
				{ left: 852, right: 900, top: 80 },
				{ width: 1000, height: 800 },
				menu,
				{ left: 500, right: 900, top: 70, bottom: 230 }
			)
		).toMatchObject({ left: 191, placement: 'left' });
	});

	it('drops below the card when neither side fits', () => {
		expect(
			getChatMenuPosition(
				{ left: 60, right: 108, top: 80 },
				{ width: 340, height: 900 },
				menu,
				{ left: 12, right: 328, top: 70, bottom: 230 }
			)
		).toMatchObject({ placement: 'below', top: 238 });
	});

	it('rises above the card when there is no room below either', () => {
		expect(
			getChatMenuPosition(
				{ left: 60, right: 108, top: 480 },
				{ width: 340, height: 900 },
				menu,
				{ left: 12, right: 328, top: 460, bottom: 620 }
			)
		).toMatchObject({ placement: 'above', top: 52 });
	});

	it('constrains both dimensions on a narrow short viewport', () => {
		expect(
			getChatMenuPosition(
				{ left: 240, right: 288, top: 450 },
				{ width: 280, height: 400 },
				{ width: 301, height: 900 }
			)
		).toMatchObject({ left: 12, top: 12, width: 256, maxHeight: 376 });
	});
});
