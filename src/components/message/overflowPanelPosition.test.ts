import { describe, expect, it } from 'vite-plus/test';
import { overflowPanelPosition } from './ParticipantAvatarStack';

const viewport = { width: 1280, height: 800 };

describe('overflowPanelPosition', () => {
	it('opens below the badge when the list fits there', () => {
		expect(
			overflowPanelPosition(
				{ top: 100, bottom: 124, left: 300 },
				200,
				viewport
			)
		).toEqual({ top: 132, left: 288 });
	});

	it('opens above the badge near the bottom of the window', () => {
		expect(
			overflowPanelPosition(
				{ top: 700, bottom: 724, left: 300 },
				200,
				viewport
			).top
		).toBe(492);
	});

	it('shrinks to the larger side when the list fits neither above nor below', () => {
		const position = overflowPanelPosition(
			{ top: 150, bottom: 174, left: 300 },
			280,
			{ width: 1280, height: 400 }
		);
		expect(position.top).toBe(182);
		expect(position.maxHeight).toBe(210);
		expect(position.top + position.maxHeight!).toBeLessThanOrEqual(392);
	});

	it('shrinks above when there is more room there', () => {
		const position = overflowPanelPosition(
			{ top: 260, bottom: 284, left: 300 },
			280,
			{ width: 1280, height: 400 }
		);
		expect(position).toMatchObject({ top: 8, maxHeight: 244 });
	});

	it('keeps the 240px list 8px inside the right edge', () => {
		expect(
			overflowPanelPosition(
				{ top: 100, bottom: 124, left: 1270 },
				200,
				viewport
			).left
		).toBe(1032);
	});
});
