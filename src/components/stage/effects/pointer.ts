export interface StagePointer {
	/** Smoothed position in 0..1 of the host box. */
	x: number;
	y: number;
	/** Pointer speed in CSS px/s — the cracks effect uses it to detect dwelling. */
	speed: number;
	hovering: boolean;
}

export interface StagePointerTracker {
	pointer: StagePointer;
	/** Advance the smoothing. Call once per frame before drawing. */
	update: (elapsedSeconds: number, dt: number, drift: boolean) => void;
	destroy: () => void;
}

/**
 * Pointer tracking shared by every stage effect: a lerped position, a speed
 * read-out, and a slow idle drift so the stage is not dead when nobody is
 * pointing at it.
 *
 * Kept out of the individual effect modules so switching effects does not
 * duplicate this in every chunk.
 */
export const trackStagePointer = (
	host: HTMLElement,
	options: { smoothing?: number } = {}
): StagePointerTracker => {
	const smoothing = options.smoothing ?? 0.07;
	const target = { x: 0.32, y: 0.26 };
	const pointer: StagePointer = {
		x: 0.32,
		y: 0.26,
		speed: 0,
		hovering: false
	};

	const onMove = (event: PointerEvent) => {
		const rect = host.getBoundingClientRect();
		if (!rect.width || !rect.height) {
			return;
		}
		target.x = (event.clientX - rect.left) / rect.width;
		target.y = (event.clientY - rect.top) / rect.height;
		pointer.hovering = true;
	};
	const onLeave = () => {
		pointer.hovering = false;
	};

	// Pointer events rather than mouse events: a stylus should light the stage
	// too, and a touch never reaches here because the effect is desktop-only.
	host.addEventListener('pointermove', onMove);
	host.addEventListener('pointerleave', onLeave);

	return {
		pointer,
		update: (elapsedSeconds, dt, drift) => {
			let tx = target.x;
			let ty = target.y;
			if (!pointer.hovering && drift) {
				tx = 0.34 + 0.2 * Math.sin(elapsedSeconds * 0.14);
				ty = 0.3 + 0.18 * Math.sin(elapsedSeconds * 0.09 + 1.7);
			}

			const previousX = pointer.x;
			const previousY = pointer.y;
			pointer.x += (tx - pointer.x) * smoothing;
			pointer.y += (ty - pointer.y) * smoothing;

			const rect = host.getBoundingClientRect();
			pointer.speed =
				Math.hypot(
					(pointer.x - previousX) * rect.width,
					(pointer.y - previousY) * rect.height
				) / Math.max(0.001, dt);
		},
		destroy: () => {
			host.removeEventListener('pointermove', onMove);
			host.removeEventListener('pointerleave', onLeave);
		}
	};
};
