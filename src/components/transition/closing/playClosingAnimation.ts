import { orisoInputColors } from '../../form/orisoInputDesign';
import { transitionMotion } from '../transitionMotion';
import {
	ClosingFocal,
	FIELD_FOCUS_AFTER_WIDTH,
	FocalPoint,
	resolveFocalPoint
} from './closingFocal';

export type ClosingPhase = 'cover' | 'covered' | 'reveal' | 'revealed';

/**
 * What a room's swap hands back to the animation. `false`, alone or as the
 * value of the promise, says the person stays: the entry was refused or failed,
 * so there is no destination to look for and the room is given back at once.
 * Anything else means the person is on the way to the destination.
 */
export type ClosingSwapResult = void | boolean | Promise<unknown>;

export interface PlayClosingAnimationOptions {
	/** Where the animation ends. The destination marks it, see `closingFocal`. */
	focal: ClosingFocal;
	/**
	 * The screen is covered: swap the room for its destination here, and only
	 * here. It runs exactly once, also when the animation cannot play at all.
	 * A swap that takes time (the live-chat room saves its consent and then
	 * replaces the whole page) returns a promise: the screen stays covered until
	 * it settles, but never longer than `closing.capMs`. `false` (or a promise
	 * of it) says the person stays, see `ClosingSwapResult`.
	 */
	onCovered: () => ClosingSwapResult;
	/** The person asked for less motion: the room is swapped at once. */
	reducedMotion?: boolean;
	/** Where the press happened: the focal point when the person stays. */
	origin?: { x: number; y: number };
	document?: Document;
}

export interface PlayClosingAnimationResult {
	/** False when it was skipped (reduced motion, or a browser without it). */
	played: boolean;
}

const { closing } = transitionMotion;

/** Above every dialog, snackbar and tooltip, and never in the way of a pointer. */
const Z_INDEX = '1600';

const primary = orisoInputColors.primary;

interface Plan {
	/** Starts the cover. Everything it needs exists already. */
	cover: () => Animation[];
	/** Starts the reveal. */
	reveal: () => Animation[];
}

interface Frame {
	doc: Document;
	root: HTMLElement;
	width: number;
	height: number;
}

const settle = (animations: Animation[]) =>
	Promise.all(
		animations.map((animation) => animation.finished.catch(() => undefined))
	);

/** One element of the sheet. Only the sheet itself is a named layer. */
const piece = (
	frame: Frame,
	parent: HTMLElement,
	style: Partial<CSSStyleDeclaration>,
	data: Record<string, string> = {}
) => {
	const element = frame.doc.createElement('div');
	Object.assign(element.dataset, data);
	Object.assign(element.style, {
		position: 'absolute',
		pointerEvents: 'none',
		...style
	});
	parent.appendChild(element);
	return element;
};

const run = (
	element: HTMLElement,
	keyframes: Keyframe[],
	duration: number,
	easing: string
) =>
	element.animate(keyframes, {
		duration,
		easing,
		fill: 'both'
	});

const px = (value: number) => `${value}px`;

/**
 * The wave: one long S, as long as 1.15 screen widths so that one screen shows
 * a bit more than one period, and as deep as 14% of that, but never deeper than
 * 16% of the screen is high (a phone held upright would otherwise be all curve).
 */
const WAVE_LENGTH = 1.15;
const WAVE_DEPTH = 0.14;
const WAVE_DEPTH_MAX = 0.16;
/** How far the wave drifts sideways while it is on screen, as a share of its length. */
const WAVE_DRIFT = 0.35;
/** The edge reaches this far into the body, so no seam can show between them. */
const OVERLAP = 2;
/** Eight cubic curves per period follow a sine to a fraction of a pixel. */
const CURVES_PER_WAVE = 8;

const SVG_NS = 'http://www.w3.org/2000/svg';

const round = (value: number) => Math.round(value * 100) / 100;

/**
 * `top + depth * (1 - sin(2 pi x / length))`, drawn from `0` to `reach` as
 * cubic curves whose ends carry the exact slope of the sine. The shape is
 * closed along `base`, the side the body is on.
 */
const waveShape = (
	reach: number,
	length: number,
	depth: number,
	top: number,
	base: number
) => {
	const turn = (2 * Math.PI) / length;
	const at = (x: number) => top + depth * (1 - Math.sin(turn * x));
	const slope = (x: number) => -depth * turn * Math.cos(turn * x);
	const step = length / CURVES_PER_WAVE;
	const knots = Math.ceil(reach / step);
	let d = `M0 ${base} L0 ${round(at(0))}`;
	for (let k = 1; k <= knots; k += 1) {
		const from = (k - 1) * step;
		const to = Math.min(k * step, reach);
		const third = (to - from) / 3;
		d +=
			` C${round(from + third)} ${round(at(from) + slope(from) * third)}` +
			` ${round(to - third)} ${round(at(to) - slope(to) * third)}` +
			` ${round(to)} ${round(at(to))}`;
	}
	return `${d}V${base}Z`;
};

/**
 * The wave reveal: one big calm red sheet comes up from below, covers the room
 * and leaves at the top, so the chat is uncovered from below. Its leading and
 * its trailing end are waves. The sheet is one layer moved by a transform only;
 * each wave also drifts sideways while it is in sight, which makes the edge
 * flow instead of slide. The colour is the Träger's primary colour and nothing
 * else: no tint is derived from it, so every Träger colour works as it is.
 */
const waveReveal = (frame: Frame): Plan => {
	const { width, height } = frame;
	const length = Math.round(WAVE_LENGTH * width);
	const depth = Math.round(
		Math.min(WAVE_DEPTH * length, WAVE_DEPTH_MAX * height)
	);
	const edgeHeight = 2 * depth + OVERLAP;
	const drift = Math.round(WAVE_DRIFT * length);
	const reach = width + drift;
	const travel = height + 2 * depth + OVERLAP;

	const sheet = piece(
		frame,
		frame.root,
		{
			left: '0',
			top: '0',
			width: px(width),
			height: px(height),
			willChange: 'transform'
		},
		{ closingLayer: 'wave' }
	);
	piece(
		frame,
		sheet,
		{
			left: '0',
			top: '0',
			width: px(width),
			height: px(height),
			background: primary
		},
		{ closingBody: '' }
	);
	const edge = (side: 'leading' | 'trailing') => {
		const leading = side === 'leading';
		const element = piece(
			frame,
			sheet,
			{
				left: '0',
				top: px(leading ? -2 * depth : height - OVERLAP),
				width: px(reach),
				height: px(edgeHeight),
				willChange: 'transform'
			},
			{ closingEdge: side }
		);
		const svg = frame.doc.createElementNS(SVG_NS, 'svg');
		svg.setAttribute('viewBox', `0 0 ${reach} ${edgeHeight}`);
		svg.setAttribute('preserveAspectRatio', 'none');
		svg.setAttribute('width', '100%');
		svg.setAttribute('height', '100%');
		svg.style.display = 'block';
		const path = frame.doc.createElementNS(SVG_NS, 'path');
		path.setAttribute(
			'd',
			leading
				? waveShape(reach, length, depth, 0, edgeHeight)
				: waveShape(reach, length, depth, OVERLAP, 0)
		);
		path.setAttribute('style', `fill:${primary}`);
		svg.appendChild(path);
		element.appendChild(svg);
		return element;
	};
	const leading = edge('leading');
	const trailing = edge('trailing');
	const drifting = (element: HTMLElement, duration: number) =>
		run(
			element,
			[
				{ transform: 'translateX(0px)' },
				{ transform: `translateX(${px(-drift)})` }
			],
			duration,
			'linear'
		);

	return {
		cover: () => [
			run(
				sheet,
				[
					{ transform: `translateY(${px(travel)})` },
					{ transform: 'none' }
				],
				closing.coverMs,
				transitionMotion.easeIn
			),
			drifting(leading, closing.coverMs)
		],
		reveal: () => [
			run(
				sheet,
				[
					{ transform: 'none' },
					{ transform: `translateY(${px(-travel)})` }
				],
				closing.revealMs,
				transitionMotion.easeOut
			),
			drifting(trailing, closing.revealMs)
		]
	};
};

const canAnimate = (doc: Document) =>
	typeof doc.documentElement.animate === 'function';

const FOCUSABLE =
	'textarea, input, select, button, a[href], [contenteditable="true"], [tabindex]:not([tabindex="-1"])';

/** Where a person types: the arrival field wraps its editor, a toolbar stands before it. */
const TYPING =
	'textarea, input:not([type="button"], [type="submit"], [type="checkbox"], [type="radio"]), [contenteditable="true"], [role="textbox"]';

const firstIn = (landing: HTMLElement | null, selector: string) =>
	landing?.matches(selector)
		? landing
		: landing?.querySelector<HTMLElement>(selector);

const nothingFocused = (doc: Document) =>
	!doc.activeElement ||
	doc.activeElement === doc.body ||
	doc.activeElement === doc.documentElement;

/**
 * Shuts everything on the page but the overlay for keyboard and assistive
 * technology: the root only stops the pointer, so Tab and Enter could still
 * press a control that is being swapped out. Gives the page back, and the
 * keyboard where it was, when called. Elements that were shut before stay shut.
 */
const shutRoomBehind = (doc: Document, root: HTMLElement) => {
	const shut = Array.from(doc.body.children).filter(
		(element) => element !== root && !element.hasAttribute('inert')
	);
	shut.forEach((element) => element.setAttribute('inert', ''));
	const pressed = nothingFocused(doc)
		? null
		: (doc.activeElement as HTMLElement);

	let open = false;
	return (landing: HTMLElement | null = null) => {
		if (open) return;
		open = true;
		shut.forEach((element) => element.removeAttribute('inert'));
		// A browser drops the focus of a shut element. Hand it back to the
		// button that had it, or to the field the person arrives in; the room
		// that arrived while the page was shut could not take it.
		if (!nothingFocused(doc)) return;
		// A button that is still disabled (the gate is shut until the
		// animation is over) ignores focus: that one sees to itself.
		const target =
			pressed?.isConnected && !pressed.matches(':disabled')
				? pressed
				: (firstIn(landing, TYPING) ?? firstIn(landing, FOCUSABLE));
		target?.focus({ preventScroll: true });
	};
};

/**
 * Plays the platform's closing animation and swaps the room in the middle of it.
 *
 * The layers are appended to the document body and not rendered by the room:
 * the room is unmounted while the screen is covered, and the animation has to
 * outlive it. Three promises hold whatever happens:
 *
 * - `onCovered` runs exactly once, also when nothing can be animated;
 * - the root takes the pointer while the screen is covered, so no tap reaches
 *   the room that is being swapped, and lets it through from the reveal on; the
 *   layers themselves never take one. The rest of the page is `inert` for the
 *   same time, so the keyboard cannot reach that room either;
 * - after `closing.capMs` the layers are removed even if an animation never
 *   reports back, so nothing is ever left covering the page.
 */
export const playClosingAnimation = async (
	options: PlayClosingAnimationOptions
): Promise<PlayClosingAnimationResult> => {
	const doc = options.document ?? document;
	const win = doc.defaultView;

	let swapped = false;
	let swapping: Promise<unknown> = Promise.resolve();
	const swap = () => {
		if (!swapped) {
			swapped = true;
			swapping = Promise.resolve(options.onCovered());
			// Whoever waits for the swap hears of a failure. One nobody waits
			// for any more (the cap won) must not become an unhandled rejection.
			swapping.catch(() => undefined);
		}
		return swapping;
	};

	if (options.reducedMotion || !win || !canAnimate(doc)) {
		await swap();
		return { played: false };
	}

	const root = doc.createElement('div');
	root.setAttribute('aria-hidden', 'true');
	root.dataset.closingAnimation = 'wave-reveal';
	root.dataset.closingPhase = 'cover';
	Object.assign(root.style, {
		position: 'fixed',
		inset: '0',
		zIndex: Z_INDEX,
		overflow: 'hidden',
		// Presses meant for the room that is being swapped must not reach it
		// while the screen is held red; the cap always removes the root.
		pointerEvents: 'auto'
	});
	const setPhase = (phase: ClosingPhase) => {
		root.dataset.closingPhase = phase;
		// The destination can be used while it is revealed.
		if (phase === 'reveal') root.style.pointerEvents = 'none';
	};

	let size = { width: win.innerWidth, height: win.innerHeight };
	const origin = options.origin ?? {
		x: size.width / 2,
		y: size.height * 0.82
	};
	const buildPlan = () => waveReveal({ doc, root, ...size });
	let plan = buildPlan();
	/* The pieces are sized in pixels at the press. A viewport that changed
	   while the screen is held covered (a phone turned) would show the room
	   through the strip that was added, so the pieces are built again for the
	   new size and set straight to where the cover ends. Mid-cover and mid-reveal
	   the cover is not touched: the first is checked once it is covered, the
	   second is over in a few hundred milliseconds. */
	const refit = () => {
		if (win.innerWidth === size.width && win.innerHeight === size.height) {
			return;
		}
		size = { width: win.innerWidth, height: win.innerHeight };
		root.replaceChildren();
		plan = buildPlan();
		plan.cover().forEach((animation) => animation.finish());
	};
	const onResize = () => {
		if (root.dataset.closingPhase === 'covered') refit();
	};

	let over = false;
	let giveRoomBack: (landing?: HTMLElement | null) => void = () => undefined;
	const sequence = async () => {
		doc.body.appendChild(root);
		giveRoomBack = shutRoomBehind(doc, root);
		await settle(plan.cover());
		setPhase('covered');
		refit();
		const stays = (await swap()) === false;
		// Nothing took the person on, so the room is still there: open onto
		// the button that was pressed instead of waiting for a destination.
		const focal: FocalPoint = stays
			? { ...origin, element: null }
			: await resolveFocalPoint(doc, options.focal, () => over);
		// The cap won while it waited: nobody is looking at these layers.
		if (over) return;
		// A narrow viewport gets no focused field (the composer's own rule).
		giveRoomBack(
			win.innerWidth > FIELD_FOCUS_AFTER_WIDTH ? focal.element : null
		);
		setPhase('reveal');
		await settle(plan.reveal());
		setPhase('revealed');
		// One frame at rest, so the end state can be seen (and measured).
		await new Promise<void>((resolve) =>
			win.requestAnimationFrame(() => resolve())
		);
	};

	let capTimer: number | undefined;
	const cap = new Promise<void>((resolve) => {
		capTimer = win.setTimeout(resolve, closing.capMs);
	});
	win.addEventListener('resize', onResize);
	try {
		await Promise.race([sequence(), cap]);
	} finally {
		win.removeEventListener('resize', onResize);
		win.clearTimeout(capTimer);
		over = true;
		root.remove();
		giveRoomBack();
		swap();
	}
	return { played: true };
};
