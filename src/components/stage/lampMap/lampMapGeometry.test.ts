import { describe, expect, it } from 'vitest';
import { loadCarrierPresence, type CarrierId } from './carrierPresence';
import {
	buildSchedule,
	createPointGrid,
	createProjection
} from './lampMapGeometry';

/**
 * The spread of design 5b, pinned so the picture cannot silently drift back
 * to a sparse, gappy map: Caritas is the whole country, the specialists are
 * islands, and every carrier's lights travel outward from its seed cities.
 */

const projection = createProjection();
// Roughly the stage at 1440px: 40vw x 100vh.
const grid = createPointGrid(projection, 576, 900);
const inside = grid.points.filter((point) => point.inside);

/**
 * One seed, so seed staggering shifts the whole wave by a single constant and
 * cannot be mistaken for per-lamp jitter.
 */
const ONE_SEED = {
	id: 'via' as CarrierId,
	nationwide: 0,
	clusters: [{ anchors: [[10.0, 53.55]] as const, reach: 0.09, share: 1 }],
	seeds: [[10.0, 53.55]] as const,
	pace: 1,
	note: 'test fixture'
};

const scheduleFor = async (id: CarrierId) => {
	const presence = (await loadCarrierPresence()).find(
		(entry) => entry.id === id
	);
	if (!presence) {
		throw new Error(`no presence for ${id}`);
	}
	return {
		presence,
		schedule: buildSchedule(grid.points, presence, projection)
	};
};

describe('buildSchedule (design 5b)', () => {
	it('lights most of the country for Caritas — thick in the west and south, thin in the north-east', async () => {
		const { schedule } = await scheduleFor('caritas');
		expect(schedule.length / inside.length).toBeGreaterThan(0.55);
		const lit = new Set(schedule.map(({ index }) => index));
		const share = (pick: (p: (typeof inside)[number]) => boolean) => {
			const region = grid.points.filter((p) => p.inside && pick(p));
			return (
				region.filter((p) => lit.has(grid.points.indexOf(p))).length /
				region.length
			);
		};
		// map space: x 0..1 west→east, y 0..1 north→south
		const west = share((p) => p.mapX < 0.35 && p.mapY > 0.35);
		const south = share((p) => p.mapY > 0.65);
		const northEast = share((p) => p.mapX > 0.55 && p.mapY < 0.4);
		expect(west).toBeGreaterThan(northEast * 1.5);
		expect(south).toBeGreaterThan(northEast * 1.5);
	});

	it('lets a thin seed group come on slower than a thick one', async () => {
		const { presence, schedule } = await scheduleFor('caritas');
		const seeds = presence.seeds.map((seed) => projection.project(seed));
		// group every scheduled lamp by its nearest seed and measure the
		// spacing between consecutive lamps of that group
		const bySeed = new Map<number, number[]>();
		schedule.forEach(({ index, delay }) => {
			const point = grid.points[index];
			let nearest = 0;
			let best = Infinity;
			seeds.forEach(([sx, sy], i) => {
				const d = Math.hypot(point.mapX - sx, point.mapY - sy);
				if (d < best) {
					best = d;
					nearest = i;
				}
			});
			bySeed.set(nearest, [...(bySeed.get(nearest) ?? []), delay]);
		});
		const spacing = (delays: number[]) => {
			const sorted = delays.slice().sort((a, b) => a - b);
			return (
				(sorted[sorted.length - 1] - sorted[0]) /
				Math.max(1, sorted.length - 1)
			);
		};
		const groups = [...bySeed.values()].filter((d) => d.length > 3);
		groups.sort((a, b) => a.length - b.length);
		const thin = spacing(groups[0]);
		const thick = spacing(groups[groups.length - 1]);
		expect(thin).toBeGreaterThan(thick * 1.5);
	});

	it('keeps the specialist service a handful of islands', async () => {
		const { schedule } = await scheduleFor('raphael');
		expect(schedule.length / inside.length).toBeLessThan(0.2);
		expect(schedule.length).toBeGreaterThan(0);
	});

	it('orders each carrier from nationwide down to specialist', async () => {
		const sizes = await Promise.all(
			(
				[
					'caritas',
					'malteser',
					'kreuzbund',
					'skf',
					'skm',
					'via',
					'raphael'
				] as CarrierId[]
			).map(async (id) => (await scheduleFor(id)).schedule.length)
		);
		for (let i = 1; i < sizes.length; i++) {
			expect(sizes[i]).toBeLessThan(sizes[i - 1]);
		}
	});

	it('never schedules a point outside the country', async () => {
		const { schedule } = await scheduleFor('caritas');
		schedule.forEach(({ index }) => {
			expect(grid.points[index].inside).toBe(true);
		});
	});

	it('schedules each lamp at most once', async () => {
		const { schedule } = await scheduleFor('malteser');
		const indices = schedule.map(({ index }) => index);
		expect(new Set(indices).size).toBe(indices.length);
	});

	it('spreads outward from the seed cities, nearest first', async () => {
		const { presence, schedule } = await scheduleFor('caritas');
		const seeds = presence.seeds.map((seed) => projection.project(seed));
		const nearestSeedDistance = (index: number) => {
			const point = grid.points[index];
			return Math.min(
				...seeds.map(([sx, sy]) =>
					Math.hypot(point.mapX - sx, point.mapY - sy)
				)
			);
		};
		// Lamps that come on first sit closer to a seed than the last ones.
		const sorted = schedule.slice().sort((a, b) => a.delay - b.delay);
		const first = sorted.slice(0, 40);
		const last = sorted.slice(-40);
		const mean = (list: typeof sorted) =>
			list.reduce(
				(sum, { index }) => sum + nearestSeedDistance(index),
				0
			) / list.length;
		expect(mean(first)).toBeLessThan(mean(last));
		// The first lamps come on within the seed stagger window, not all at
		// once, and the whole country takes its time.
		expect(sorted[0].delay).toBeLessThan(2.5);
		expect(sorted[sorted.length - 1].delay).toBeGreaterThan(8);
		expect(sorted[sorted.length - 1].delay).toBeLessThan(30);
	});

	it('jitters the individual lamps of one wave', () => {
		const schedule = buildSchedule(grid.points, ONE_SEED, projection);
		expect(schedule.length).toBeGreaterThan(10);
		// One seed, so its start time is a single constant; stripping the
		// lockstep part leaves the per-lamp jitter and nothing else.
		const offsets = schedule.map(({ delay }, rank) => delay - rank * 0.1);
		expect(Math.max(...offsets) - Math.min(...offsets)).toBeGreaterThan(
			0.05
		);
		const unique = new Set(offsets.map((offset) => offset.toFixed(6)));
		expect(unique.size).toBeGreaterThan(offsets.length * 0.5);
	});

	it('staggers the seeds against each other', async () => {
		const { presence, schedule } = await scheduleFor('caritas');
		const seeds = presence.seeds.map((seed) => projection.project(seed));
		const groups = seeds.map(() => [] as number[]);
		schedule.forEach(({ index, delay }) => {
			const point = grid.points[index];
			let nearest = 0;
			let best = Infinity;
			seeds.forEach(([sx, sy], i) => {
				const d = Math.hypot(point.mapX - sx, point.mapY - sy);
				if (d < best) {
					best = d;
					nearest = i;
				}
			});
			groups[nearest].push(delay);
		});

		// A lamp's own jitter is at most 0.35s x pace x its group's slowdown,
		// and the slowdown is at most 3. So a wave whose *first* lamp lands
		// later than that bound can only have been started late — which is
		// what the seed stagger does.
		const bound = 0.35 * presence.pace * 3;
		const startsLate = groups
			.filter((group) => group.length > 0)
			.filter((group) => Math.min(...group) > bound);
		expect(startsLate.length).toBeGreaterThan(0);
	});

	it('never lights the whole country at once', async () => {
		const { schedule } = await scheduleFor('caritas');
		expect(
			schedule.filter(({ delay }) => delay < 0.05).length
		).toBeLessThan(schedule.length * 0.02);
	});

	it('lights a seedless carrier all at once', () => {
		const schedule = buildSchedule(
			grid.points,
			{
				id: 'caritas',
				nationwide: 0.5,
				clusters: [],
				seeds: [],
				pace: 1,
				note: 'test fixture'
			},
			projection
		);
		expect(schedule.length).toBeGreaterThan(0);
		expect(schedule.every(({ delay }) => delay === 0)).toBe(true);
	});

	it('lets a slow carrier take its time — pace scales the whole schedule', () => {
		const fixture = ONE_SEED;
		const one = buildSchedule(grid.points, fixture, projection);
		const three = buildSchedule(
			grid.points,
			{ ...fixture, pace: 3 },
			projection
		);
		expect(three.length).toBe(one.length);
		one.forEach((entry, i) => {
			expect(three[i].index).toBe(entry.index);
			expect(three[i].delay).toBeCloseTo(entry.delay * 3, 9);
		});
	});
});
