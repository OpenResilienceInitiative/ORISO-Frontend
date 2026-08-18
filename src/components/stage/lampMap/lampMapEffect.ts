import type { CarrierId, CarrierPresence } from './carrierPresence';
import { loadCarrierPresence } from './carrierPresence';
import {
	buildSchedule,
	createPointGrid,
	createProjection,
	type LampSchedule,
	type MapProjection,
	type PointGrid
} from './lampMapGeometry';

/**
 * The stage lamp map (design 5b) as a plain canvas module.
 *
 * Deliberately framework-free and only ever reached through a dynamic
 * `import()`, so none of this — nor the geometry or the presence data — is
 * part of the initial bundle. See `useLampMap` for the gate that decides
 * whether it is loaded at all.
 */

const GLOW_SPRITE_SIZE = 64;
const HERO_RADIUS = 92;
/** The torch: how far the pointer's light reaches into the dot field. */
const TORCH_RADIUS = 150;
const HERO_SPEED = 17;
const MAX_HELD = 12;

/** Light tints, as light shades of the brand colour rather than lamp amber. */
const TINT = {
	core: 'rgba(255, 237, 235, 0.95)',
	mid: 'rgba(255, 218, 213, 0.5)',
	edge: 'rgba(255, 180, 168, 0.15)',
	out: 'rgba(255, 180, 168, 0)',
	dot: '255, 240, 238'
};

export interface LampMapHandle {
	/** Highlight one carrier's locations, or none. */
	setCarrier: (carrier: CarrierId | null) => void;
	/**
	 * Stage 3 of the start-up order: let the wandering dot and its support
	 * net run. Until then only the resting map is drawn.
	 */
	setHeroEnabled: (enabled: boolean) => void;
	/**
	 * Build the (expensive) lamp schedules ahead of time. Safe to call more
	 * than once; each carrier is computed at most once.
	 */
	prewarm: (carrier?: CarrierId) => void;
	destroy: () => void;
}

export interface LampMapOptions {
	/** Start the wandering dot only once the caller says so (stage 3). */
	onFirstFrame?: () => void;
}

const createGlowSprite = (): HTMLCanvasElement => {
	const sprite = document.createElement('canvas');
	sprite.width = GLOW_SPRITE_SIZE;
	sprite.height = GLOW_SPRITE_SIZE;
	const context = sprite.getContext('2d');
	if (!context) {
		return sprite;
	}
	const half = GLOW_SPRITE_SIZE / 2;
	const gradient = context.createRadialGradient(
		half,
		half,
		0,
		half,
		half,
		half
	);
	gradient.addColorStop(0, TINT.core);
	gradient.addColorStop(0.18, TINT.mid);
	gradient.addColorStop(0.5, TINT.edge);
	gradient.addColorStop(1, TINT.out);
	context.fillStyle = gradient;
	context.fillRect(0, 0, GLOW_SPRITE_SIZE, GLOW_SPRITE_SIZE);
	return sprite;
};

export const createLampMap = async (
	container: HTMLElement,
	canvas: HTMLCanvasElement,
	options: LampMapOptions = {}
): Promise<LampMapHandle> => {
	const presenceList = await loadCarrierPresence();
	const presenceById = new Map<CarrierId, CarrierPresence>(
		presenceList.map((entry) => [entry.id, entry])
	);

	const ctx = canvas.getContext('2d');
	if (!ctx) {
		return {
			setCarrier: () => undefined,
			setHeroEnabled: () => undefined,
			prewarm: () => undefined,
			destroy: () => undefined
		};
	}

	const projection: MapProjection = createProjection();
	const sprite = createGlowSprite();

	/*
	 * Everything that depends on the panel's size lives behind `fit()`, because
	 * the size is not settled when the module comes up: on a first visit the
	 * stage starts at 100vw and slides to 40vw over 2.5 s, and a map measured
	 * at 100vw would afterwards be squeezed to a third of its width by CSS.
	 * A ResizeObserver below re-fits when the panel changes size.
	 */
	let width = 0;
	let height = 0;
	let points: PointGrid['points'] = [];
	// Stage 4: the schedules are the expensive part (points x anchors x
	// carriers), so they are only built for a carrier that is actually asked
	// for, and then cached — until the grid is rebuilt.
	const schedules = new Map<CarrierId, LampSchedule[]>();

	const fit = () => {
		// A panel that has not been laid out yet measures 0x0; fitting to that
		// would leave an empty grid behind (and a NaN dim, see below). Wait for
		// the ResizeObserver to report a real size instead.
		const nextWidth = canvas.clientWidth;
		const nextHeight = canvas.clientHeight;
		if (nextWidth < 1 || nextHeight < 1) {
			return;
		}
		const dpr = Math.min(2, window.devicePixelRatio || 1);
		width = nextWidth;
		height = nextHeight;
		canvas.width = Math.max(1, Math.round(width * dpr));
		canvas.height = Math.max(1, Math.round(height * dpr));
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		const grid: PointGrid = createPointGrid(projection, width, height);
		points = grid.points;
		schedules.clear();
	};
	fit();

	const reducedMotion = window.matchMedia?.(
		'(prefers-reduced-motion: reduce)'
	);
	const isStill = () => Boolean(reducedMotion?.matches);

	const scheduleFor = (carrier: CarrierId): LampSchedule[] => {
		const cached = schedules.get(carrier);
		if (cached) {
			return cached;
		}
		const presence = presenceById.get(carrier);
		const built = presence
			? buildSchedule(points, presence, projection)
			: [];
		schedules.set(carrier, built);
		return built;
	};

	const pointer = { x: -9999, y: -9999, inside: false };
	const handlePointerMove = (event: MouseEvent) => {
		const rect = container.getBoundingClientRect();
		pointer.x = event.clientX - rect.left;
		pointer.y = event.clientY - rect.top;
		pointer.inside = true;
	};
	const handlePointerLeave = () => {
		pointer.inside = false;
		pointer.x = -9999;
		pointer.y = -9999;
	};
	container.addEventListener('mousemove', handlePointerMove);
	container.addEventListener('mouseleave', handlePointerLeave);

	const spawnHero = () => ({
		x: width * (0.25 + 0.5 * Math.random()),
		y: height * (0.2 + 0.45 * Math.random()),
		angle: Math.random() * Math.PI * 2,
		hold: 0,
		ring: Math.random() * Math.PI * 2,
		links: null as (typeof points)[number][] | null
	});

	let hero = spawnHero();
	let held: { x: number; y: number; links: typeof points }[] = [];
	let heroEnabled = false;
	let carrier: CarrierId | null = null;
	let appliedCarrier: CarrierId | null = null;
	let dim = 0;
	let previousTime = 0;
	let frame = 0;
	let firstFramePainted = false;

	// Re-fit once the panel has stopped changing size. The wandering point
	// and its net are anchored to grid points, so they start over; the
	// selected carrier is re-applied on the next frame.
	let resizeTimer = 0;
	const refit = () => {
		window.clearTimeout(resizeTimer);
		resizeTimer = window.setTimeout(() => {
			if (
				canvas.clientWidth === width &&
				canvas.clientHeight === height
			) {
				return;
			}
			fit();
			hero = spawnHero();
			held = [];
			appliedCarrier = null;
		}, 150);
	};
	const resizeObserver =
		typeof ResizeObserver === 'function' ? new ResizeObserver(refit) : null;
	resizeObserver?.observe(canvas);
	if (!resizeObserver) {
		window.addEventListener('resize', refit);
	}

	const applyCarrier = (time: number) => {
		points.forEach((point) => {
			point.litAt = Infinity;
			point.lit = false;
		});
		if (carrier) {
			scheduleFor(carrier).forEach(({ index, delay }) => {
				points[index].litAt = time + delay;
			});
		}
		appliedCarrier = carrier;
	};

	const drawThread = (
		from: { x: number; y: number },
		to: { x: number; y: number },
		ease: number,
		alpha: number
	) => {
		const nx = -(to.y - from.y);
		const ny = to.x - from.x;
		const length = Math.hypot(nx, ny) || 1;
		const bow = 10 * (1 - ease);
		ctx.beginPath();
		ctx.moveTo(from.x, from.y);
		ctx.quadraticCurveTo(
			(from.x + to.x) / 2 + (nx / length) * bow,
			(from.y + to.y) / 2 + (ny / length) * bow,
			to.x,
			to.y
		);
		ctx.strokeStyle = `rgba(226, 152, 142, ${alpha.toFixed(3)})`;
		ctx.lineWidth = 0.8 + 0.7 * ease;
		ctx.stroke();
	};

	const render = (timeMs: number) => {
		const time = timeMs / 1000;
		const delta = Math.min(
			0.05,
			previousTime ? time - previousTime : 0.016
		);
		previousTime = time;
		const still = isStill();

		ctx.clearRect(0, 0, width, height);

		if (carrier !== appliedCarrier) {
			applyCarrier(time);
		}

		let litSum = 0;
		for (const point of points) {
			if (time > point.litAt) {
				if (!point.lit) {
					point.lit = true;
					point.flare = 1;
				}
				point.glow += (1 - point.glow) * Math.min(1, delta * 4);
			} else if (point.glow > 0) {
				point.glow *= Math.max(
					0,
					1 - delta * (0.7 + (point.phase % 1) * 0.45)
				);
				if (point.glow < 0.004) {
					point.glow = 0;
					point.flare = 0;
				}
			}
			// The flare burns out on its own; the lamp point stays.
			if (point.flare > 0) {
				point.flare = Math.max(
					0,
					point.flare -
						delta / (1.5 * (0.9 + (point.phase % 1) * 0.2))
				);
			}
			litSum += point.glow;
		}

		const litFraction = points.length
			? Math.min(1, litSum / (points.length * 0.35))
			: 0;
		const targetDim = carrier ? Math.max(0.25, litFraction) : litFraction;
		dim += (targetDim - dim) * Math.min(1, delta * 1.6);
		if (dim > 0.01) {
			ctx.fillStyle = `rgba(52, 2, 7, ${(0.62 * dim).toFixed(3)})`;
			ctx.fillRect(0, 0, width, height);
		}

		if (heroEnabled) {
			if (hero.hold < 1) {
				const nearPointer =
					pointer.inside &&
					Math.hypot(hero.x - pointer.x, hero.y - pointer.y) < 64;
				if (nearPointer) {
					hero.hold = Math.min(1, hero.hold + delta * 0.7);
					if (!hero.links) {
						hero.links = points
							.slice()
							.sort(
								(a, b) =>
									Math.hypot(a.x - hero.x, a.y - hero.y) -
									Math.hypot(b.x - hero.x, b.y - hero.y)
							)
							.slice(0, 6);
					}
				} else {
					hero.hold = Math.max(0, hero.hold - delta * 0.45);
					if (hero.hold === 0) {
						hero.links = null;
					}
				}

				if (!still) {
					const speed = 1 - hero.hold;
					hero.angle += Math.sin(time * 0.63) * 0.3 * delta;
					hero.x += Math.cos(hero.angle) * HERO_SPEED * delta * speed;
					hero.y += Math.sin(hero.angle) * HERO_SPEED * delta * speed;
					const pad = 22;
					if (hero.x < pad) {
						hero.x = pad;
						hero.angle = Math.PI - hero.angle;
					} else if (hero.x > width - pad) {
						hero.x = width - pad;
						hero.angle = Math.PI - hero.angle;
					}
					if (hero.y < pad) {
						hero.y = pad;
						hero.angle = -hero.angle;
					} else if (hero.y > height - pad) {
						hero.y = height - pad;
						hero.angle = -hero.angle;
					}
				}

				if (hero.hold >= 1) {
					held.push({
						x: hero.x,
						y: hero.y,
						links: (hero.links ?? []) as typeof points
					});
					if (held.length > MAX_HELD) {
						held.shift();
					}
					hero = spawnHero();
				}
			}
			if (!still) {
				hero.ring += delta * 1.3;
			}

			ctx.lineCap = 'round';
			held.forEach((entry) =>
				entry.links.forEach((point) =>
					drawThread(point, entry, 1, 0.22)
				)
			);
			if (hero.links) {
				hero.links.forEach((point, index) => {
					const ease = Math.max(
						0,
						Math.min(1, hero.hold * 6 - index * 0.7)
					);
					if (ease > 0.01) {
						drawThread(point, hero, ease, 0.05 + 0.26 * ease);
					}
				});
			}
		}

		// The pointer is a torch on the dot field: dots under it lighten and
		// grow a touch, falling off with the square of the distance so the
		// light has a soft core and a quick edge.
		const torchX = pointer.inside ? pointer.x : -9999;
		const torchY = pointer.inside ? pointer.y : -9999;

		for (const point of points) {
			const distance = heroEnabled
				? Math.hypot(point.x - hero.x, point.y - hero.y)
				: Infinity;
			const torchDistance = Math.hypot(
				point.x - torchX,
				point.y - torchY
			);
			const torch =
				torchDistance < TORCH_RADIUS
					? (1 - torchDistance / TORCH_RADIUS) ** 2
					: 0;
			// `near` (the wandering point's halo) is a hint; the torch is light.
			const near = Math.max(0, 1 - distance / HERO_RADIUS);
			const lit = Math.max(near * 0.5, torch);
			const breathing = still
				? 1
				: 0.93 + 0.07 * Math.sin(time * 7 + point.phase);
			const glow =
				point.glow > 0 ? Math.min(1, point.glow) * breathing : 0;
			// Ease-out: the afterglow holds, then lets go.
			const flare =
				Math.sin(Math.min(1, point.flare) * (Math.PI / 2)) *
				Math.min(1, point.glow * 2);

			if (flare > 0.02) {
				const radius = 9 + 7 * flare;
				ctx.globalAlpha = Math.min(1, flare * 0.95);
				ctx.drawImage(
					sprite,
					point.x - radius,
					point.y - radius,
					radius * 2,
					radius * 2
				);
				ctx.globalAlpha = 1;
			}

			ctx.beginPath();
			ctx.arc(
				point.x,
				point.y,
				1.2 + 0.9 * lit + 0.4 * glow,
				0,
				Math.PI * 2
			);
			// Resting dots darken along with the surface.
			const shade = 1 - 0.55 * dim;
			ctx.fillStyle = `rgba(${Math.round(158 * shade)}, ${Math.round(
				4 * shade
			)}, ${Math.round(16 * shade)}, ${(0.66 + 0.2 * (1 - lit)).toFixed(
				2
			)})`;
			ctx.fill();

			if (lit > 0.02) {
				ctx.beginPath();
				ctx.arc(point.x, point.y, 1.2 + 0.9 * lit, 0, Math.PI * 2);
				ctx.fillStyle = `rgba(255, 224, 218, ${(0.85 * lit).toFixed(3)})`;
				ctx.fill();
			}
			if (glow > 0.02) {
				ctx.beginPath();
				ctx.arc(point.x, point.y, 0.8 + 0.9 * glow, 0, Math.PI * 2);
				ctx.fillStyle = `rgba(${TINT.dot}, ${(0.92 * glow).toFixed(3)})`;
				ctx.fill();
			}
		}

		if (heroEnabled) {
			held.forEach((entry) => {
				ctx.beginPath();
				ctx.arc(entry.x, entry.y, 3.2, 0, Math.PI * 2);
				ctx.fillStyle = 'rgba(255, 232, 226, 0.65)';
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
			halo.addColorStop(0, 'rgba(255, 236, 228, 0.15)');
			halo.addColorStop(1, 'rgba(255, 236, 228, 0)');
			ctx.fillStyle = halo;
			ctx.fillRect(
				hero.x - HERO_RADIUS,
				hero.y - HERO_RADIUS,
				HERO_RADIUS * 2,
				HERO_RADIUS * 2
			);

			const pulse = still ? 1 : 1 + 0.15 * Math.sin(time * 2.2);
			ctx.beginPath();
			ctx.arc(hero.x, hero.y, 4.4 * pulse, 0, Math.PI * 2);
			ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
			ctx.fill();
			ctx.beginPath();
			ctx.arc(
				hero.x,
				hero.y,
				13 + 4 * hero.hold,
				hero.ring,
				hero.ring + 1.4 + 4.7 * hero.hold
			);
			ctx.strokeStyle = `rgba(255, 255, 255, ${(
				0.16 +
				0.4 * hero.hold
			).toFixed(3)})`;
			ctx.lineWidth = 1.4;
			ctx.stroke();
		}

		if (!firstFramePainted) {
			firstFramePainted = true;
			options.onFirstFrame?.();
		}

		frame = requestAnimationFrame(render);
	};

	frame = requestAnimationFrame(render);

	return {
		setCarrier: (next) => {
			carrier = next;
		},
		setHeroEnabled: (enabled) => {
			heroEnabled = enabled;
		},
		prewarm: (next) => {
			if (next) {
				scheduleFor(next);
				return;
			}
			presenceList.forEach((entry) => scheduleFor(entry.id));
		},
		destroy: () => {
			cancelAnimationFrame(frame);
			window.clearTimeout(resizeTimer);
			resizeObserver?.disconnect();
			window.removeEventListener('resize', refit);
			container.removeEventListener('mousemove', handlePointerMove);
			container.removeEventListener('mouseleave', handlePointerLeave);
		}
	};
};
