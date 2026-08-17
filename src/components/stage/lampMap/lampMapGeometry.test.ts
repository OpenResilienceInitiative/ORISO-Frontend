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
	it('lights up nearly the whole country for Caritas', async () => {
		const { schedule } = await scheduleFor('caritas');
		expect(schedule.length / inside.length).toBeGreaterThan(0.95);
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
		// Delays step in 0.1 s per rank at pace 1.
		expect(sorted[0].delay).toBe(0);
		expect(sorted.some(({ delay }) => Math.abs(delay - 0.1) < 1e-9)).toBe(
			true
		);
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

	it('lets a slow carrier take its time', async () => {
		const [fast, slow] = await Promise.all([
			scheduleFor('via'),
			scheduleFor('raphael')
		]);
		const step = (schedule: { delay: number }[]) =>
			Math.min(
				...schedule
					.filter(({ delay }) => delay > 0)
					.map(({ delay }) => delay)
			);
		expect(step(slow.schedule)).toBeGreaterThan(step(fast.schedule) * 3);
	});
});
