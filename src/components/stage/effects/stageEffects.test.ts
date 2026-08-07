// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { createLinesEffect } from './variants/lines';
import { createConnectedDotsEffect } from './variants/connectedDots';
import { loadStageEffect } from './loadStageEffect';
import { isStageEffectName, STAGE_EFFECT_NAMES } from './types';
import { CARRIER_COVERAGE } from './variants/coverage';
import { isInsideBorder, projectGermanBorder } from './variants/germanBorder';

/**
 * jsdom has no 2D context, so the effects get a recording stub. This checks
 * what an effect actually asks the canvas to do — which is the part that can
 * silently regress — rather than pixel output.
 */
const recordingContext = () => {
	const calls: string[] = [];
	const record =
		(name: string) =>
		(...args: unknown[]) => {
			calls.push(`${name}(${args.length})`);
		};
	const ctx = {
		calls,
		scale: record('scale'),
		clearRect: record('clearRect'),
		beginPath: record('beginPath'),
		moveTo: record('moveTo'),
		lineTo: record('lineTo'),
		stroke: record('stroke'),
		fillRect: record('fillRect'),
		drawImage: record('drawImage'),
		save: record('save'),
		restore: record('restore'),
		translate: record('translate'),
		createRadialGradient: () => ({ addColorStop: () => undefined }),
		strokeStyle: '',
		fillStyle: '',
		lineWidth: 0,
		globalAlpha: 1,
		globalCompositeOperation: 'source-over'
	};
	return ctx;
};

const stubCanvas = (width: number, height: number) => {
	const ctx = recordingContext();
	const canvas = {
		width: width * 2,
		height: height * 2,
		clientWidth: width,
		clientHeight: height,
		getContext: () => ctx
	} as unknown as HTMLCanvasElement;
	return { canvas, ctx };
};

const stubHost = () => {
	const host = document.createElement('div');
	host.getBoundingClientRect = () =>
		({ left: 0, top: 0, width: 576, height: 900 }) as DOMRect;
	return host;
};

describe('stage effect names', () => {
	it('accepts only the four known effects', () => {
		STAGE_EFFECT_NAMES.forEach((name) => {
			expect(isStageEffectName(name)).toBe(true);
		});
		expect(isStageEffectName('sparkles')).toBe(false);
		expect(isStageEffectName(undefined)).toBe(false);
	});
});

describe('loadStageEffect', () => {
	it('fetches nothing for "none"', async () => {
		await expect(loadStageEffect('none')).resolves.toBeNull();
	});

	it('returns a factory for each real effect', async () => {
		for (const name of ['lines', 'connectedDots', 'cracks'] as const) {
			const factory = await loadStageEffect(name);
			expect(typeof factory).toBe('function');
		}
	});
});

describe('german border', () => {
	it('places well-known cities inside and neighbours outside', () => {
		const { outline, project } = projectGermanBorder();
		const inside = (lon: number, lat: number) =>
			isInsideBorder(outline, ...project(lon, lat));

		// Berlin, Cologne, Munich
		expect(inside(13.4, 52.52)).toBe(true);
		expect(inside(6.96, 50.94)).toBe(true);
		expect(inside(11.58, 48.14)).toBe(true);
		// Vienna and Zurich are not Germany
		expect(inside(16.37, 48.21)).toBe(false);
		expect(inside(8.54, 47.37)).toBe(false);
	});
});

describe('carrier coverage', () => {
	it('never claims total national coverage', () => {
		Object.entries(CARRIER_COVERAGE).forEach(([carrier, coverage]) => {
			expect(
				coverage.national,
				`${carrier} must leave visible gaps`
			).toBeLessThan(0.9);
		});
	});

	it('gives every carrier at least one seed to spread from', () => {
		Object.entries(CARRIER_COVERAGE).forEach(([carrier, coverage]) => {
			expect(coverage.seeds.length, carrier).toBeGreaterThan(0);
		});
	});
});

describe('lines effect', () => {
	it('strokes every line on each frame', () => {
		const { canvas, ctx } = stubCanvas(576, 900);
		const effect = createLinesEffect({
			canvas,
			host: stubHost(),
			width: 576,
			height: 900,
			intensity: 1,
			reducedMotion: false
		});
		expect(effect).not.toBeNull();

		effect?.frame(0.5);
		const strokes = ctx.calls.filter((call) => call.startsWith('stroke('));
		expect(strokes).toHaveLength(13);
		expect(ctx.calls[1]).toBe('clearRect(4)');
	});

	it('holds still under reduced motion', () => {
		const { canvas, ctx } = stubCanvas(576, 900);
		const effect = createLinesEffect({
			canvas,
			host: stubHost(),
			width: 576,
			height: 900,
			intensity: 1,
			reducedMotion: true
		});

		// `calls` starts with the one-off scale() from setup, so compare the
		// two frames against each other rather than against a doubled total.
		const start = ctx.calls.length;
		effect?.frame(0.5);
		const firstFrame = ctx.calls.slice(start);
		const middle = ctx.calls.length;
		effect?.frame(40);
		const secondFrame = ctx.calls.slice(middle);

		// A frame far later must issue exactly the same work: with reduced
		// motion no beat is ever scheduled, so the picture does not change.
		expect(secondFrame).toEqual(firstFrame);
	});
});

describe('connected dots effect', () => {
	it('lights nothing until a carrier is hovered, then lights up', () => {
		const { canvas, ctx } = stubCanvas(430, 640);
		const effect = createConnectedDotsEffect({
			canvas,
			host: stubHost(),
			width: 430,
			height: 640,
			intensity: 1,
			reducedMotion: false
		});
		expect(effect).not.toBeNull();

		effect?.frame(0.1);
		const resting = ctx.calls.filter((c) => c === 'fillRect(4)').length;

		effect?.setCarrier('caritas');
		// Far enough in the future that the whole schedule has elapsed.
		effect?.frame(0.2);
		effect?.frame(30);
		const lit = ctx.calls.filter((c) => c === 'fillRect(4)').length;

		expect(lit).toBeGreaterThan(resting);
	});

	it('does not throw for an unknown carrier', () => {
		const { canvas } = stubCanvas(430, 640);
		const effect = createConnectedDotsEffect({
			canvas,
			host: stubHost(),
			width: 430,
			height: 640,
			intensity: 1,
			reducedMotion: false
		});

		effect?.setCarrier('does-not-exist');
		expect(() => effect?.frame(1)).not.toThrow();
	});

	it('releases its pointer listeners on destroy', () => {
		const { canvas } = stubCanvas(430, 640);
		const host = stubHost();
		const remove = vi.spyOn(host, 'removeEventListener');
		const effect = createConnectedDotsEffect({
			canvas,
			host,
			width: 430,
			height: 640,
			intensity: 1,
			reducedMotion: false
		});

		effect?.destroy?.();
		expect(remove).toHaveBeenCalledWith(
			'pointermove',
			expect.any(Function)
		);
		expect(remove).toHaveBeenCalledWith(
			'pointerleave',
			expect.any(Function)
		);
	});
});
