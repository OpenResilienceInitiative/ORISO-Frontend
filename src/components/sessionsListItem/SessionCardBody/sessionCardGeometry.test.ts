import { describe, expect, it } from 'vitest';
import {
	SESSION_CARD_GEOMETRY,
	sessionCardBodyHeight,
	sessionCardPreviewIndents,
	sessionCardShapeOutside
} from './sessionCardGeometry';

// Frank's signed-off v4 card (16./17.09.2026), measured in the browser:
// preview lines start 60 / 51 / 42 px from the avatar's left edge, the body
// is 92 px (card 142 px with the 48 px chip row and 2 px of border).
describe('session card geometry', () => {
	it('steps the preview in on a diagonal around the 48 px avatar', () => {
		expect(sessionCardPreviewIndents(SESSION_CARD_GEOMETRY)).toEqual([
			60, 51, 42
		]);
	});

	it('closes the body one inset below the marks on the third line', () => {
		expect(sessionCardBodyHeight(SESSION_CARD_GEOMETRY)).toBe(92);
	});

	it('draws one polygon step per preview line', () => {
		expect(sessionCardShapeOutside(SESSION_CARD_GEOMETRY)).toBe(
			'polygon(0 0, 60px 0, 60px 16px, 51px 16px, 51px 32px, 42px 32px, 42px 48px, 0 48px)'
		);
	});

	it('derives the steps from the gap instead of hardcoding them', () => {
		expect(
			sessionCardPreviewIndents({ ...SESSION_CARD_GEOMETRY, gap: 16 })
		).toEqual([64, 55, 46]);
	});
});
