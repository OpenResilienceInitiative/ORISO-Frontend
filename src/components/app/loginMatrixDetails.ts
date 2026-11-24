type Point = { x: number; y: number };

const progress = (value: number) => Math.max(0, Math.min(1, value));

/** Sample clockwise so each glyph takes the place of a piece of the outline. */
function contour(width: number, height: number, radius: number): Point[] {
	const r = Math.min(radius, width / 2, height / 2);
	const centers = [
		[width - r, r],
		[width - r, height - r],
		[r, height - r],
		[r, r]
	];
	const corners = centers.flatMap(([x, y], corner) =>
		Array.from({ length: 5 }, (_, step) => {
			const angle = ((corner - 1 + step / 4) * Math.PI) / 2;
			return { x: x + Math.cos(angle) * r, y: y + Math.sin(angle) * r };
		})
	);
	const length = (a: Point, b: Point) => Math.hypot(b.x - a.x, b.y - a.y);
	const ends = corners.map((a, i) => corners[(i + 1) % corners.length]);
	const perimeter = corners.reduce(
		(sum, a, i) => sum + length(a, ends[i]),
		0
	);
	const count = Math.max(1, Math.round(perimeter / 9));
	let edge = 0;
	let passed = 0;
	return Array.from({ length: count }, (_, i) => {
		const target = (perimeter * i) / count;
		let a = corners[edge];
		let b = ends[edge];
		while (edge < ends.length - 1 && passed + length(a, b) <= target) {
			passed += length(a, b);
			edge++;
			a = corners[edge];
			b = ends[edge];
		}
		const part = (target - passed) / (length(a, b) || 1);
		return { x: a.x + (b.x - a.x) * part, y: a.y + (b.y - a.y) * part };
	});
}

/** Keep the same grid and repaint only the few cells that change each beat. */
function digitPattern(context: CanvasRenderingContext2D, color: string) {
	const tile = document.createElement('canvas');
	tile.width = 132;
	tile.height = 154;
	const ink = tile.getContext('2d');
	if (!ink) return () => null;
	ink.font = '500 8px monospace';
	ink.textAlign = 'center';
	ink.textBaseline = 'middle';
	ink.fillStyle = color;
	const band = (index: number, beat: number) =>
		(Math.floor((index + beat) / 29) ^ Math.floor(index / 29)) & 1;
	let previous = -1;
	let pattern: CanvasPattern | null = null;
	return (beat: number) => {
		if (beat === previous) return pattern;
		for (let index = 0; index < 132; index++) {
			const change = band(index, beat);
			if (previous >= 0 && change === band(index, previous)) continue;
			const row = Math.floor(index / 12);
			const column = index % 12;
			const seed = row * 47 + column * 13 + row * column * 11;
			const x = column * 11;
			const y = row * 14;
			ink.clearRect(x, y, 11, 14);
			ink.globalAlpha = 0.36 + (seed % 7) * 0.069;
			ink.fillText(String(Number(seed % 5 < 2) ^ change), x + 5.5, y + 7);
		}
		previous = beat;
		pattern = context.createPattern(tile, 'repeat');
		return pattern;
	};
}

/** Only the sheet's decorative ink lives on canvas. Its text stays in the DOM. */
export function startLoginMatrixDetails(
	canvas: HTMLCanvasElement,
	form: HTMLElement
) {
	const context = canvas.getContext('2d');
	if (!context) return { paint: () => undefined, stop: () => undefined };

	const fields = [...form.querySelectorAll('.MuiOutlinedInput-root')].filter(
		(node) => !node.closest('.loginForm__otp:not(.loginForm__otp--active)')
	);
	const button = form.querySelector(
		'button[type="submit"], .loginForm__actions button'
	);
	const frames = button ? [button, ...fields] : fields;
	const icons = fields.flatMap((field) => [
		...field.querySelectorAll('.MuiInputAdornment-positionStart svg')
	]);
	const sheet = form.closest('.stageLayout__contentWrapper');
	const exclusions = [
		form,
		...(sheet?.querySelectorAll(
			'.stageLayout__header, .stageLayout__footer'
		) ?? [])
	];

	function measure() {
		const view = canvas.getBoundingClientRect();
		const local = (element: Element) => {
			const rect = element.getBoundingClientRect();
			return new DOMRect(
				rect.left - view.left,
				rect.top - view.top,
				rect.width,
				rect.height
			);
		};
		// These six-pixel ornamental characters don't need a full retina bitmap.
		canvas.width = Math.round(view.width);
		canvas.height = Math.round(view.height);
		return {
			ink: getComputedStyle(canvas).color,
			reserved: exclusions
				.map(local)
				.filter((box) => box.width && box.height),
			icons: icons.map((node) => ({ node, box: local(node) })),
			rings: frames.map((node) => {
				const box = local(node);
				const legend = node.querySelector('legend');
				const radius =
					parseFloat(getComputedStyle(node).borderTopLeftRadius) || 0;
				return {
					node,
					notch: legend && local(legend),
					dots: contour(box.width, box.height, radius).map(
						({ x, y }) => ({
							x: box.x + x,
							y: box.y + y
						})
					)
				};
			})
		};
	}

	let scene = measure();
	let tile = digitPattern(context, scene.ink);
	let dirty = false;
	const observer =
		typeof ResizeObserver === 'function'
			? new ResizeObserver(() => {
					dirty = true;
				})
			: undefined;
	observer?.observe(canvas);
	observer?.observe(form);

	return {
		paint(elapsed: number, beat: number) {
			if (elapsed < 950) return;
			if (dirty) {
				dirty = false;
				scene = measure();
				tile = digitPattern(context, scene.ink);
			}
			const { width, height } = canvas;
			context.clearRect(0, 0, width, height);
			const spread = progress((elapsed - 1230) / 740);
			if (spread) {
				const pattern = tile(beat);
				if (pattern) {
					context.save();
					for (const rect of scene.reserved) {
						context.beginPath();
						context.rect(0, 0, width, height);
						context.rect(
							rect.x - 4,
							rect.y - 4,
							rect.width + 8,
							rect.height + 8
						);
						context.clip('evenodd');
					}
					context.beginPath();
					// Grow inward from all four edges, leaving the reserved content clear.
					const insetX = (width * spread) / 2;
					const insetY = (height * spread) / 2;
					context.rect(0, 0, width, height);
					context.rect(
						insetX,
						insetY,
						width * (1 - spread),
						height * (1 - spread)
					);
					context.fillStyle = pattern;
					context.globalAlpha = 0.19 * Math.min(1, spread * 3);
					context.fill('evenodd');
					context.restore();
				}
			}

			context.fillStyle = scene.ink;
			context.textAlign = 'center';
			context.textBaseline = 'middle';
			context.font = '600 6px monospace';
			for (const [group, { node, box }] of scene.icons.entries()) {
				node.toggleAttribute('data-binary-icon', true);
				const cell = Math.min(box.width, box.height) / 3;
				for (let i = 0; i < 9; i++) {
					context.globalAlpha =
						0.7 * progress((elapsed - 950 - i * 9) / 160);
					context.fillText(
						String((i + group + Math.floor(i / 3)) & 1),
						box.x + ((i % 3) + 0.5) * cell,
						box.y + (Math.floor(i / 3) + 0.5) * cell
					);
				}
			}

			context.font = '500 5px monospace';
			for (const [
				group,
				{ node, dots, notch }
			] of scene.rings.entries()) {
				const fraction = progress((elapsed - 1030 - group * 40) / 340);
				if (!fraction) continue;
				context.save();
				if (notch) {
					context.beginPath();
					context.rect(0, 0, width, height);
					context.rect(
						notch.left - 2,
						notch.top - 4,
						notch.width + 4,
						notch.height + 8
					);
					context.clip('evenodd');
				}
				if (!node.hasAttribute('data-binary-outline')) {
					node.setAttribute(
						'data-binary-outline',
						node === button ? 'button' : 'field'
					);
				}
				const count = Math.floor(fraction * dots.length);
				if (count < dots.length && node !== button) {
					context.strokeStyle = scene.ink;
					context.lineWidth = 0.7;
					context.globalAlpha = 0.34;
					context.beginPath();
					context.moveTo(dots[count].x, dots[count].y);
					for (let i = count + 1; i <= dots.length; i++) {
						const dot = dots[i % dots.length];
						context.lineTo(dot.x, dot.y);
					}
					context.stroke();
				}
				context.globalAlpha = 0.5;
				for (let i = 0; i < count; i++) {
					context.fillText(
						String((i + group + Math.floor(i / 5)) & 1),
						dots[i].x,
						dots[i].y
					);
				}
				context.restore();
			}
		},
		stop() {
			observer?.disconnect();
			for (const node of frames)
				node.removeAttribute('data-binary-outline');
			for (const node of icons) node.removeAttribute('data-binary-icon');
		}
	};
}
