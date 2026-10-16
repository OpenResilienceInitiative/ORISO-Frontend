import { orisoInputColors } from '../../form/orisoInputDesign';
import { transitionMotion } from '../transitionMotion';
import { ClosingFocal, FocalPoint, resolveFocalPoint } from './closingFocal';
import { ClosingVariant } from './closingVariants';

export type ClosingPhase = 'cover' | 'covered' | 'reveal' | 'revealed';

export interface PlayClosingAnimationOptions {
	variant: ClosingVariant;
	/** Where the animation ends. The destination marks it, see `closingFocal`. */
	focal: ClosingFocal;
	/**
	 * The screen is covered: swap the room for its destination here, and only
	 * here. It runs exactly once, also when the animation cannot play at all.
	 */
	onCovered: () => void;
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

const primary = orisoInputColors.primary;
const primaryDark = orisoInputColors.primaryDark;

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
 * stage beside the surface is red already, so the strips that stand in for it
 * only fade in; when the curtain opens they step aside.
 */
const curtain = (frame: Frame): Plan => {
	const { doc, width, height } = frame;
	const column = doc.querySelector('.stageLayout__content');
	const box = column?.getBoundingClientRect();
	const left = Math.max(0, box?.left ?? 0);
	const top = Math.max(0, box?.top ?? 0);
	const right = Math.min(width, box?.right ?? width);
	const bottom = Math.min(height, box?.bottom ?? height);
	const surfaceOk = right - left > 40 && bottom - top > 40;
	const surface = surfaceOk
		? { left, top, right, bottom }
		: { left: 0, top: 0, right: width, bottom: height };

	const strips = [
		{
			name: 'stage-left',
			rect: [0, 0, surface.left, height],
			out: 'translateX(-100%)'
		},
		{
			name: 'stage-right',
			rect: [surface.right, 0, width - surface.right, height],
			out: 'translateX(100%)'
		},
		{
			name: 'stage-top',
			rect: [surface.left, 0, surface.right - surface.left, surface.top],
			out: 'translateY(-100%)'
		},
		{
			name: 'stage-bottom',
			rect: [
				surface.left,
				surface.bottom,
				surface.right - surface.left,
				height - surface.bottom
			],
			out: 'translateY(100%)'
		}
	]
		.filter(({ rect }) => rect[2] > 0.5 && rect[3] > 0.5)
		.map(({ name, rect, out }) => ({
			out,
			element: layer(frame, name, {
				left: px(rect[0]),
				top: px(rect[1]),
				width: px(rect[2]),
				height: px(rect[3]),
				background: primary
			})
		}));

	const surfaceWidth = surface.right - surface.left;
	// A frame that only clips: it paints nothing, so it is not a layer.
	const clip = frame.doc.createElement('div');
	Object.assign(clip.style, {
		position: 'absolute',
		pointerEvents: 'none',
		left: px(surface.left),
		top: px(surface.top),
		width: px(surfaceWidth),
		height: px(surface.bottom - surface.top),
		overflow: 'hidden'
	});
	frame.root.appendChild(clip);
	const half = Math.ceil(surfaceWidth / 2) + 1;
	const panel = (side: 'left' | 'right') =>
		layer(
			frame,
			`curtain-${side}`,
			{
				[side]: '0',
				top: '0',
				width: px(half),
				height: '100%',
				background: primary,
				// The edge that meets in the middle is a shade deeper, so two
				// halves read as cloth and not as one flat sheet.
				boxShadow: `inset ${side === 'left' ? '-' : ''}10px 0 0 ${primaryDark}`
			},
			'rect',
			clip
		);
	const leftPanel = panel('left');
	const rightPanel = panel('right');
	const away = { left: 'translateX(-101%)', right: 'translateX(101%)' };

	return {
		cover: () => [
			...strips.map(({ element }) =>
				run(
					element,
					[{ opacity: 0 }, { opacity: 1 }],
					closing.coverMs * 0.6,
					transitionMotion.easeIn
				)
			),
			run(
				leftPanel,
				[{ transform: away.left }, { transform: 'none' }],
				closing.coverMs,
				transitionMotion.easeIn
			),
			run(
				rightPanel,
				[{ transform: away.right }, { transform: 'none' }],
				closing.coverMs,
				transitionMotion.easeIn
			)
		],
		reveal: () => [
			...strips.map(({ element, out }) =>
				run(
					element,
					[{ transform: 'none' }, { transform: out }],
					closing.revealMs,
					transitionMotion.easeOut
				)
			),
			run(
				leftPanel,
				[{ transform: 'none' }, { transform: away.left }],
				closing.revealMs,
				transitionMotion.easeOut
			),
			run(
				rightPanel,
				[{ transform: 'none' }, { transform: away.right }],
				closing.revealMs,
				transitionMotion.easeOut
			)
		]
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
				transitionMotion.easeIn
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

/**
 * Plays the platform's closing animation and swaps the room in the middle of it.
 *
 * The layers are appended to the document body and not rendered by the room:
 * the room is unmounted while the screen is covered, and the animation has to
 * outlive it. Three promises hold whatever happens:
 *
 * - `onCovered` runs exactly once, also when nothing can be animated;
 * - the layers never take a pointer (`pointer-events: none` on every one);
 * - after `closing.capMs` the layers are removed even if an animation never
 *   reports back, so nothing is ever left covering the page.
 */
export const playClosingAnimation = async (
	options: PlayClosingAnimationOptions
): Promise<PlayClosingAnimationResult> => {
	const doc = options.document ?? document;
	const win = doc.defaultView;

	let swapped = false;
	const swap = () => {
		if (!swapped) {
			swapped = true;
			options.onCovered();
		}
	};

	if (options.reducedMotion || !win || !canAnimate(doc)) {
		swap();
		return { played: false };
	}

	const width = win.innerWidth;
	const height = win.innerHeight;
	const root = doc.createElement('div');
	root.setAttribute('aria-hidden', 'true');
	root.dataset.closingAnimation = options.variant;
	root.dataset.closingPhase = 'cover';
	Object.assign(root.style, {
		position: 'fixed',
		inset: '0',
		zIndex: Z_INDEX,
		overflow: 'hidden',
		pointerEvents: 'none'
	});
	const setPhase = (phase: ClosingPhase) => {
		root.dataset.closingPhase = phase;
	};

	const plan = PLANS[options.variant]({
		doc,
		root,
		width,
		height,
		origin: options.origin ?? { x: width / 2, y: height * 0.82 }
	});

	const sequence = async () => {
		doc.body.appendChild(root);
		await settle(plan.cover());
		setPhase('covered');
		swap();
		const focal = await resolveFocalPoint(doc, options.focal);
		setPhase('reveal');
		await settle(plan.reveal(focal));
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
	try {
		await Promise.race([sequence(), cap]);
	} finally {
		win.clearTimeout(capTimer);
		swap();
		root.remove();
	}
	return { played: true };
};
