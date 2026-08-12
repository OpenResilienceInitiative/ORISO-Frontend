import type { CarrierPresence, GeoPoint } from './carrierPresence';

/**
 * Outline of Germany, lon/lat, clockwise from Flensburg. Coarse on purpose:
 * it only has to read as "Germany" behind a field of dots, and every vertex
 * costs a point-in-polygon test per grid point.
 */
const BORDER: readonly GeoPoint[] = [
	[9.44, 54.79],
	[10.03, 54.68],
	[10.15, 54.33],
	[10.75, 54.31],
	[11.2, 54.41],
	[11.09, 54.17],
	[11.45, 53.93],
	[12.1, 54.18],
	[12.55, 54.47],
	[13.1, 54.35],
	[13.45, 54.6],
	[13.9, 54.45],
	[14.25, 53.93],
	[14.41, 53.28],
	[14.6, 52.62],
	[14.55, 52.35],
	[14.7, 51.9],
	[15.03, 51.28],
	[14.82, 50.87],
	[14.4, 51.05],
	[14.0, 50.83],
	[13.3, 50.58],
	[12.5, 50.39],
	[12.1, 50.32],
	[12.4, 49.75],
	[12.55, 49.35],
	[13.4, 49.05],
	[13.83, 48.77],
	[12.94, 47.72],
	[12.9, 47.6],
	[12.2, 47.7],
	[11.3, 47.44],
	[10.45, 47.55],
	[10.1, 47.37],
	[9.6, 47.53],
	[8.9, 47.65],
	[8.55, 47.8],
	[7.99, 47.55],
	[7.58, 47.59],
	[7.62, 48.32],
	[8.1, 48.98],
	[7.9, 49.05],
	[6.9, 49.21],
	[6.36, 49.47],
	[6.13, 50.03],
	[6.02, 50.75],
	[6.09, 51.18],
	[6.17, 51.42],
	[6.7, 51.87],
	[6.11, 51.86],
	[6.71, 52.23],
	[6.9, 52.44],
	[7.06, 52.64],
	[7.2, 53.24],
	[7.02, 53.4],
	[7.2, 53.68],
	[8.0, 53.72],
	[8.5, 53.87],
	[8.68, 53.89],
	[8.98, 53.9],
	[8.86, 54.29],
	[8.62, 54.9],
	[8.4, 55.05],
	[9.03, 54.87]
];

/** Equirectangular, true at 51°N — close enough for a decorative map. */
const LAT_SCALE = Math.cos((51 * Math.PI) / 180);

export interface MapProjection {
	/** Country outline in normalised 0..1 map space. */
	outline: readonly (readonly [number, number])[];
	/** Aspect ratio (width / height) of the country's bounding box. */
	aspect: number;
	/** lon/lat -> normalised 0..1 map space. */
	project: (point: GeoPoint) => readonly [number, number];
	/** Is a normalised point inside the outline? */
	contains: (x: number, y: number) => boolean;
}

export const createProjection = (): MapProjection => {
	let minX = Infinity;
	let maxX = -Infinity;
	let minY = Infinity;
	let maxY = -Infinity;

	const raw = BORDER.map(([lon, lat]) => {
		const x = lon * LAT_SCALE;
		const y = -lat;
		if (x < minX) minX = x;
		if (x > maxX) maxX = x;
		if (y < minY) minY = y;
		if (y > maxY) maxY = y;
		return [x, y] as const;
	});

	const spanX = maxX - minX;
	const spanY = maxY - minY;
	const outline = raw.map(
		([x, y]) => [(x - minX) / spanX, (y - minY) / spanY] as const
	);

	const project = ([lon, lat]: GeoPoint) =>
		[(lon * LAT_SCALE - minX) / spanX, (-lat - minY) / spanY] as const;

	const contains = (x: number, y: number) => {
		let inside = false;
		for (let i = 0, j = outline.length - 1; i < outline.length; j = i++) {
			const [xi, yi] = outline[i];
			const [xj, yj] = outline[j];
			const above = yi > y;
			const otherAbove = yj > y;
			if (
				above !== otherAbove &&
				x < ((xj - xi) * (y - yi)) / (yj - yi) + xi
			) {
				inside = !inside;
			}
		}
		return inside;
	};

	return { outline, aspect: spanX / spanY, project, contains };
};

export interface LampPoint {
	/** Canvas pixel position. */
	x: number;
	y: number;
	/** Normalised map position. */
	mapX: number;
	mapY: number;
	/** Inside the country outline? Points outside are never lit. */
	inside: boolean;
	/** Per-point phase so lamps do not breathe in lockstep. */
	phase: number;
	/** Current glow, 0..1. */
	glow: number;
	/** Time at which this lamp switches on; Infinity while unlit. */
	litAt: number;
	/** Flare that fades after switch-on, 0..1. */
	flare: number;
	lit: boolean;
}

/** Deterministic, so the dot field is identical on every load. */
const seededRandom = (seed: number) => {
	let state = seed;
	return () => {
		state = (state * 16807) % 2147483647;
		return state / 2147483647;
	};
};

export interface PointGrid {
	points: LampPoint[];
	/** Offset and size of the map inside the canvas. */
	offsetX: number;
	offsetY: number;
	width: number;
	height: number;
}

export const createPointGrid = (
	projection: MapProjection,
	canvasWidth: number,
	canvasHeight: number,
	spacing = 16
): PointGrid => {
	// Fit the country into the canvas without distorting it.
	let width = canvasWidth;
	let height = canvasWidth / projection.aspect;
	if (height > canvasHeight) {
		height = canvasHeight;
		width = canvasHeight * projection.aspect;
	}
	const offsetX = (canvasWidth - width) / 2;
	const offsetY = (canvasHeight - height) / 2;

	const random = seededRandom(20261);
	const points: LampPoint[] = [];
	for (let x = spacing * 0.6; x < canvasWidth - 3; x += spacing) {
		for (let y = spacing * 0.6; y < canvasHeight - 3; y += spacing) {
			const px = x + random() * 5 - 2.5;
			const py = y + random() * 5 - 2.5;
			const mapX = (px - offsetX) / width;
			const mapY = (py - offsetY) / height;
			points.push({
				x: px,
				y: py,
				mapX,
				mapY,
				inside:
					mapX > 0 &&
					mapX < 1 &&
					mapY > 0 &&
					mapY < 1 &&
					projection.contains(mapX, mapY),
				phase: random() * Math.PI * 2,
				glow: 0,
				litAt: Infinity,
				flare: 0,
				lit: false
			});
		}
	}

	return { points, offsetX, offsetY, width, height };
};

export interface LampSchedule {
	index: number;
	/** Seconds after switch-on at which this lamp lights up. */
	delay: number;
}

/**
 * Turns a carrier's presence into the order its lamps light up in.
 *
 * Every anchor spreads at the same pace, so an organisation with many seats
 * simply lights up from more places in parallel — which is what "bigger"
 * should look like. Points outside the country, or outside every anchor's
 * reach, are never scheduled: that is what keeps the white spots white.
 *
 * This is the expensive part of the effect (points x anchors), which is why
 * the caller builds it lazily rather than at start-up.
 */
export const buildSchedule = (
	points: readonly LampPoint[],
	presence: CarrierPresence,
	projection: MapProjection,
	stepSeconds = 0.1
): LampSchedule[] => {
	const anchors = presence.anchors.map((anchor) =>
		projection.project(anchor)
	);
	// Deterministic per carrier, so the same lamps light every time.
	const random = seededRandom(
		1 + presence.id.split('').reduce((sum, c) => sum + c.charCodeAt(0), 0)
	);

	const groups: { index: number; distance: number }[][] = anchors.map(
		() => []
	);

	points.forEach((point, index) => {
		if (!point.inside) {
			return;
		}
		let nearest = -1;
		let nearestDistance = Infinity;
		for (let a = 0; a < anchors.length; a++) {
			const [ax, ay] = anchors[a];
			const distance = Math.hypot(point.mapX - ax, point.mapY - ay);
			if (distance < nearestDistance) {
				nearestDistance = distance;
				nearest = a;
			}
		}
		if (nearest < 0 || nearestDistance > presence.reach) {
			return;
		}
		if (random() > presence.density) {
			return;
		}
		groups[nearest].push({ index, distance: nearestDistance });
	});

	const schedule: LampSchedule[] = [];
	groups.forEach((group) => {
		group
			.sort((a, b) => a.distance - b.distance)
			.forEach((entry, rank) => {
				schedule.push({
					index: entry.index,
					delay: rank * stepSeconds
				});
			});
	});
	return schedule;
};
