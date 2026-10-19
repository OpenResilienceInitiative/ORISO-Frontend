import { orisoInputColors } from '../../form/orisoInputDesign';
import { prefersReducedMotion } from '../prefersReducedMotion';
import { transitionMotion } from '../transitionMotion';
import { ClosingFocal, FocalPoint, resolveFocalPoint } from './closingFocal';
import {
	ClosingHandoverColors,
	leaveClosingHandover,
	takeClosingHandover
} from './closingHandover';
import { ClosingVariant } from './closingVariants';

export type ClosingPhase = 'cover' | 'covered' | 'reveal' | 'revealed';

/**
 * What a room's swap hands back to the animation. `false`, alone or as the
 * value of the promise, says the person stays: the entry was refused or failed,
 * so there is no destination to look for and the room is given back at once.
 * Anything else means the person is on the way to the destination.
 */
export type ClosingSwapResult = void | boolean | Promise<unknown>;

export interface PlayClosingAnimationOptions {
	variant: ClosingVariant;
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
	/** Where the press happened; the circle opens from here. */
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
	/** Starts the reveal, ending on the focal point. */
	reveal: (focal: FocalPoint) => Animation[];
}

interface Frame {
	doc: Document;
	root: HTMLElement;
	width: number;
	height: number;
	origin: { x: number; y: number };
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
	shape: 'rect' | 'disc' = 'rect',
	parent: HTMLElement = frame.root
) => {
	const element = frame.doc.createElement('div');
	element.dataset.closingLayer = name;
	element.dataset.closingShape = shape;
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
 * Curtain: two halves close over the right-hand surface and open again. The
 * stage beside the surface is red already, so the pieces that stand in for it
 * only fade in. Every piece belongs to the left or the right half, and a half
 * travels as one: when the curtain opens the whole screen parts at the middle
 * of the surface and nothing is left behind.
 */
const curtain = (frame: Frame): Plan => {
	const { doc, width, height } = frame;
	const { primary, primaryDark } = frame.colors;
	const box = doc
		.querySelector('.stageLayout__content')
		?.getBoundingClientRect();
	const measured = box
		? {
				left: Math.max(0, Math.round(box.left)),
				top: Math.max(0, Math.round(box.top)),
				right: Math.min(width, Math.round(box.right)),
				bottom: Math.min(height, Math.round(box.bottom))
			}
		: undefined;
	const surface =
		measured &&
		measured.right - measured.left > 40 &&
		measured.bottom - measured.top > 40
			? measured
			: { left: 0, top: 0, right: width, bottom: height };
	const centre = Math.round((surface.left + surface.right) / 2);

	const half = (side: 'left' | 'right') => {
		const x0 = side === 'left' ? 0 : centre;
		// One pixel of overlap into the other half, so no seam shows where they meet.
		const x1 = side === 'left' ? centre + 1 : width;
		const element = doc.createElement('div');
		Object.assign(element.style, {
			position: 'absolute',
			pointerEvents: 'none',
			willChange: 'transform',
			left: px(x0),
			top: '0',
			width: px(x1 - x0),
			height: px(height)
		});
		frame.root.appendChild(element);
		const own = (left: number, right: number) => [
			Math.max(left, x0),
			Math.min(right, x1)
		];
		const rect = (
			name: string,
			[l, r]: number[],
			top: number,
			bottom: number
		) =>
			r - l > 0.5 && bottom - top > 0.5
				? layer(
						frame,
						name,
						{
							left: px(l - x0),
							top: px(top),
							width: px(r - l),
							height: px(bottom - top),
							background: primary
						},
						'rect',
						element
					)
				: undefined;
		const strips = [
			// Each piece runs one pixel under the next, so no seam shows while a half moves.
			rect(`stage-${side}`, own(0, surface.left + 1), 0, height),
			rect(`stage-${side}-end`, own(surface.right - 1, width), 0, height),
			rect(
				`top-${side}`,
				own(surface.left, surface.right),
				0,
				surface.top + 1
			),
			rect(
				`bottom-${side}`,
				own(surface.left, surface.right),
				surface.bottom - 1,
				height
			)
		].filter((strip): strip is HTMLDivElement => Boolean(strip));

		// A frame that only clips: it paints nothing, so it is not a layer.
		const [l, r] = own(surface.left, surface.right);
		const clip = doc.createElement('div');
		Object.assign(clip.style, {
			position: 'absolute',
			pointerEvents: 'none',
			left: px(l - x0),
			top: px(surface.top),
			width: px(r - l),
			height: px(surface.bottom - surface.top),
			overflow: 'hidden'
		});
		element.appendChild(clip);
		const panel = layer(
			frame,
			`curtain-${side}`,
			{
				left: '0',
				top: '0',
				width: '100%',
				height: '100%',
				background: primary,
				// The edge that meets in the middle is a shade deeper, so two
				// halves read as cloth and not as one flat sheet.
				boxShadow: `inset ${side === 'left' ? '-' : ''}8px 0 0 ${primaryDark}`
			},
			'rect',
			clip
		);
		return { element, strips, panel, away: side === 'left' ? -1 : 1 };
	};

	const halves = [half('left'), half('right')];

	return {
		cover: () =>
			halves.flatMap(({ strips, panel, away }) => [
				...strips.map((strip) =>
					run(
						strip,
						[{ opacity: 0 }, { opacity: 1 }],
						closing.coverMs * 0.6,
						transitionMotion.easeIn
					)
				),
				run(
					panel,
					[
						{ transform: `translateX(${away * 101}%)` },
						{ transform: 'none' }
					],
					closing.coverMs,
					transitionMotion.easeIn
				)
			]),
		reveal: () =>
			halves.map(({ element, away }) =>
				run(
					element,
					[
						{ transform: 'none' },
						{ transform: `translateX(${away * 100}%)` }
					],
					closing.revealMs,
					transitionMotion.easeOut
				)
			)
	};
};

/**
 * Circle zoom: the red grows out of the gate button until the screen is red,
 * then closes into a circle on the focal point, a shade deeper as it goes,
 * and is gone. "Reddish" is the brand colour deepening (the primary token
 * family), never a literal red — a blue tenant sees blue.
 */
const circleZoom = (frame: Frame): Plan => {
	const { width, height, origin } = frame;
	const { primary, primaryDark } = frame.colors;
	const radius =
		Math.max(
			Math.hypot(origin.x, origin.y),
			Math.hypot(width - origin.x, origin.y),
			Math.hypot(origin.x, height - origin.y),
			Math.hypot(width - origin.x, height - origin.y)
		) + 2;
	const disc = layer(
		frame,
		'circle',
		{
			left: px(origin.x - radius),
			top: px(origin.y - radius),
			width: px(radius * 2),
			height: px(radius * 2),
			borderRadius: '50%',
			background: primary
		},
		'disc'
	);
	const deep = frame.doc.createElement('div');
	Object.assign(deep.style, {
		position: 'absolute',
		inset: '0',
		borderRadius: '50%',
		background: primaryDark,
		opacity: '0',
		pointerEvents: 'none'
	});
	disc.appendChild(deep);

	return {
		cover: () => [
			run(
				disc,
				[{ transform: 'scale(0)' }, { transform: 'scale(1)' }],
				closing.coverMs,
				transitionMotion.easeIn
			)
		],
		reveal: (focal) => [
			run(
				disc,
				[
					{ transform: 'translate(0px, 0px) scale(1)' },
					{
						transform: `translate(${px(focal.x - origin.x)}, ${px(focal.y - origin.y)}) scale(0)`
					}
				],
				closing.revealMs,
				transitionMotion.easeInOut
			),
			run(
				deep,
				[{ opacity: 0 }, { opacity: 1 }],
				closing.revealMs * 0.7,
				'linear'
			)
		]
	};
};

/**
 * Slide reveal: the red area swipes to the right as one piece. A second red
 * layer sits behind it and travels the same way a beat later, so the swipe
 * leaves a trailing band before the chat is uncovered.
 */
const slideReveal = (frame: Frame): Plan => {
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
	const from = 'translateX(-100%)';
	const to = 'translateX(100%)';

	return {
		cover: () => [
			run(
				front,
				[{ transform: from }, { transform: 'none' }],
				closing.coverMs,
				transitionMotion.easeIn
			),
			run(
				rear,
				[{ transform: from }, { transform: 'none' }],
				closing.coverMs,
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
				closing.revealMs,
				transitionMotion.easeOut,
				closing.trailMs
			)
		]
	};
};

const PLANS: Record<ClosingVariant, (frame: Frame) => Plan> = {
	curtain,
	circleZoom,
	slideReveal
};

const canAnimate = (doc: Document) =>
	typeof doc.documentElement.animate === 'function';

const FOCUSABLE =
	'textarea, input, select, button, a[href], [contenteditable="true"], [tabindex]:not([tabindex="-1"])';

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
		const target = pressed?.isConnected
			? pressed
			: landing?.matches(FOCUSABLE)
				? landing
				: landing?.querySelector<HTMLElement>(FOCUSABLE);
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
	variant: ClosingVariant,
	origin: { x: number; y: number },
	colors: ClosingHandoverColors = TOKEN_COLORS
) => {
	const width = win.innerWidth;
	const height = win.innerHeight;
	const root = doc.createElement('div');
	root.setAttribute('aria-hidden', 'true');
	root.dataset.closingAnimation = variant;
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
	const plan = PLANS[variant]({
		doc,
		root,
		width,
		height,
		origin,
		colors
	});
	return { root, plan, setPhase };
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
	giveRoomBack(point.element);
	stage.setPhase('reveal');
	await settle(stage.plan.reveal(point));
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

const clamp = (share: number) => Math.min(1, Math.max(0, share));

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
	const stage = createStage(doc, win, options.variant, origin);
	const { root, plan, setPhase } = stage;

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
			variant: options.variant,
			focal: options.focal,
			origin: {
				x: clamp(origin.x / win.innerWidth),
				y: clamp(origin.y / win.innerHeight)
			},
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
		await settle(plan.cover());
		setPhase('covered');
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
	try {
		await Promise.race([sequence(), cap]);
	} finally {
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
 * screen is covered at once, in the design and colours it had, before anything
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

	const stage = createStage(
		doc,
		win,
		handover.variant,
		{
			x: handover.origin.x * win.innerWidth,
			y: handover.origin.y * win.innerHeight
		},
		handover.colors
	);
	let over = false;
	let capTimer: number | undefined;
	const cap = new Promise<void>((resolve) => {
		capTimer = win.setTimeout(resolve, closing.capMs);
	});
	doc.body.appendChild(stage.root);
	// The app starts underneath: nothing on the page can be reached by the
	// keyboard until the reveal, as in the document that began the animation.
	const giveRoomBack = shutRoomBehind(doc, stage.root);
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
		win.clearTimeout(capTimer);
		over = true;
		stage.root.remove();
		giveRoomBack();
	}
	return { played: true };
};
