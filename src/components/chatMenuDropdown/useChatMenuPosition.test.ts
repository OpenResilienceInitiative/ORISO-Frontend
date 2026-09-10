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
