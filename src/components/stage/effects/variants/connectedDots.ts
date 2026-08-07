import { trackStagePointer } from '../pointer';
import { StageEffect, StageEffectContext } from '../types';
import {
	isInsideBorder,
	projectGermanBorder
} from './germanBorder';
import { CARRIER_COVERAGE, CITIES } from './coverage';

/** Spacing of the dot grid in CSS px. */
const GRID = 16;
/** Seconds between two seeds starting to spread. */
const SEED_STEP = 0.1;

interface Dot {
	x: number;
	y: number;
	/** Normalised map coordinates. */
	mx: number;
	my: number;
	inside: boolean;
	/** Brightness 0..1. */
	glow: number;
	/** Flare left over from switching on. */
	flare: number;
	/** Time at which this dot switches on; `Infinity` while dark. */
	onAt: number;
	lit: boolean;
	/** Per-dot jitter so the cooldown is not in lockstep. */
	jitter: number;
}

/** Deterministic PRNG — the same map every reload, no `Math.random` surprises. */
const seededRandom = (seed = 20261) => {
	let state = seed;
	return () => {
		state = (state * 16807) % 2147483647;
		return state / 2147483647;
	};
};

export interface ConnectedDotsEffect extends StageEffect {
	/** Light up a carrier's coverage. `null` switches everything off again. */
	setCarrier: (carrier: string | null) => void;
}

/**
 * "Connected Dots" (design 5b, "Lichter der Hoffnung").
 *
 * The dots are society, dark inside the red. Hovering a carrier logo turns
 * lamps on from several cities at once and traces where that carrier is
 * present; the flare fades, the lamp stays.
 *
 * The coverage figures are estimates — see `coverage.ts`. They are deliberately
 * uneven, because the point of the picture is that the carriers complement each
 * other, not that any one of them is everywhere.
 */
export const createConnectedDotsEffect = ({
	canvas,
	host,
	width,
	height,
	intensity,
	reducedMotion
}: StageEffectContext): ConnectedDotsEffect | null => {
	const ctx = canvas.getContext('2d');
	if (!ctx) {
		return null;
	}
	const dpr = canvas.width / Math.max(1, width);
	ctx.scale(dpr, dpr);

	const tracker = trackStagePointer(host);
	const random = seededRandom();
	const { outline, project, aspect } = projectGermanBorder();

	// Fit the country into the canvas, keeping its proportions.
	let mapWidth = width;
	let mapHeight = width / aspect;
	if (mapHeight > height) {
		mapHeight = height;
		mapWidth = height * aspect;
	}
	const offsetX = (width - mapWidth) / 2;
	const offsetY = (height - mapHeight) / 2;

	const dots: Dot[] = [];
	for (let x = 9; x < width - 3; x += GRID) {
		for (let y = 9; y < height - 3; y += GRID) {
			const px = x + random() * 5 - 2.5;
			const py = y + random() * 5 - 2.5;
			const mx = (px - offsetX) / mapWidth;
			const my = (py - offsetY) / mapHeight;
			dots.push({
				x: px,
				y: py,
				mx,
				my,
				inside:
					mx > 0 &&
					mx < 1 &&
					my > 0 &&
					my < 1 &&
					isInsideBorder(outline, mx, my),
				glow: 0,
				flare: 0,
				onAt: Infinity,
				lit: false,
				jitter: random()
			});
		}
	}

	const cityPoint = (key: string) => {
		const city = CITIES[key];
		return city ? project(city[0], city[1]) : null;
	};

	/** Which dots a carrier lights, and how long after the hover each waits. */
	const buildSchedule = (carrier: string) => {
		const coverage = CARRIER_COVERAGE[carrier];
		if (!coverage) {
			return [];
		}
		const strongholds = coverage.strongholds
			.map(cityPoint)
			.filter(Boolean) as [number, number][];
		const seeds = coverage.seeds
			.map(cityPoint)
			.filter(Boolean) as [number, number][];

		const chosen = new Set<number>();
		dots.forEach((dot, index) => {
			if (!dot.inside) {
				return;
			}
			if (coverage.national > 0 && random() < coverage.national) {
				chosen.add(index);
				return;
			}
			const nearStronghold = strongholds.some(
				([sx, sy]) =>
					Math.hypot(dot.mx - sx, (dot.my - sy) * 1.15) <
					coverage.strongholdRadius
			);
			if (nearStronghold && random() < coverage.strongholdShare) {
				chosen.add(index);
			}
		});

		// Every seed spreads at the same pace; bigger carriers simply light up
		// from more cities in parallel, so they fill in faster without looking
		// like a different animation.
		const groups: { index: number; distance: number }[][] = seeds.map(
			() => []
		);
		if (!groups.length) {
			return Array.from(chosen).map((index) => ({ index, delay: 0 }));
		}
		chosen.forEach((index) => {
			let best = 0;
			let bestDistance = Infinity;
			seeds.forEach(([sx, sy], seedIndex) => {
				const distance = Math.hypot(dots[index].mx - sx, dots[index].my - sy);
				if (distance < bestDistance) {
					bestDistance = distance;
					best = seedIndex;
				}
			});
			groups[best].push({ index, distance: bestDistance });
		});

		const schedule: { index: number; delay: number }[] = [];
		groups.forEach((group) => {
			group
				.sort((a, b) => a.distance - b.distance)
				.forEach((entry, rank) => {
					schedule.push({
						index: entry.index,
						delay: rank * SEED_STEP * (coverage.step / 0.008) * 0.1
					});
				});
		});
		return schedule;
	};

	const schedules = new Map<string, { index: number; delay: number }[]>();
	let carrier: string | null = null;
	let carrierChangedAt = 0;
	let pendingCarrier: string | null = null;

	// One prepared glow sprite instead of building a gradient per lamp per frame.
	const sprite = document.createElement('canvas');
	sprite.width = 64;
	sprite.height = 64;
	const spriteCtx = sprite.getContext('2d');
	if (spriteCtx) {
		const gradient = spriteCtx.createRadialGradient(32, 32, 0, 32, 32, 32);
		gradient.addColorStop(0, 'rgba(255,237,235,0.95)');
		gradient.addColorStop(0.18, 'rgba(255,218,213,0.5)');
		gradient.addColorStop(0.5, 'rgba(255,180,168,0.15)');
		gradient.addColorStop(1, 'rgba(255,180,168,0)');
		spriteCtx.fillStyle = gradient;
		spriteCtx.fillRect(0, 0, 64, 64);
	}

	let previous = 0;
	let dim = 0;

	return {
		setCarrier: (next) => {
			pendingCarrier = next;
		},
		frame: (elapsed) => {
			const dt = Math.min(0.05, previous ? elapsed - previous : 0.016);
			previous = elapsed;
			ctx.clearRect(0, 0, width, height);
			tracker.update(elapsed, dt, false);

			if (pendingCarrier !== carrier) {
				carrier = pendingCarrier;
				carrierChangedAt = elapsed;
				dots.forEach((dot) => {
					dot.onAt = Infinity;
					dot.lit = false;
				});
				if (carrier) {
					if (!schedules.has(carrier)) {
						schedules.set(carrier, buildSchedule(carrier));
					}
					schedules.get(carrier)?.forEach(({ index, delay }) => {
						dots[index].onAt = carrierChangedAt + delay;
					});
				}
			}

			let litSum = 0;
			for (const dot of dots) {
				if (elapsed > dot.onAt) {
					if (!dot.lit) {
						dot.lit = true;
						dot.flare = 1;
					}
					dot.glow += (1 - dot.glow) * Math.min(1, dt * 4);
				} else if (dot.glow > 0) {
					dot.glow *= Math.max(
						0,
						1 - dt * (0.7 + dot.jitter * 0.45)
					);
					if (dot.glow < 0.004) {
						dot.glow = 0;
						dot.flare = 0;
					}
				}
				if (dot.flare > 0) {
					dot.flare = Math.max(
						0,
						dot.flare - dt / (1.5 * (0.9 + dot.jitter * 0.2))
					);
				}
				litSum += dot.glow;
			}

			// The surface darkens as more lamps come on, so the lights read as
			// light rather than as decoration on an already bright field.
			const litFraction = Math.min(1, litSum / (dots.length * 0.35));
			const targetDim = carrier
				? Math.max(0.25, litFraction)
				: litFraction;
			dim += (targetDim - dim) * Math.min(1, dt * 1.6);
			if (dim > 0.01) {
				ctx.fillStyle = `rgba(52,2,7,${(0.62 * dim).toFixed(3)})`;
				ctx.fillRect(0, 0, width, height);
			}

			for (const dot of dots) {
				if (dot.glow <= 0.004) {
					// Resting dots: barely there, and only inside the country.
					if (dot.inside) {
						ctx.fillStyle = `rgba(255,255,255,${(0.07 * intensity * (1 - dim * 0.6)).toFixed(3)})`;
						ctx.fillRect(dot.x - 0.9, dot.y - 0.9, 1.8, 1.8);
					}
					continue;
				}
				if (dot.flare > 0 && spriteCtx) {
					const size = 26 + 30 * dot.flare;
					ctx.globalAlpha = Math.min(
						1,
						dot.flare * dot.glow * intensity
					);
					ctx.drawImage(
						sprite,
						dot.x - size / 2,
						dot.y - size / 2,
						size,
						size
					);
					ctx.globalAlpha = 1;
				}
				ctx.fillStyle = `rgba(255,240,238,${(0.9 * dot.glow * intensity).toFixed(3)})`;
				ctx.fillRect(dot.x - 1.2, dot.y - 1.2, 2.4, 2.4);
			}

			if (reducedMotion) {
				return;
			}
		},
		destroy: () => {
			tracker.destroy();
			schedules.clear();
		}
	};
};
