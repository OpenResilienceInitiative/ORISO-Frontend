// @vitest-environment oriso-jsdom
import React from 'react';
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
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
	// Unmount after each test: the SVG loads asynchronously, and a render
	// landing after the file's jsdom teardown fails CI with `window is not defined`.
	afterEach(cleanup);

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

	it('falls back to the default padding when the avatar has no file name', () => {
		// Avatars built by hand (stories, older mocks) may omit `file`;
		// sizing must degrade to the default, never throw during render.
		const { container } = render(
			<AnimalAvatar
				avatar={{ bg: '#fff', iconColor: '#000' } as never}
				size={104}
			/>
		);
		const inner = container.querySelector(
			'[aria-hidden="true"]'
		) as HTMLElement;
		expect(parseFloat(inner.style.width)).toBe(artworkBox(104));
	});

	it.each([48, 60, 64, 80])(
		'keeps the per-icon distinction at %ipx',
		(size) => {
			const fox = artworkBox(size);
			const alpaca = artworkBox(size, 'alpaca.svg');
			const dolphin = artworkBox(size, 'dolphin.svg');
			expect(alpaca).toBeGreaterThan(fox);
			expect(dolphin).toBeGreaterThan(alpaca);
		}
	);
});

/*
 * The call's arrangements draw people as organic forms, not circles — every
 * participant has their own silhouette from `ownShape`, and the Hain packs
 * them until they abut. That is the same avatar, the same artwork and the
 * same colours; only the outline differs.
 *
 * So the shape is a prop rather than a second component. A fork would be two
 * places to fix a padding, and the per-animal padding above was judged by eye
 * at 104px — nobody is going to judge it twice.
 */
describe('an organic shape for the call arrangements', () => {
	it('is a circle unless asked otherwise', () => {
		const { container } = render(
			<AnimalAvatar avatar={avatar()} size={100} />
		);
		expect((container.firstChild as HTMLElement).style.borderRadius).toBe(
			'50px'
		);
	});

	it('takes the silhouette the arrangement hands it', () => {
		const blob = '38% 62% 55% 45% / 47% 41% 59% 53%';
		const { container } = render(
			<AnimalAvatar avatar={avatar()} size={100} radius={blob} />
		);
		expect((container.firstChild as HTMLElement).style.borderRadius).toBe(
			blob
		);
	});

	/*
	 * The lift.
	 *
	 * `outline` used to mean two things at once — the 2px grey ring AND the
	 * soft shadow — so the call arrangements, which must not have a ring
	 * (the Hain packs shapes until they abut, and a ring there reads as a
	 * seam), lost the shadow with it. Flat shapes on a flat backdrop, and
	 * the design had them lifting off it.
	 *
	 * They are two props now. `shadow` still defaults to `outline`, so every
	 * screen that was asking for both keeps getting both.
	 */
	it('lifts off the backdrop without wearing a ring', () => {
		const { container } = render(
			<AnimalAvatar avatar={avatar()} size={100} outline={false} shadow />
		);
		const outer = container.firstChild as HTMLElement;
		expect(outer.style.boxShadow).not.toBe('none');
		expect(outer.style.boxShadow).not.toBe('');
		// No ring: the shapes abut, and a border would be the seam.
		expect(outer.style.border).toBe('0px');
	});

	it('still ties the shadow to the outline when nothing says otherwise', () => {
		// Backwards compatible on purpose: every existing caller passes only
		// `outline`, and none of them should change.
		const withRing = render(<AnimalAvatar avatar={avatar()} size={100} />);
		expect(
			(withRing.container.firstChild as HTMLElement).style.boxShadow
		).not.toBe('none');
		cleanup();

		const without = render(
			<AnimalAvatar avatar={avatar()} size={100} outline={false} />
		);
		expect(
			(without.container.firstChild as HTMLElement).style.boxShadow
		).toBe('none');
	});

	it('can be asked for a ring with no shadow', () => {
		const { container } = render(
			<AnimalAvatar avatar={avatar()} size={100} shadow={false} />
		);
		const outer = container.firstChild as HTMLElement;
		expect(outer.style.boxShadow).toBe('none');
		expect(outer.style.border).not.toBe('0px');
	});

	it('tilts without tilting the artwork out of its box', () => {
		const { container } = render(
			<AnimalAvatar avatar={avatar()} size={100} tilt={-7.4} />
		);
		const outer = container.firstChild as HTMLElement;
		expect(outer.style.transform).toBe('rotate(-7.4deg)');
		// The animal stays upright; only the form leans.
		const inner = container.querySelector(
			'[aria-hidden="true"]'
		) as HTMLElement;
		expect(inner.style.transform).toBe('rotate(7.4deg)');
	});
});
