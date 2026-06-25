import { describe, expect, it } from 'vitest';
import { recolorLottieAccent } from './lottieColorUtils';

describe('recolorLottieAccent', () => {
	it('only recolors Lottie color properties and leaves matching coordinate arrays intact', () => {
		const animation = {
			layers: [
				{
					shapes: [
						{
							ty: 'st',
							c: {
								a: 0,
								k: [
									0.20000000298, 0.800000011921,
									0.800000011921, 1
								],
								ix: 3
							}
						},
						{
							ty: 'tr',
							p: {
								a: 0,
								k: [0, 0, 0, 1],
								ix: 2
							}
						}
					],
					ef: [
						{
							ty: 5,
							v: {
								a: 0,
								k: [0, 0, 0, 1],
								ix: 1
							}
						}
					]
				}
			]
		};

		const recolored = recolorLottieAccent(animation, '#ffb4aa', '#646d78');

		expect(recolored.layers[0].shapes[0].c.k).toEqual([
			1,
			180 / 255,
			170 / 255,
			1
		]);
		expect(recolored.layers[0].shapes[1].p.k).toEqual([0, 0, 0, 1]);
		expect(recolored.layers[0].ef[0].v.k).toEqual([
			100 / 255,
			109 / 255,
			120 / 255,
			1
		]);
		expect(animation.layers[0].shapes[0].c.k).toEqual([
			0.20000000298, 0.800000011921, 0.800000011921, 1
		]);
	});
});
