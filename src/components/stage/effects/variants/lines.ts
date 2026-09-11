import { trackStagePointer } from '../pointer';
import { StageEffect, StageEffectContext } from '../types';

const LINE_COUNT = 13;
/** Horizontal resolution of the heart silhouette lookup. */
const HEART_BINS = 90;

/** Top and bottom edge of the heart curve, per horizontal bin, in -1..1 space. */
const buildHeartProfile = () => {
	const top = new Float32Array(HEART_BINS + 1).fill(9);
	const bottom = new Float32Array(HEART_BINS + 1).fill(-9);
	for (let i = 0; i <= 900; i += 1) {
		const a = (i / 900) * Math.PI * 2;
		const hx = (16 * Math.sin(a) ** 3) / 17;
		const hy =
			(13 * Math.cos(a) -
				5 * Math.cos(2 * a) -
				2 * Math.cos(3 * a) -
				Math.cos(4 * a)) /
			17;
		const bin = Math.round(((hx + 1) / 2) * HEART_BINS);
		if (bin < 0 || bin > HEART_BINS) {
			continue;
		}
		if (hy < top[bin]) {
			top[bin] = hy;
		}
		if (hy > bottom[bin]) {
			bottom[bin] = hy;
		}
	}
	return { top, bottom };
};

/**
 * "Lines" (design 3b, "Lebenslinie").
 *
 * Thirteen slow horizontal lines. Every seven to twelve seconds one of them
 * carries a single ECG beat across the stage. Near the cursor the lines part
 * around a heart silhouette — hinted at, never drawn as an outline.
 *
 * Pure canvas paths, no texture and no data: this is the lightest of the three.
 */
export const createLinesEffect = ({
	canvas,
	host,
	width,
	height,
	intensity,
	reducedMotion
}: StageEffectContext): StageEffect | null => {
	const ctx = canvas.getContext('2d');
	if (!ctx) {
		return null;
	}
	const dpr = canvas.width / Math.max(1, width);
	ctx.scale(dpr, dpr);

	const tracker = trackStagePointer(host, { smoothing: 0.08 });
	const { top, bottom } = buildHeartProfile();

	let previous = 0;
	let amplitude = 0;
	let beatLine = 3;
	let beatX = -1;
	let nextBeat = 3;

	return {
		frame: (elapsed) => {
			const dt = Math.min(0.05, previous ? elapsed - previous : 0.016);
			previous = elapsed;
			ctx.clearRect(0, 0, width, height);

			tracker.update(elapsed, dt, false);
			const { pointer } = tracker;
			const targetAmplitude = pointer.hovering ? 0.42 : 0;
			amplitude +=
				(targetAmplitude - amplitude) * (pointer.hovering ? 0.07 : 0.045);

			const radius = Math.min(width, height) * 0.26;
			const heartX = (pointer.hovering ? pointer.x : 0.5) * width;
			const heartY = (pointer.hovering ? pointer.y : 0.45) * height;
			const time = reducedMotion ? 0 : elapsed;

			if (!reducedMotion) {
				if (beatX < 0 && elapsed > nextBeat) {
					beatX = -30;
					beatLine =
						(beatLine + 3 + Math.floor(Math.random() * 4)) %
						LINE_COUNT;
				}
				if (beatX >= 0 || elapsed > nextBeat) {
					beatX += dt * 210;
					if (beatX > width + 40) {
						beatX = -1;
						nextBeat = elapsed + 7 + Math.random() * 5;
					}
				}
			}

			for (let i = 0; i < LINE_COUNT; i += 1) {
				const base = height * (0.08 + i * 0.07);
				ctx.beginPath();
				for (let x = -10; x <= width + 10; x += 5) {
					let y =
						base +
						Math.sin(x * 0.011 + time * 0.5 + i * 1.15) * 12 +
						Math.sin(x * 0.004 - time * 0.2 + i * 0.6) * 8;

					const normalized = (x - heartX) / radius;
					if (normalized > -1 && normalized < 1) {
						const bin = Math.round(
							((normalized + 1) / 2) * HEART_BINS
						);
						const edgeTop = heartY - bottom[bin] * radius;
						const edgeBottom = heartY - top[bin] * radius;
						if (
							edgeBottom > edgeTop &&
							y > edgeTop &&
							y < edgeBottom
						) {
							const goUp = y - edgeTop < edgeBottom - y;
							y +=
								((goUp ? edgeTop - 1 : edgeBottom + 1) - y) *
								amplitude;
						}
					}

					if (i === beatLine && beatX >= 0) {
						const u = (x - beatX) / 20;
						if (u > -1.6 && u < 1.6) {
							const ecg =
								u < -1
									? 0
									: u < -0.55
										? -0.25
										: u < -0.2
											? 1
											: u < 0.15
												? -0.55
												: u < 0.6
													? 0.3
													: 0;
							y -= ecg * 26;
						}
					}

					if (x === -10) {
						ctx.moveTo(x, y);
					} else {
						ctx.lineTo(x, y);
					}
				}

				const beating = i === beatLine && beatX >= 0;
				const peach = i % 3 === 1;
				ctx.strokeStyle = beating
					? `rgba(255,226,218,${(0.4 * intensity).toFixed(3)})`
					: peach
						? `rgba(255,180,168,${(0.22 * intensity).toFixed(3)})`
						: `rgba(255,255,255,${((0.09 + (i % 2) * 0.04) * intensity).toFixed(3)})`;
				ctx.lineWidth = beating ? 1.6 : peach ? 1.4 : 1.1;
				ctx.stroke();
			}
		},
		destroy: tracker.destroy
	};
};
