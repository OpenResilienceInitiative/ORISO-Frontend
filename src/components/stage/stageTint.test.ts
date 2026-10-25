// @vitest-environment oriso-jsdom
import { describe, expect, it } from 'vite-plus/test';
import { createStageTint } from './stageTint';

const hostWithPrimary = (primary?: string) => {
	const host = document.createElement('div');
	if (primary) {
		host.style.setProperty('--m3-primary', primary);
	}
	document.body.appendChild(host);
	return host;
};

const channels = (css: string) =>
	css
		.match(/rgba\((\d+),(\d+),(\d+)/)!
		.slice(1)
		.map(Number);

describe('createStageTint', () => {
	it('leaves the red the effects were drawn in exactly as it is', () => {
		const tint = createStageTint(hostWithPrimary('#c0121f'));
		expect(tint(158, 4, 16, 0.66)).toBe('rgba(158,4,16,0.66)');
	});

	it('is the identity when the primary cannot be read', () => {
		expect(createStageTint(hostWithPrimary())(255, 180, 168, 0.15)).toBe(
			'rgba(255,180,168,0.15)'
		);
	});

	it('moves the dark dots and the light glow onto a blue primary', () => {
		const tint = createStageTint(hostWithPrimary('#1d4ed8'));
		const [dr, , db] = channels(tint(158, 4, 16, 0.8));
		const [lr, , lb] = channels(tint(255, 180, 168, 0.15));
		expect(db).toBeGreaterThan(dr);
		expect(lb).toBeGreaterThan(lr);
	});

	it('gives the exact blue for a hue that wraps below zero', () => {
		const tint = createStageTint(hostWithPrimary('#1d4ed8'));
		// (255,180,168) sits near hue 9; the blue shift is about -133 degrees.
		const [r, g, b] = channels(tint(255, 180, 168, 1));
		// Same lightness and saturation as the salmon, hue now in the blues.
		expect(b).toBeGreaterThan(g);
		expect(g).toBeGreaterThan(r);
		expect(b).toBe(255);
	});

	it('keeps the alpha it was given', () => {
		const tint = createStageTint(hostWithPrimary('#1d4ed8'));
		expect(tint(255, 255, 255, 0.09)).toContain(',0.09)');
	});
});
