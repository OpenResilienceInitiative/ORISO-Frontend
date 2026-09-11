import { trackStagePointer } from '../pointer';
import { StageEffectContext, StageEffect } from '../types';
import crackMask from '../../../../resources/img/stage/cracks-mask.webp';

/**
 * The crack network is tinted in code, not in the asset.
 *
 * The delivered PNG was 176 kB of RGBA whose colour channel was one flat rosé
 * value — all the information was in the alpha. Shipping the alpha alone as
 * WebP costs 47 kB, and the tint becomes a token, so a tenant with a different
 * primary colour no longer gets Caritas rosé baked into its login screen.
 */
const CRACK_TINT = 'rgb(255, 236, 230)';

/** Radius of the cursor light cone that reveals the base network. */
const CONE_RADIUS = 210;
/** Slightly wider cone for the second, uncovered generation. */
const BRANCH_CONE_RADIUS = 240;
/** Below this pointer speed (CSS px/s) the cursor counts as dwelling. */
const DWELL_SPEED = 40;

const coneGradient = (
	ctx: CanvasRenderingContext2D,
	x: number,
	y: number,
	radius: number,
	midStop: number
) => {
	const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
	gradient.addColorStop(0, 'rgba(0,0,0,1)');
	gradient.addColorStop(midStop, 'rgba(0,0,0,0.55)');
	gradient.addColorStop(1, 'rgba(0,0,0,0)');
	ctx.fillStyle = gradient;
	ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
};

/**
 * "Uncovering Cracks" (design 2d).
 *
 * One PNG texture and three canvas passes — no runtime crack geometry, no
 * WebGL, no library. The surface reads as blank until the cursor light cone
 * passes over it; dwelling in one spot grows a reveal mask that uncovers a
 * second, mirrored and enlarged generation of finer cracks for good, so
 * exploring the stage builds up structure instead of resetting it.
 */
export const createCracksEffect = ({
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

	const tracker = trackStagePointer(host);
	const image = new Image();
	let ready = false;
	image.decoding = 'async';
	image.onload = () => {
		ready = true;
	};
	image.src = crackMask;

	const offscreen = () => {
		const surface = document.createElement('canvas');
		surface.width = width;
		surface.height = height;
		return surface;
	};
	const reveal = offscreen();
	const scratch = offscreen();
	const revealCtx = reveal.getContext('2d');
	const scratchCtx = scratch.getContext('2d');
	if (!revealCtx || !scratchCtx) {
		tracker.destroy();
		return null;
	}

	// Cover-fit; the `branch` pass is mirrored and enlarged so the second
	// generation does not simply repeat the first.
	//
	// The asset is a luminance mask, so it is drawn first and then used to
	// keep only the matching part of a flat tint fill.
	const drawTexture = (
		target: CanvasRenderingContext2D,
		branch: boolean
	) => {
		const scale =
			Math.max(width / image.width, height / image.height) *
			(branch ? 1.42 : 1);
		const w = image.width * scale;
		const h = image.height * scale;
		target.save();
		if (branch) {
			target.translate(width, 0);
			target.scale(-1, 1);
		}
		target.drawImage(
			image,
			(width - w) / 2 + (branch ? 26 : 0),
			(height - h) / 2 - (branch ? 40 : 0),
			w,
			h
		);
		target.restore();
		// The asset carries white pixels with the crack network in its alpha,
		// so `source-in` recolours exactly those pixels and leaves the gaps
		// transparent. (Shipping the alpha as a greyscale image instead made
		// the whole rectangle opaque, and the tint covered the entire stage.)
		target.globalCompositeOperation = 'source-in';
		target.fillStyle = CRACK_TINT;
		target.fillRect(0, 0, width, height);
		target.globalCompositeOperation = 'source-over';
	};

	let previous = 0;
	let dwell = 0;

	return {
		frame: (elapsed) => {
			const dt = Math.min(0.05, previous ? elapsed - previous : 0.016);
			previous = elapsed;
			ctx.clearRect(0, 0, width, height);
			if (!ready) {
				return;
			}

			tracker.update(elapsed, dt, !reducedMotion);
			const { pointer } = tracker;
			const x = pointer.x * width;
			const y = pointer.y * height;

			if (
				!reducedMotion &&
				pointer.hovering &&
				pointer.speed < DWELL_SPEED
			) {
				dwell = Math.min(1, dwell + dt * 0.55);
				revealCtx.globalAlpha = 0.05 + 0.09 * dwell;
				coneGradient(revealCtx, x, y, 34 + 78 * dwell, 0.6);
				revealCtx.globalAlpha = 1;
			} else {
				dwell = Math.max(0, dwell - dt * 0.9);
			}

			// Pass 1: the base network, visible only inside the light cone.
			scratchCtx.clearRect(0, 0, width, height);
			drawTexture(scratchCtx, false);
			scratchCtx.globalCompositeOperation = 'destination-in';
			coneGradient(scratchCtx, x, y, CONE_RADIUS, 0.55);
			scratchCtx.globalCompositeOperation = 'source-over';
			ctx.globalAlpha = 0.62 * intensity;
			ctx.drawImage(scratch, 0, 0);

			// Pass 2: the branches that dwelling has uncovered, which stay.
			scratchCtx.clearRect(0, 0, width, height);
			drawTexture(scratchCtx, true);
			scratchCtx.globalCompositeOperation = 'destination-in';
			scratchCtx.drawImage(reveal, 0, 0);
			coneGradient(scratchCtx, x, y, BRANCH_CONE_RADIUS, 0.55);
			scratchCtx.globalCompositeOperation = 'source-over';
			ctx.globalAlpha = 0.6 * intensity;
			ctx.drawImage(scratch, 0, 0);
			ctx.globalAlpha = 1;
		},
		destroy: () => {
			tracker.destroy();
			image.onload = null;
		}
	};
};
