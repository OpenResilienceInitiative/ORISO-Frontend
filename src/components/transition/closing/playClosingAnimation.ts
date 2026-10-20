import { orisoInputColors } from '../../form/orisoInputDesign';
import { prefersReducedMotion } from '../prefersReducedMotion';
import { transitionMotion } from '../transitionMotion';
import {
	ClosingFocal,
	FIELD_FOCUS_AFTER_WIDTH,
	FocalPoint,
	resolveFocalPoint
} from './closingFocal';
import { ClosingDirection } from './closingDirection';
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
	/** Which way the sheets sweep: sideways beside the stage, upward on one column. */
	direction: ClosingDirection;
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

/** The platform's colours: tokens, so a tenant's palette reaches them live. */
const TOKEN_COLORS: ClosingHandoverColors = {
	primary: orisoInputColors.primary,
	primaryDark: orisoInputColors.primaryDark
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

const layer = (
	frame: Frame,
	name: string,
	style: Partial<CSSStyleDeclaration>,
	parent: HTMLElement = frame.root
) => {
	const element = frame.doc.createElement('div');
	element.dataset.closingLayer = name;
	Object.assign(element.style, {
		position: 'absolute',
		pointerEvents: 'none',
		willChange: 'transform',
		...style
	});
	parent.appendChild(element);
	return element;
};

const run = (
	element: HTMLElement,
	keyframes: Keyframe[],
	duration: number,
	easing: string,
	delay = 0
) =>
	element.animate(keyframes, {
		duration,
		easing,
		delay,
		fill: 'both'
	});

const px = (value: number) => `${value}px`;

/**
 * Slide reveal: the red area swipes over the room as one piece, to the right
 * beside the stage and upward on one column. A second red layer sits behind it
 * and travels the same way a beat later, so the swipe leaves a trailing band
 * before the chat is uncovered. The beat is part of the phase, not added to
 * it: both sheets end together.
 */
const slideReveal = (frame: Frame, direction: ClosingDirection): Plan => {
	const { width, height } = frame;
	const { primary, primaryDark } = frame.colors;
	const sheet = (name: string, background: string) =>
		layer(frame, name, {
			left: '0',
			top: '0',
			width: px(width),
			height: px(height),
			background
		});
	const rear = sheet('slide-rear', primaryDark);
	const front = sheet('slide-front', primary);
	// One continuous sweep: in from the left and out to the right, or in from
	// the bottom and out at the top.
	const axis = direction === 'vertical' ? 'Y' : 'X';
	const sign = direction === 'vertical' ? -1 : 1;
	const from = `translate${axis}(${-sign * 100}%)`;
	const to = `translate${axis}(${sign * 100}%)`;

	return {
		cover: () => [
			run(
				front,
				[{ transform: from }, { transform: 'none' }],
				closing.coverMs,
				transitionMotion.easeIn
			),
			// Starts late, ends with the front sheet: the trail is inside the phase.
			run(
				rear,
				[{ transform: from }, { transform: 'none' }],
				closing.coverMs - closing.trailMs,
				transitionMotion.easeIn,
				closing.trailMs
			)
		],
		reveal: () => [
			run(
				front,
				[{ transform: 'none' }, { transform: to }],
				closing.revealMs,
				transitionMotion.easeOut
			),
			run(
				rear,
				[{ transform: 'none' }, { transform: to }],
				closing.revealMs - closing.trailMs,
				transitionMotion.easeOut,
				closing.trailMs
			)
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
	direction: ClosingDirection,
	colors: ClosingHandoverColors = TOKEN_COLORS
) => {
	const root = doc.createElement('div');
	root.setAttribute('aria-hidden', 'true');
	root.dataset.closingAnimation = 'slide-reveal';
	root.dataset.closingDirection = direction;
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
	const buildPlan = () =>
		slideReveal({ doc, root, ...size, colors }, direction);
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
	const primaryDark = style.getPropertyValue('--m3-primary-hover').trim();
	return primary && primaryDark ? { primary, primaryDark } : undefined;
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
	const stage = createStage(doc, win, options.direction);
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
			direction: options.direction,
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
	const cap = new Promise<void>((resolve) => {
		capTimer = win.setTimeout(resolve, closing.capMs);
	});
	win.addEventListener('resize', stage.onResize);
	try {
		await Promise.race([sequence(), cap]);
	} finally {
		win.removeEventListener('resize', stage.onResize);
		win.clearTimeout(capTimer);
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
 * screen is covered at once, in the direction and colours it had, before anything
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

	const stage = createStage(doc, win, handover.direction, handover.colors);
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
