import { orisoInputColors } from '../../form/orisoInputDesign';
import { prefersReducedMotion } from '../prefersReducedMotion';
import { transitionMotion } from '../transitionMotion';
import {
	ClosingFocal,
	FIELD_FOCUS_AFTER_WIDTH,
	FocalPoint,
	resolveFocalPoint
} from './closingFocal';
import {
	ClosingHandoverColors,
	leaveClosingHandover,
	takeClosingHandover
} from './closingHandover';

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

/** The platform's colour: a token, so a tenant's palette reaches it live. */
const TOKEN_COLORS: ClosingHandoverColors = {
	primary: orisoInputColors.primary
};

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
	colors: ClosingHandoverColors;
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
	const { primary } = frame.colors;
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
 * The root every animation draws into. It is appended to the document body and
 * not rendered by the room: the room is unmounted while the screen is covered,
 * and the animation has to outlive it.
 */
const createStage = (
	doc: Document,
	win: Window,
	colors: ClosingHandoverColors = TOKEN_COLORS
) => {
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
	const buildPlan = () => waveReveal({ doc, root, ...size, colors });
	let plan = buildPlan();
	/* The pieces are sized in pixels when the stage is made. A viewport that
	   changed while the screen is held covered (a phone turned) would show the
	   page through the strip that was added, so the pieces are built again for
	   the new size and set straight to where the cover ends. Mid-cover and
	   mid-reveal the cover is not touched: the first is checked once it is
	   covered, the second is over in a few hundred milliseconds. */
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
	return {
		root,
		setPhase,
		/** The current plan: `refit` replaces it. */
		get plan() {
			return plan;
		},
		refit,
		onResize
	};
};

type Stage = ReturnType<typeof createStage>;

interface UncoverOptions {
	/** Defaults to `closing.focalWaitMs`. */
	waitMs?: number;
	/** Opens the page behind the cover again, and hands the keyboard back. */
	giveRoomBack: (landing: HTMLElement | null) => void;
	/** Set when the person stays: the reveal ends here, with no destination to find. */
	staysAt?: { x: number; y: number };
}

/**
 * The second half: look for where the destination wants the person's eye, then
 * give the screen back, ending there. Does nothing once `isOver` says the cap
 * has taken the layers away.
 */
const uncover = async (
	doc: Document,
	win: Window,
	stage: Stage,
	focal: ClosingFocal,
	isOver: () => boolean,
	{ waitMs, giveRoomBack, staysAt }: UncoverOptions
) => {
	const point: FocalPoint = staysAt
		? { ...staysAt, element: null }
		: await resolveFocalPoint(doc, focal, isOver, waitMs);
	// The cap won while it waited: nobody is looking at these layers.
	if (isOver()) return;
	// A narrow viewport gets no focused field (the composer's own rule).
	giveRoomBack(
		win.innerWidth > FIELD_FOCUS_AFTER_WIDTH ? point.element : null
	);
	stage.setPhase('reveal');
	await settle(stage.plan.reveal());
	stage.setPhase('revealed');
	// One frame at rest, so the end state can be seen (and measured).
	await new Promise<void>((resolve) =>
		win.requestAnimationFrame(() => resolve())
	);
};

const readTokenColors = (doc: Document, win: Window) => {
	const style = win.getComputedStyle(doc.documentElement);
	const primary = style.getPropertyValue('--m3-primary').trim();
	return primary ? { primary } : undefined;
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
 *
 * A room that replaces the whole page cannot reveal in its own document. When
 * the page goes while the screen is covered, the animation leaves a note for
 * the next document (`resumeClosingAnimation`), which plays the reveal.
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

	const origin = options.origin ?? {
		x: win.innerWidth / 2,
		y: win.innerHeight * 0.82
	};
	const stage = createStage(doc, win);
	const { root, setPhase } = stage;

	// The page is being replaced while the screen is covered: the next
	// document picks the animation up.
	const handOver = () => {
		// Only a cover that is on the page and standing: nothing is carried on
		// that is not there to see.
		if (!root.isConnected || root.dataset.closingPhase !== 'covered') {
			return;
		}
		const colors = readTokenColors(doc, win);
		leaveClosingHandover(win, {
			focal: options.focal,
			...(colors && { colors }),
			at: Date.now()
		});
	};

	let over = false;
	let giveRoomBack: (landing?: HTMLElement | null) => void = () => undefined;
	const sequence = async () => {
		doc.body.appendChild(root);
		giveRoomBack = shutRoomBehind(doc, root);
		win.addEventListener('pagehide', handOver);
		await settle(stage.plan.cover());
		setPhase('covered');
		stage.refit();
		const stays = (await swap()) === false;
		await uncover(doc, win, stage, options.focal, () => over, {
			giveRoomBack: (landing) => giveRoomBack(landing),
			// Nothing took the person on, so the room is still there: open onto
			// the button that was pressed instead of waiting for a destination.
			staysAt: stays ? origin : undefined
		});
	};

	let capTimer: number | undefined;
	let endNow: () => void = () => undefined;
	const cap = new Promise<void>((resolve) => {
		endNow = resolve;
		capTimer = win.setTimeout(resolve, closing.capMs);
	});
	// Back restores this document with its cover and inert page still intact.
	// Release both immediately instead of waiting for the paused cap timer.
	const onPageShow = (event: PageTransitionEvent) => {
		if (event.persisted) endNow();
	};
	win.addEventListener('pageshow', onPageShow);
	win.addEventListener('resize', stage.onResize);
	try {
		await Promise.race([sequence(), cap]);
	} finally {
		win.removeEventListener('resize', stage.onResize);
		win.clearTimeout(capTimer);
		win.removeEventListener('pageshow', onPageShow);
		win.removeEventListener('pagehide', handOver);
		over = true;
		root.remove();
		giveRoomBack();
		swap();
	}
	return { played: true };
};

export interface ResumeClosingAnimationOptions {
	/** Defaults to what the person asked the system for. */
	reducedMotion?: boolean;
	document?: Document;
}

/**
 * The other half of a closing animation that began in the previous document.
 *
 * Called by the app's first module. If the previous document left a note, the
 * screen is covered at once, in the colour it had, before anything
 * else is on it; the app starts underneath; and the reveal plays as soon as the
 * destination shows its focal element, ending there. It plays at most once per
 * note, never longer than `closing.capMs`, and not at all for a person who
 * asked for less motion (the previous document drew nothing for them either).
 */
export const resumeClosingAnimation = async (
	options: ResumeClosingAnimationOptions = {}
): Promise<PlayClosingAnimationResult> => {
	const doc = options.document ?? document;
	const win = doc.defaultView;
	if (!win || !doc.body) {
		return { played: false };
	}
	const handover = takeClosingHandover(win);
	if (
		!handover ||
		(options.reducedMotion ?? prefersReducedMotion(win)) ||
		!canAnimate(doc)
	) {
		return { played: false };
	}

	const stage = createStage(doc, win, handover.colors);
	let over = false;
	let capTimer: number | undefined;
	const cap = new Promise<void>((resolve) => {
		capTimer = win.setTimeout(resolve, closing.capMs);
	});
	doc.body.appendChild(stage.root);
	// The app starts underneath: nothing on the page can be reached by the
	// keyboard until the reveal, as in the document that began the animation.
	const giveRoomBack = shutRoomBehind(doc, stage.root);
	win.addEventListener('resize', stage.onResize);
	try {
		await Promise.race([
			(async () => {
				// The cover was played in the old document: here it only stands.
				stage.plan.cover().forEach((animation) => animation.finish());
				stage.setPhase('covered');
				await uncover(doc, win, stage, handover.focal, () => over, {
					waitMs: closing.handoverFocalWaitMs,
					giveRoomBack
				});
			})(),
			cap
		]);
	} finally {
		win.removeEventListener('resize', stage.onResize);
		win.clearTimeout(capTimer);
		over = true;
		stage.root.remove();
		giveRoomBack();
	}
	return { played: true };
};
