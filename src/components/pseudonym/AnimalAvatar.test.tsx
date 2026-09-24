// @vitest-environment jsdom
import React from 'react';
import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AnimalAvatar } from './AnimalAvatar';

vi.mock('../../utils/pseudonymGenerator', () => ({
	renderAvatarSvg: vi.fn().mockResolvedValue('<svg></svg>')
}));

const avatar = (file = 'fox.svg') => ({
	file,
	bg: '#ffffff',
	iconColor: '#000000'
});

/** The box the SVG is scaled into — the artwork fills it edge to edge. */
const artworkBox = (size: number, file?: string) => {
	const { container } = render(
		<AnimalAvatar avatar={avatar(file)} size={size} />
	);
	const inner = container.querySelector(
		'[aria-hidden="true"]'
	) as HTMLElement;
	return parseFloat(inner.style.width);
};

describe('AnimalAvatar artwork size (#1059)', () => {
	it.each([24, 40, 48, 104, 108])(
		'gives the artwork about two thirds of a %ipx circle',
		(size) => {
			const share = artworkBox(size) / size;
			// Large enough to read at a glance, small enough to clear the rim.
			expect(share).toBeGreaterThanOrEqual(0.6);
			expect(share).toBeLessThanOrEqual(0.7);
		}
	);

	it('gives the flat or delicate motifs less padding, as the owner chose', () => {
		// Judged at 104px: 16% padding by default, 14% for the alpaca, 12% for
		// dolphin, chick, calf-like giraffe and turtle.
		// Whole-pixel rounding moves each box by up to 2px.
		const fox = artworkBox(104);
		const alpaca = artworkBox(104, 'alpaca.svg');
		const dolphin = artworkBox(104, 'dolphin.svg');
		expect(Math.abs(fox - 66)).toBeLessThanOrEqual(2);
		expect(alpaca).toBeGreaterThan(fox);
		expect(dolphin).toBeGreaterThan(alpaca);
		expect(Math.abs(dolphin - 76)).toBeLessThanOrEqual(2);
		// File names are matched case-insensitively (Nightingale.svg).
		expect(artworkBox(104, 'Nightingale.svg')).toBe(dolphin);
	});
});
