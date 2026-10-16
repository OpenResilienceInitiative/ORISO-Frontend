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
 * stage beside the surface is red already, so the pieces that stand in for it
 * only fade in. Every piece belongs to the left or the right half, and a half
 * travels as one: when the curtain opens the whole screen parts at the middle
 * of the surface and nothing is left behind.
 */
const curtain = (frame: Frame): Plan => {
	const { doc, width, height } = frame;
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
