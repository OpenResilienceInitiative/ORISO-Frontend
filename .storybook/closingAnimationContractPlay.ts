import { expect, userEvent, waitFor } from 'storybook/test';
import { transitionMotion } from '../src/components/transition/transitionMotion';

/**
 * The closing-animation contract (ORISO-Frontend#1737), asserted once for all
 * three designs and every waiting room: it plays, it covers before it reveals,
 * it ends on the room's focal point, it never leaves a layer behind that could
 * swallow a click, and reduced motion skips it while the person still arrives.
 *
 * Nothing here reads the implementation. It watches the DOM the way a person
 * would: layers appear on the page, they cover or uncover things, and the
 * element the person came for ends up on top.
 */

const ROOT = '[data-closing-animation]';
const FOCAL = {
	messageField: '[data-closing-focal="message-field"]',
	call: '[data-closing-focal="call"]'
} as const;
export type ContractFocal = keyof typeof FOCAL;

/** What a person can tell apart: below a few pixels a circle is "a point". */
const POINT_TOLERANCE_PX = 3;

interface Box {
	left: number;
	top: number;
	right: number;
	bottom: number;
}

interface LayerSnapshot {
	name: string;
	shape: 'rect' | 'disc';
	/** The part of the layer a person can see: clipped by every clipping ancestor. */
	visible: Box | null;
	/** Disc only: where it is centred and how wide it is. */
	disc: { x: number; y: number; radius: number } | null;
	pointerEvents: string;
	/** The colour a person sees on it, as the browser computes it. */
	background: string;
}

interface ClosingSnapshot {
	phase: string;
	rootPointerEvents: string;
	variant: string;
	at: number;
	running: number;
	layers: LayerSnapshot[];
	/** The viewport and the surface the cover is meant to close over. */
	viewport: Box;
	surface: Box | null;
	focal: Box | null;
}

const toBox = (rect: DOMRect): Box => ({
	left: rect.left,
	top: rect.top,
	right: rect.right,
	bottom: rect.bottom
});

const intersect = (a: Box, b: Box): Box | null => {
	const box = {
		left: Math.max(a.left, b.left),
		top: Math.max(a.top, b.top),
		right: Math.min(a.right, b.right),
		bottom: Math.min(a.bottom, b.bottom)
	};
	return box.right - box.left > 0.5 && box.bottom - box.top > 0.5
		? box
		: null;
};

const visibleBox = (root: HTMLElement, layer: HTMLElement): Box | null => {
	const win = layer.ownerDocument.defaultView!;
	let visible: Box | null = toBox(layer.getBoundingClientRect());
	visible = intersect(visible, {
		left: 0,
		top: 0,
		right: win.innerWidth,
		bottom: win.innerHeight
	});
	for (
		let ancestor = layer.parentElement;
		visible && ancestor && ancestor !== root.parentElement;
		ancestor = ancestor.parentElement
	) {
		if (win.getComputedStyle(ancestor).overflow !== 'visible') {
			visible = intersect(
				visible,
				toBox(ancestor.getBoundingClientRect())
			);
		}
	}
	return visible;
};

const snapshotOf = (
	doc: Document,
	root: HTMLElement,
	focal: ContractFocal
): ClosingSnapshot => {
	const win = doc.defaultView!;
	const layers = [
		...root.querySelectorAll<HTMLElement>('[data-closing-layer]')
	].map((layer): LayerSnapshot => {
		const rect = layer.getBoundingClientRect();
		const shape = layer.dataset.closingShape === 'disc' ? 'disc' : 'rect';
		return {
			name: layer.dataset.closingLayer ?? '',
			shape,
			visible: visibleBox(root, layer),
			disc:
				shape === 'disc'
					? {
							x: rect.left + rect.width / 2,
							y: rect.top + rect.height / 2,
							radius: rect.width / 2
						}
					: null,
			pointerEvents: win.getComputedStyle(layer).pointerEvents,
			background: win.getComputedStyle(layer).backgroundColor
		};
	});
	const surfaceEl = doc.querySelector('.stageLayout__content');
	const focalEl = doc.querySelector(FOCAL[focal]);
	return {
		phase: root.dataset.closingPhase ?? '',
		rootPointerEvents: win.getComputedStyle(root).pointerEvents,
		variant: root.dataset.closingAnimation ?? '',
		at: performance.now(),
		running: root
			.getAnimations({ subtree: true })
			.filter((a) => a.playState === 'running' || a.pending).length,
		layers,
		viewport: {
			left: 0,
			top: 0,
			right: win.innerWidth,
			bottom: win.innerHeight
		},
		surface: surfaceEl ? toBox(surfaceEl.getBoundingClientRect()) : null,
		focal: focalEl ? toBox(focalEl.getBoundingClientRect()) : null
	};
};

/** Where each layer's left edge stood on one frame, in the order the layers sit in the page. */
interface SweepSample {
	phase: string;
	lefts: number[];
}

export interface ClosingRecording {
	snapshots: ClosingSnapshot[];
	/** One entry per frame while the animation is on the page. */
	samples: SweepSample[];
	/** Set once the animation's root has left the page. */
	removedAt: number | null;
	stop: () => void;
}

/**
 * Starts watching the page for a closing animation. Snapshots are taken the
 * moment the root appears and every time its phase changes, which is when the
 * geometry that matters (covered, revealed) is standing still. Between those,
 * every frame is sampled, which is how a layer that trails another is seen.
 */
export const recordClosing = (
	doc: Document,
	focal: ContractFocal
): ClosingRecording => {
	const win = doc.defaultView!;
	let frame = 0;
	const recording: ClosingRecording = {
		snapshots: [],
		samples: [],
		removedAt: null,
		stop: () => {
			observer.disconnect();
			win.cancelAnimationFrame(frame);
		}
	};
	const sample = () => {
		const root = doc.querySelector<HTMLElement>(ROOT);
		if (root) {
			recording.samples.push({
				phase: root.dataset.closingPhase ?? '',
				lefts: [
					...root.querySelectorAll<HTMLElement>(
						'[data-closing-layer]'
					)
				].map((layer) => layer.getBoundingClientRect().left)
			});
		}
		frame = win.requestAnimationFrame(sample);
	};
	frame = win.requestAnimationFrame(sample);
	const take = (root: HTMLElement) =>
		recording.snapshots.push(snapshotOf(doc, root, focal));
	// The page may be a frame's document: its elements are not instances of
	// this realm's HTMLElement.
	const isRoot = (node: Node): node is HTMLElement =>
		node instanceof win.HTMLElement && node.matches(ROOT);
	const observer = new MutationObserver((records) => {
		for (const record of records) {
			if (record.type === 'attributes') {
				take(record.target as HTMLElement);
			}
			record.addedNodes.forEach((node) => {
				if (isRoot(node)) {
					take(node);
				}
			});
			record.removedNodes.forEach((node) => {
				if (isRoot(node)) {
					recording.removedAt = performance.now();
				}
			});
		}
	});
	observer.observe(doc.body, {
		childList: true,
		subtree: true,
		attributes: true,
		attributeFilter: ['data-closing-phase']
	});
	return recording;
};

const covers = (snapshot: ClosingSnapshot, area: Box) =>
	[
		[area.left + 1, area.top + 1],
		[area.right - 1, area.top + 1],
		[area.left + 1, area.bottom - 1],
		[area.right - 1, area.bottom - 1],
		[(area.left + area.right) / 2, (area.top + area.bottom) / 2]
	].every(([x, y]) =>
		snapshot.layers.some((layer) =>
			layer.disc
				? Math.hypot(x - layer.disc.x, y - layer.disc.y) <=
					layer.disc.radius
				: !!layer.visible &&
					x >= layer.visible.left &&
					x <= layer.visible.right &&
					y >= layer.visible.top &&
					y <= layer.visible.bottom
		)
	);

const phaseOf = (recording: ClosingRecording, phase: string) => {
	const found = recording.snapshots.find((s) => s.phase === phase);
	expect(found, `the animation reached its "${phase}" phase`).toBeDefined();
	return found!;
};

export interface ClosingContractOptions {
	/** Which design the tenant chose for this width. */
	variant: 'curtain' | 'circleZoom' | 'slideReveal';
	focal?: ContractFocal;
	/** The gate button, found fresh each time (the room is swapped away). */
	gate: () => HTMLElement | null;
	/**
	 * The room is swapped for its destination when the screen is covered. False
	 * leaves the room standing, to prove nothing is left over the gate.
	 */
	swaps?: boolean;
	/** The width class the story claims to be, checked against the real window. */
	width: 'desktop' | 'tablet' | 'phone';
}

const WIDTH_CLASS = {
	desktop: (w: number) => w >= 1200,
	tablet: (w: number) => w >= 520 && w < 1200,
	phone: (w: number) => w < 520
};

const gateIsReachable = (doc: Document, gate: HTMLElement) => {
	gate.scrollIntoView({ block: 'nearest' });
	const rect = gate.getBoundingClientRect();
	const hit = doc.elementFromPoint(
		rect.left + rect.width / 2,
		rect.top + rect.height / 2
	);
	return !!hit && gate.contains(hit);
};

export const verifyClosingAnimation = async (
	canvasElement: HTMLElement,
	options: ClosingContractOptions
) => {
	const doc = canvasElement.ownerDocument;
	const win = doc.defaultView!;
	const focal = options.focal ?? 'messageField';
	const swaps = options.swaps ?? true;

	// The story must really be the width it claims, or it proves nothing.
	expect(
		WIDTH_CLASS[options.width](win.innerWidth),
		`${win.innerWidth}px is a ${options.width} width`
	).toBe(true);

	const gate = await waitFor(() => {
		const found = options.gate();
		expect(found).not.toBeNull();
		expect(found!.hasAttribute('disabled')).toBe(false);
		return found!;
	});

	// Before: nothing of the animation is on the page, and the gate answers a pointer.
	expect(doc.querySelector(ROOT)).toBeNull();
	expect(gateIsReachable(doc, gate)).toBe(true);

	const recording = recordClosing(doc, focal);
	try {
		await userEvent.click(gate);

		// It plays: a root with layers appears and something on it is running.
		await waitFor(() =>
			expect(recording.snapshots.length).toBeGreaterThan(0)
		);
		const started = recording.snapshots[0];
		expect(started.variant).toBe(options.variant);
		expect(started.layers.length).toBeGreaterThan(0);
		expect(
			started.running,
			'animations are running on its layers'
		).toBeGreaterThan(0);

		// The press is answered at once: the button reads as entering.
		expect(gate.getAttribute('aria-busy')).toBe('true');

		await waitFor(() => expect(recording.removedAt).not.toBeNull(), {
			timeout: transitionMotion.closing.capMs + 2000
		});

		// It covers before it reveals: at the moment the room is swapped, the
		// whole screen (or, for the curtain, the surface plus the stage) is red.
		const covered = phaseOf(recording, 'covered');
		expect(covers(covered, covered.viewport)).toBe(true);

		// It never swallows a click: the root and every layer let pointers through.
		for (const snapshot of recording.snapshots) {
			expect(snapshot.rootPointerEvents).toBe('none');
			for (const layer of snapshot.layers) {
				expect(layer.pointerEvents).toBe('none');
			}
		}

		// It reveals, then ends on the focal point.
		const revealing = phaseOf(recording, 'reveal');
		expect(revealing.running).toBeGreaterThan(0);
		const ended = phaseOf(recording, 'revealed');

		// Each half is long enough to be seen, not a flicker with a long pause.
		expect(
			covered.at - started.at,
			'the cover takes long enough to see'
		).toBeGreaterThanOrEqual(200);
		expect(
			ended.at - revealing.at,
			'the reveal takes long enough to see'
		).toBeGreaterThanOrEqual(300);

		if (options.variant === 'slideReveal') {
			// The red swipes away as one piece, and a second red layer behind it
			// travels along a beat later: two edges, one trailing the other.
			const sweep = recording.samples.filter(
				(s) => s.phase === 'reveal' && s.lefts.length === 2
			);
			expect(sweep.length, 'the sweep was watched').toBeGreaterThan(3);
			// The layer behind sits first in the page.
			const lead = sweep.map((s) => s.lefts[1] - s.lefts[0]);
			expect(
				Math.max(...lead),
				'the second layer trails the first'
			).toBeGreaterThanOrEqual(8);
			expect(
				Math.min(...lead),
				'and never leads it'
			).toBeGreaterThanOrEqual(-1);
		}
		if (swaps) {
			expect(
				ended.focal,
				'the destination shows its focal element'
			).not.toBeNull();
			const focalBox = ended.focal!;
			const focalCentre = {
				x: (focalBox.left + focalBox.right) / 2,
				y: (focalBox.top + focalBox.bottom) / 2
			};
			if (options.variant === 'circleZoom') {
				const disc = ended.layers.find((layer) => layer.disc)?.disc;
				expect(
					disc,
					'the circle is still there at the end'
				).toBeDefined();
				expect(
					Math.hypot(disc!.x - focalCentre.x, disc!.y - focalCentre.y)
				).toBeLessThanOrEqual(POINT_TOLERANCE_PX);
				expect(disc!.radius).toBeLessThanOrEqual(POINT_TOLERANCE_PX);
			}
			for (const layer of ended.layers) {
				expect(
					layer.visible && intersect(layer.visible, focalBox),
					`layer "${layer.name}" no longer covers the focal point`
				).toBeFalsy();
			}
		}

		// Not a flash: the whole thing is a short beat, not a wait.
		const total = recording.removedAt! - started.at;
		expect(total).toBeGreaterThan(500);
		expect(total).toBeLessThan(transitionMotion.closing.capMs);

		// Afterwards nothing of it is left, and the focal point is what a pointer hits.
		expect(doc.querySelector(ROOT)).toBeNull();
		if (swaps) {
			const focalBox = ended.focal!;
			const focalEl = doc.querySelector<HTMLElement>(FOCAL[focal]);
			expect(focalEl).not.toBeNull();
			const hit = doc.elementFromPoint(
				(focalBox.left + focalBox.right) / 2,
				(focalBox.top + focalBox.bottom) / 2
			);
			expect(hit && focalEl!.contains(hit)).toBe(true);
			expect(options.gate(), 'the room has been swapped away').toBeNull();
		} else {
			// The room stayed (nothing took the person on): the gate is theirs
			// again — open, hit by a pointer, and it plays once more when pressed.
			const again = await waitFor(() => {
				const found = options.gate();
				expect(found).not.toBeNull();
				expect(found!.hasAttribute('disabled')).toBe(false);
				expect(found!.getAttribute('aria-busy')).not.toBe('true');
				return found!;
			});
			expect(gateIsReachable(doc, again)).toBe(true);
			const before = recording.snapshots.length;
			await userEvent.click(again);
			await waitFor(() =>
				expect(recording.snapshots.length).toBeGreaterThan(before)
			);
			await waitFor(() => expect(doc.querySelector(ROOT)).toBeNull(), {
				timeout: transitionMotion.closing.capMs + 2000
			});
		}
	} finally {
		recording.stop();
	}
};

/**
 * Reduced motion: nothing is drawn, nothing waits, and the person still
 * arrives. `arrived` is the destination's focal element.
 */
export const verifyClosingSkipped = async (
	canvasElement: HTMLElement,
	options: { gate: () => HTMLElement | null; focal?: ContractFocal }
) => {
	const doc = canvasElement.ownerDocument;
	const focal = options.focal ?? 'messageField';
	const gate = await waitFor(() => {
		const found = options.gate();
		expect(found).not.toBeNull();
		expect(found!.hasAttribute('disabled')).toBe(false);
		return found!;
	});
	const recording = recordClosing(doc, focal);
	try {
		const startedAt = performance.now();
		await userEvent.click(gate);
		await waitFor(
			() => expect(doc.querySelector(FOCAL[focal])).not.toBeNull(),
			{ timeout: 1500 }
		);
		expect(
			performance.now() - startedAt,
			'no animation delays the arrival'
		).toBeLessThan(1200);
		expect(recording.snapshots).toHaveLength(0);
		expect(doc.querySelector(ROOT)).toBeNull();
	} finally {
		recording.stop();
	}
};

export interface ClosingHandoverContractOptions {
	variant: 'curtain' | 'circleZoom' | 'slideReveal';
	/** The button that starts the animation in the old document (outside the frame). */
	press: () => HTMLElement | null;
	/** The frame the old document lives in; it is navigated to the new one. */
	frame: () => HTMLIFrameElement | null;
	/**
	 * The tenant's colours as the old document's palette computes them. The new
	 * document has no palette of its own, so a cover in these colours can only
	 * have been handed over.
	 */
	colours: { primary: string; primaryDark: string };
	/** False: the new document never shows the focal element. */
	destinationShowsFocal: boolean;
}

/**
 * A waiting room that replaces the whole page (the live-chat room): the closing
 * animation starts in the old document, the browser really navigates, and the
 * new document must (1) show the finished cover in its very first frame, in
 * the colours of the old one, (2) reveal onto the message field, and (3) leave
 * nothing on the page, also when the destination never shows its field.
 *
 * The harness announces the new document with a `handover-boot` event on the
 * frame, just before the app's first module would run, so the recording is
 * already watching when the cover appears.
 */
export const verifyClosingHandover = async (
	canvasElement: HTMLElement,
	options: ClosingHandoverContractOptions
) => {
	const focal: ContractFocal = 'messageField';
	const frame = await waitFor(() => {
		const found = options.frame();
		expect(found?.contentDocument?.readyState).toBe('complete');
		return found!;
	});
	const oldDocument = frame.contentDocument!;
	expect(oldDocument.querySelector(ROOT)).toBeNull();

	let next: Document | undefined;
	let recording: ClosingRecording | undefined;
	canvasElement.addEventListener(
		'handover-boot',
		(event) => {
			next = (event as CustomEvent<{ document: Document }>).detail
				.document;
			recording = recordClosing(next, focal);
		},
		{ once: true }
	);

	const press = await waitFor(() => {
		const found = options.press();
		expect(found).not.toBeNull();
		return found!;
	});
	try {
		await userEvent.click(press);

		// The browser really navigated: a different document, not the old one repainted.
		await waitFor(() => expect(next).toBeDefined(), {
			timeout: transitionMotion.closing.capMs
		});
		expect(next).not.toBe(oldDocument);
		expect(next!.URL.startsWith('blob:')).toBe(true);

		// The first thing the new document shows is the finished cover: nothing
		// is painted between the old page and the cover, and it is not played again.
		await waitFor(() =>
			expect(recording!.snapshots.length).toBeGreaterThan(0)
		);
		const first = recording!.snapshots[0];
		expect(first.variant).toBe(options.variant);
		expect(first.phase).toBe('covered');
		expect(first.running, 'the cover is not played a second time').toBe(0);
		expect(first.layers.length).toBeGreaterThan(0);
		expect(covers(first, first.viewport)).toBe(true);

		// In the colours of the old document, which this one has no palette for.
		const palette = [options.colours.primary, options.colours.primaryDark];
		for (const layer of first.layers) {
			expect(
				palette,
				`layer "${layer.name}" is painted in the tenant's colour`
			).toContain(layer.background);
		}
		expect(
			first.layers.some(
				(layer) => layer.background === options.colours.primary
			)
		).toBe(true);

		await waitFor(() => expect(recording!.removedAt).not.toBeNull(), {
			timeout: transitionMotion.closing.capMs + 2000
		});
		const startedAt = first.at;

		// It never swallows a click.
		for (const snapshot of recording!.snapshots) {
			expect(snapshot.rootPointerEvents).toBe('none');
			for (const layer of snapshot.layers) {
				expect(layer.pointerEvents).toBe('none');
			}
		}

		// It reveals, then ends on the message field.
		const revealing = phaseOf(recording!, 'reveal');
		expect(revealing.running).toBeGreaterThan(0);
		const ended = phaseOf(recording!, 'revealed');
		expect(
			ended.at - revealing.at,
			'the reveal takes long enough to see'
		).toBeGreaterThanOrEqual(300);

		if (options.destinationShowsFocal) {
			expect(ended.focal).not.toBeNull();
			const focalBox = ended.focal!;
			if (options.variant === 'circleZoom') {
				const disc = ended.layers.find((layer) => layer.disc)?.disc;
				expect(
					disc,
					'the circle is still there at the end'
				).toBeDefined();
				expect(
					Math.hypot(
						disc!.x - (focalBox.left + focalBox.right) / 2,
						disc!.y - (focalBox.top + focalBox.bottom) / 2
					)
				).toBeLessThanOrEqual(POINT_TOLERANCE_PX);
				expect(disc!.radius).toBeLessThanOrEqual(POINT_TOLERANCE_PX);
			}
			for (const layer of ended.layers) {
				expect(
					layer.visible && intersect(layer.visible, focalBox),
					`layer "${layer.name}" no longer covers the message field`
				).toBeFalsy();
			}
		} else {
			// Nothing to end on: it settles for a point near the bottom, and still gives the page back.
			expect(ended.focal).toBeNull();
		}

		// Never longer than the cap, and nothing is left on the page.
		expect(recording!.removedAt! - startedAt).toBeLessThan(
			transitionMotion.closing.capMs
		);
		expect(next!.querySelector(ROOT)).toBeNull();
		if (options.destinationShowsFocal) {
			const focalBox = ended.focal!;
			const field = next!.querySelector<HTMLElement>(FOCAL[focal]);
			const hit = next!.elementFromPoint(
				(focalBox.left + focalBox.right) / 2,
				(focalBox.top + focalBox.bottom) / 2
			);
			expect(hit && field!.contains(hit)).toBe(true);
		}
		expect(
			frame.contentWindow?.sessionStorage.getItem(
				'oriso.closingHandover.v1'
			),
			'the note is used up'
		).toBeNull();
	} finally {
		recording?.stop();
	}
};
