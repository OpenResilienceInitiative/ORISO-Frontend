// @vitest-environment jsdom
import React from 'react';
import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AnimalAvatar } from './AnimalAvatar';

vi.mock('../../utils/pseudonymGenerator', () => ({
	renderAvatarSvg: vi.fn().mockResolvedValue('<svg></svg>')
}));

const avatar = { file: 'fox.svg', bg: '#ffffff', iconColor: '#000000' };

/** The box the SVG is scaled into — the artwork fills it edge to edge. */
const artworkBox = (size: number) => {
	const { container } = render(<AnimalAvatar avatar={avatar} size={size} />);
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
});
