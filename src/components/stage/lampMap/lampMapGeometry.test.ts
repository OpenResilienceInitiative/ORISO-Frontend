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
		// The first lamps come on within the seed stagger window, not all at
		// once, and the whole country takes its time.
		expect(sorted[0].delay).toBeLessThan(2.5);
		expect(sorted[sorted.length - 1].delay).toBeGreaterThan(8);
	});

	it('staggers the seeds and jitters the lamps instead of a lockstep wave', async () => {
		const { schedule } = await scheduleFor('caritas');
		const delays = schedule.map(({ delay }) => delay);
		// With a lockstep wave every delay would be a multiple of the step;
		// here fewer than a tenth may sit on the grid.
		const onGrid = delays.filter(
			(delay) => Math.abs(delay / 0.16 - Math.round(delay / 0.16)) < 1e-6
		).length;
		expect(onGrid / delays.length).toBeLessThan(0.1);
		// And the wave does not start everywhere at t=0.
		expect(delays.filter((delay) => delay < 0.05).length).toBeLessThan(
			schedule.length * 0.02
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

	it('lets a slow carrier take its time — pace scales the whole schedule', () => {
		const fixture = {
			id: 'via' as CarrierId,
			nationwide: 0,
			clusters: [
				{ anchors: [[10.0, 53.55]] as const, reach: 0.06, share: 1 }
			],
			seeds: [[10.0, 53.55]] as const,
			pace: 1,
			note: 'test fixture'
		};
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
