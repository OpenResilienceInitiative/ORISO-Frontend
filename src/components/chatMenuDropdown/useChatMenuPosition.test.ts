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

	/*
	 * Frank, 17.09.2026, on the phone: the menu hung below the whole card,
	 * far from the button that opened it — "Mit dem riesen Abstand, das
	 * sollte natürlich nicht sein. Das muss natürlich dann rechts im Corner
	 * sein." With no room beside the card, the menu hangs from the trigger's
	 * corner: right edges flush, just below (or above) the trigger.
	 */
	it("hangs from the trigger's corner when neither side of the card fits", () => {
		expect(
			getChatMenuPosition(
				{ left: 280, right: 328, top: 86, bottom: 118 },
				{ width: 340, height: 900 },
				menu,
				{ left: 12, right: 328, top: 70, bottom: 230 }
			)
		).toMatchObject({
			placement: 'below',
			top: 126,
			left: 27,
			transformOrigin: 'right top'
		});
	});

	it("rises from the trigger's corner when there is no room below it", () => {
		expect(
			getChatMenuPosition(
				{ left: 280, right: 328, top: 476, bottom: 508 },
				{ width: 340, height: 900 },
				menu,
				{ left: 12, right: 328, top: 460, bottom: 620 }
			)
		).toMatchObject({
			placement: 'above',
			top: 68,
			left: 27,
			transformOrigin: 'right bottom'
		});
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
	/*
	 * Frank, 17.09.2026, measured on the chat-room menu: beside the card the
	 * menu sits at most 6 px from the ⋮ trigger (it may cover the card's
	 * empty trailing strip); stacked on a phone it hangs 2 px below the
	 * trigger with its right edge pulled 4 px in. `hugTrigger` opts in.
	 */
	describe('hugging the trigger (chat-room menu)', () => {
		const hug = { hugTrigger: true };

		it("opens 6 px beside the trigger, over the card's empty strip", () => {
			expect(
				getChatMenuPosition(
					{ left: 372, right: 420, top: 80, bottom: 112 },
					{ width: 1000, height: 800 },
					menu,
					card,
					hug
				)
			).toMatchObject({ left: 426, top: 80, placement: 'right' });
		});

		it('keeps 6 px to the card on the left side', () => {
			expect(
				getChatMenuPosition(
					{ left: 852, right: 900, top: 80, bottom: 112 },
					{ width: 1000, height: 800 },
					menu,
					{ left: 500, right: 900, top: 70, bottom: 230 },
					hug
				)
			).toMatchObject({ left: 193, placement: 'left' });
		});

		it('hangs 2 px below the trigger, 4 px in from its right edge', () => {
			expect(
				getChatMenuPosition(
					{ left: 280, right: 328, top: 86, bottom: 118 },
					{ width: 340, height: 900 },
					menu,
					{ left: 12, right: 328, top: 70, bottom: 230 },
					hug
				)
			).toMatchObject({ placement: 'below', top: 120, left: 23 });
		});

		it('rises 2 px above the trigger when there is no room below', () => {
			expect(
				getChatMenuPosition(
					{ left: 280, right: 328, top: 476, bottom: 508 },
					{ width: 340, height: 900 },
					menu,
					{ left: 12, right: 328, top: 460, bottom: 620 },
					hug
				)
			).toMatchObject({ placement: 'above', top: 74, left: 23 });
		});
	});
});
