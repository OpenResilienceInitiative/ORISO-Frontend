import { trackStagePointer } from '../pointer';
import { StageEffect, StageEffectContext } from '../types';
import { isInsideBorder, projectGermanBorder } from './germanBorder';
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
		const seeds = coverage.seeds.map(cityPoint).filter(Boolean) as [
			number,
			number
		][];

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
				const distance = Math.hypot(
					dots[index].mx - sx,
					dots[index].my - sy
				);
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
					// Straight from the design: every seed spreads at the same
					// pace, so a carrier with more starting cities simply fills
					// in faster. (An earlier version scaled this by the
					// carrier's `step`, which made the whole map light up about
					// ten times too quickly.)
					schedule.push({
						index: entry.index,
						delay: rank * SEED_STEP
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

	// The wandering point: it drifts across the surface until the cursor catches
	// up with it, then it holds still, threads itself to the dots nearby, and
	// once it has fully settled it stays behind as a small light and a new one
	// sets off. Society is the dots; this is one person moving through it.
	const HERO_RADIUS = 92;
	const CATCH_DISTANCE = 64;
	const HELD_LIMIT = 12;
	const EDGE_PADDING = 22;

	interface Wanderer {
		x: number;
		y: number;
		/** Heading in radians. */
		angle: number;
		/** 0 → drifting, 1 → settled. */
		hold: number;
		/** Rotation of the ring drawn around it. */
		ring: number;
		links: Dot[] | null;
	}

	const spawn = (): Wanderer => ({
		x: width * (0.25 + 0.5 * random()),
		y: height * (0.2 + 0.45 * random()),
		angle: random() * Math.PI * 2,
		hold: 0,
		ring: random() * Math.PI * 2,
		links: null
	});

	let hero = spawn();
	const held: { x: number; y: number; links: Dot[] | null }[] = [];

	let previous = 0;
	let dim = 0;

	const thread = (
		from: { x: number; y: number },
		to: { x: number; y: number },
		extent: number,
		alpha: number
	) => {
		const nx = -(to.y - from.y);
		const ny = to.x - from.x;
		const length = Math.hypot(nx, ny) || 1;
		const bow = 10 * (1 - extent);
		ctx.beginPath();
		ctx.moveTo(from.x, from.y);
		ctx.quadraticCurveTo(
			(from.x + to.x) / 2 + (nx / length) * bow,
			(from.y + to.y) / 2 + (ny / length) * bow,
			to.x,
			to.y
		);
		ctx.strokeStyle = `rgba(226,152,142,${alpha.toFixed(3)})`;
		ctx.lineWidth = 0.8 + 0.7 * extent;
		ctx.stroke();
	};

	return {
		setCarrier: (next) => {
			pendingCarrier = next;
		},
		frame: (elapsed) => {
			const dt = Math.min(0.05, previous ? elapsed - previous : 0.016);
			previous = elapsed;
			ctx.clearRect(0, 0, width, height);
			tracker.update(elapsed, dt, false);
			const { pointer } = tracker;
			const cursorX = pointer.hovering ? pointer.x * width : -999;
			const cursorY = pointer.hovering ? pointer.y * height : -999;

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
					dot.glow *= Math.max(0, 1 - dt * (0.7 + dot.jitter * 0.45));
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

			// Move the wanderer — unless the cursor has caught it, or the
			// visitor asked for no motion.
			if (hero.hold < 1) {
				const caught =
					Math.hypot(hero.x - cursorX, hero.y - cursorY) <
					CATCH_DISTANCE;
				if (caught) {
					hero.hold = Math.min(1, hero.hold + dt * 0.7);
					if (!hero.links) {
						hero.links = dots
							.slice()
							.sort(
								(a, b) =>
									Math.hypot(a.x - hero.x, a.y - hero.y) -
									Math.hypot(b.x - hero.x, b.y - hero.y)
							)
							.slice(0, 6);
					}
				} else {
					hero.hold = Math.max(0, hero.hold - dt * 0.45);
					if (hero.hold === 0) {
						hero.links = null;
					}
				}

				if (!reducedMotion) {
					const speed = 1 - hero.hold;
					hero.angle += Math.sin(elapsed * 0.63) * 0.3 * dt;
					hero.x += Math.cos(hero.angle) * 17 * dt * speed;
					hero.y += Math.sin(hero.angle) * 17 * dt * speed;
					if (hero.x < EDGE_PADDING) {
						hero.x = EDGE_PADDING;
						hero.angle = Math.PI - hero.angle;
					} else if (hero.x > width - EDGE_PADDING) {
						hero.x = width - EDGE_PADDING;
						hero.angle = Math.PI - hero.angle;
					}
					if (hero.y < EDGE_PADDING) {
						hero.y = EDGE_PADDING;
						hero.angle = -hero.angle;
					} else if (hero.y > height - EDGE_PADDING) {
						hero.y = height - EDGE_PADDING;
						hero.angle = -hero.angle;
					}
				}

				if (hero.hold >= 1) {
					held.push({ x: hero.x, y: hero.y, links: hero.links });
					if (held.length > HELD_LIMIT) {
						held.shift();
					}
					hero = spawn();
				}
			}
			hero.ring += dt * 1.3;

			ctx.lineCap = 'round';
			held.forEach((point) =>
				(point.links || []).forEach((dot) =>
					thread(dot, point, 1, 0.22 * intensity)
				)
			);
			if (hero.links) {
				// The threads draw themselves one after another as the point
				// settles, rather than all appearing at once.
				hero.links.forEach((dot, index) => {
					const extent = Math.max(
						0,
						Math.min(1, hero.hold * 6 - index * 0.7)
					);
					if (extent > 0.01) {
						thread(
							dot,
							hero,
							extent,
							(0.05 + 0.26 * extent) * intensity
						);
					}
				});
			}

			for (const dot of dots) {
				const nearHero =
					1 -
					Math.min(
						1,
						Math.hypot(dot.x - hero.x, dot.y - hero.y) / HERO_RADIUS
					);
				const pulse =
					dot.glow > 0
						? Math.min(1, dot.glow) *
							(0.93 +
								0.07 * Math.sin(elapsed * 7 + dot.jitter * 6))
						: 0;
				// Ease-out: the afterglow holds, then lets go.
				const glow =
					Math.sin(Math.min(1, dot.flare) * (Math.PI / 2)) *
					Math.min(1, dot.glow * 2);

				if (glow > 0.02 && spriteCtx) {
					const r = 9 + 7 * glow;
					ctx.globalAlpha = Math.min(1, glow * intensity * 0.95);
					ctx.drawImage(sprite, dot.x - r, dot.y - r, r * 2, r * 2);
					ctx.globalAlpha = 1;
				}

				// The resting dot is dark red, not white: the dots are the
				// surface, and only a lamp or the wanderer brings light.
				const shade = 1 - 0.55 * dim;
				ctx.beginPath();
				ctx.arc(
					dot.x,
					dot.y,
					1.2 + 0.5 * nearHero + 0.4 * pulse,
					0,
					Math.PI * 2
				);
				ctx.fillStyle = `rgba(${Math.round(158 * shade)},${Math.round(4 * shade)},${Math.round(16 * shade)},${(0.66 + 0.2 * (1 - nearHero)).toFixed(2)})`;
				ctx.fill();

				if (nearHero > 0.02) {
					ctx.beginPath();
					ctx.arc(dot.x, dot.y, 1.2 + 0.5 * nearHero, 0, Math.PI * 2);
					ctx.fillStyle = `rgba(255,214,206,${(0.4 * nearHero * intensity).toFixed(3)})`;
					ctx.fill();
				}
				if (pulse > 0.02) {
					ctx.beginPath();
					ctx.arc(dot.x, dot.y, 0.8 + 0.9 * pulse, 0, Math.PI * 2);
					ctx.fillStyle = `rgba(255,240,238,${(0.92 * pulse * intensity).toFixed(3)})`;
					ctx.fill();
				}
			}

			// Points the wanderer already settled on stay behind as small lights.
			held.forEach((point) => {
				ctx.beginPath();
				ctx.arc(point.x, point.y, 3.2, 0, Math.PI * 2);
				ctx.fillStyle = `rgba(255,232,226,${(0.65 * intensity).toFixed(2)})`;
				ctx.fill();
			});

			const halo = ctx.createRadialGradient(
				hero.x,
				hero.y,
				0,
				hero.x,
				hero.y,
				HERO_RADIUS
			);
			halo.addColorStop(
				0,
				`rgba(255,236,228,${(0.15 * intensity).toFixed(3)})`
			);
			halo.addColorStop(1, 'rgba(255,236,228,0)');
			ctx.fillStyle = halo;
			ctx.fillRect(
				hero.x - HERO_RADIUS,
				hero.y - HERO_RADIUS,
				HERO_RADIUS * 2,
				HERO_RADIUS * 2
			);

			const beat = reducedMotion ? 1 : 1 + 0.15 * Math.sin(elapsed * 2.2);
			ctx.beginPath();
			ctx.arc(hero.x, hero.y, 4.4 * beat, 0, Math.PI * 2);
			ctx.fillStyle = `rgba(255,255,255,${(0.92 * intensity).toFixed(2)})`;
			ctx.fill();
			ctx.beginPath();
			ctx.arc(
				hero.x,
				hero.y,
				13 + 4 * hero.hold,
				hero.ring,
				hero.ring + 1.4 + 4.7 * hero.hold
			);
			ctx.strokeStyle = `rgba(255,255,255,${((0.16 + 0.4 * hero.hold) * intensity).toFixed(3)})`;
			ctx.lineWidth = 1.4;
			ctx.stroke();
		},
		destroy: () => {
			tracker.destroy();
			schedules.clear();
		}
	};
};
