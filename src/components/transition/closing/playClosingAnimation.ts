import { orisoInputColors } from '../../form/orisoInputDesign';
import { transitionMotion } from '../transitionMotion';
import {
	ClosingFocal,
	FIELD_FOCUS_AFTER_WIDTH,
	FocalPoint,
	resolveFocalPoint
} from './closingFocal';
import { ClosingDirection } from './closingDirection';

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

const primary = orisoInputColors.primary;
const primaryDark = orisoInputColors.primaryDark;

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
	root.dataset.closingAnimation = 'slide-reveal';
	root.dataset.closingDirection = options.direction;
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
	const buildPlan = () =>
		slideReveal({ doc, root, ...size }, options.direction);
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
