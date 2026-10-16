/**
 * The national border as longitude / latitude, clockwise from Flensburg.
 * Coarse on purpose — it is a silhouette behind a red surface, not a map.
 * ~64 points, about 1 kB before compression.
 */
export const GERMAN_BORDER: [number, number][] = [
	[9.44, 54.79], [10.03, 54.68], [10.15, 54.33], [10.75, 54.31],
	[11.2, 54.41], [11.09, 54.17], [11.45, 53.93], [12.1, 54.18],
	[12.55, 54.47], [13.1, 54.35], [13.45, 54.6], [13.9, 54.45],
	[14.25, 53.93], [14.41, 53.28], [14.6, 52.62], [14.55, 52.35],
	[14.7, 51.9], [15.03, 51.28], [14.82, 50.87], [14.4, 51.05],
	[14.0, 50.83], [13.3, 50.58], [12.5, 50.39], [12.1, 50.32],
	[12.4, 49.75], [12.55, 49.35], [13.4, 49.05], [13.83, 48.77],
	[12.94, 47.72], [12.9, 47.6], [12.2, 47.7], [11.3, 47.44],
	[10.45, 47.55], [10.1, 47.37], [9.6, 47.53], [8.9, 47.65],
	[8.55, 47.8], [7.99, 47.55], [7.58, 47.59], [7.62, 48.32],
	[8.1, 48.98], [7.9, 49.05], [6.9, 49.21], [6.36, 49.47],
	[6.13, 50.03], [6.02, 50.75], [6.09, 51.18], [6.17, 51.42],
	[6.7, 51.87], [6.11, 51.86], [6.71, 52.23], [6.9, 52.44],
	[7.06, 52.64], [7.2, 53.24], [7.02, 53.4], [7.2, 53.68],
	[8.0, 53.72], [8.5, 53.87], [8.68, 53.89], [8.98, 53.9],
	[8.86, 54.29], [8.62, 54.9], [8.4, 55.05], [9.03, 54.87]
];

export interface BorderProjection {
	/** Border in normalised 0..1 map space. */
	outline: [number, number][];
	/** Project a lon/lat pair into the same 0..1 space. */
	project: (lon: number, lat: number) => [number, number];
	/** Width / height of the projected country. */
	aspect: number;
}

/**
 * Equirectangular projection with the scale factor taken at 51° N, which is
 * close enough for a silhouette and costs one cosine instead of a library.
 */
export const projectGermanBorder = (): BorderProjection => {
	const latScale = Math.cos((51 * Math.PI) / 180);
	let minX = Infinity;
	let maxX = -Infinity;
	let minY = Infinity;
	let maxY = -Infinity;

	const projected = GERMAN_BORDER.map(([lon, lat]) => {
		const x = lon * latScale;
		const y = -lat;
		if (x < minX) minX = x;
		if (x > maxX) maxX = x;
		if (y < minY) minY = y;
		if (y > maxY) maxY = y;
		return [x, y] as [number, number];
	});

	const normalise = ([x, y]: [number, number]): [number, number] => [
		(x - minX) / (maxX - minX),
		(y - minY) / (maxY - minY)
	];

	return {
		outline: projected.map(normalise),
		project: (lon, lat) => normalise([lon * latScale, -lat]),
		aspect: (maxX - minX) / (maxY - minY)
	};
};

/** Even-odd point-in-polygon against the normalised outline. */
export const isInsideBorder = (
	outline: [number, number][],
	x: number,
	y: number
): boolean => {
	let inside = false;
	for (let i = 0, j = outline.length - 1; i < outline.length; j = i++) {
		const [xi, yi] = outline[i];
		const [xj, yj] = outline[j];
		const straddles = (yi > y) !== (yj > y);
		if (straddles && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
			inside = !inside;
		}
	}
	return inside;
};
