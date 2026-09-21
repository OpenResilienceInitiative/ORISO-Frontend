import clsx from 'clsx';
import * as React from 'react';
import { useEffect, useRef } from 'react';
import './orbitalTrails.styles.scss';

const CANVAS_SIZE = 480;
const TWO_PI = Math.PI * 2;
const RADII = [36, 72, 108] as const;
const CENTERS = [
	[120, 120],
	[360, 120],
	[360, 360],
	[120, 360]
] as const;
/* The single loader: one system in the middle, its orbits doubled so it
   fills the same canvas the grid of four does. */
const SINGLE_CENTER = [240, 240] as const;
const SINGLE_RADII = RADII.map((radius) => radius * 2);
const MAX_FRAMES = 1200;

export type OrbitalPalette = 'brand' | 'mixed' | 'neutral';
/** `grid`: four systems, the original sketch. `single`: one, centred. */
export type OrbitalVariant = 'grid' | 'single';

export interface OrbitalSystem {
	center: readonly [number, number];
	radii: readonly number[];
	angles: [number, number, number];
	increments: [number, number, number];
}

export interface OrbitalTrailsProps {
	label: string;
	palette?: OrbitalPalette;
	variant?: OrbitalVariant;
	seed?: number;
	/** Pre-renders the animation so snapshot stories can show a developed state. */
	warmupFrames?: number;
	/** Leaves the canvas at its pre-rendered state instead of animating it. */
	paused?: boolean;
	className?: string;
}

const seededRandom = (seed: number) => {
	let state = seed >>> 0;
	return () => {
		state = (state * 1664525 + 1013904223) >>> 0;
		return state / 4294967296;
	};
};

export const createOrbitalSystems = (
	seed: number,
	variant: OrbitalVariant = 'grid'
): OrbitalSystem[] => {
	const random = seededRandom(seed);
	const layout: {
		center: readonly [number, number];
		radii: readonly number[];
	}[] =
		variant === 'single'
			? [{ center: SINGLE_CENTER, radii: SINGLE_RADII }]
			: CENTERS.map((center) => ({ center, radii: RADII }));

	return layout.map(({ center, radii }) => ({
		center,
		radii,
		angles: [random() * TWO_PI, random() * TWO_PI, random() * TWO_PI] as [
			number,
			number,
			number
		],
		increments: [0, 1, 2].map(() => {
			const magnitude = 0.012 + random() * 0.053;
			return random() < 0.5 ? -magnitude : magnitude;
		}) as [number, number, number]
	}));
};

const cssVariable = (
	styles: CSSStyleDeclaration,
	name: string,
	fallback: string
) => styles.getPropertyValue(name).trim() || fallback;

const drawFrame = (
	context: CanvasRenderingContext2D,
	trailsContext: CanvasRenderingContext2D,
	trailsCanvas: HTMLCanvasElement,
	systems: OrbitalSystem[],
	colors: string[]
) => {
	systems.forEach((system, systemIndex) => {
		const color = colors[systemIndex % colors.length];
		const points = system.radii.map((radius, orbitIndex) => ({
			x: system.center[0] + radius * Math.cos(system.angles[orbitIndex]),
			y: system.center[1] + radius * Math.sin(system.angles[orbitIndex])
		}));

		trailsContext.strokeStyle = color;
		trailsContext.lineWidth = 0.65;
		trailsContext.globalAlpha = 0.045;
		trailsContext.beginPath();
		points.forEach((point, pointIndex) => {
			if (pointIndex === 0) trailsContext.moveTo(point.x, point.y);
			else trailsContext.lineTo(point.x, point.y);
		});
		trailsContext.closePath();
		trailsContext.stroke();
	});

	context.globalAlpha = 1;
	context.drawImage(trailsCanvas, 0, 0);

	systems.forEach((system, systemIndex) => {
		const color = colors[systemIndex % colors.length];
		const points = system.radii.map((radius, orbitIndex) => ({
			x: system.center[0] + radius * Math.cos(system.angles[orbitIndex]),
			y: system.center[1] + radius * Math.sin(system.angles[orbitIndex])
		}));
		context.strokeStyle = color;
		context.lineWidth = 0.75;

		system.radii.forEach((radius, orbitIndex) => {
			context.globalAlpha = 0.48;
			context.beginPath();
			context.arc(system.center[0], system.center[1], radius, 0, TWO_PI);
			context.stroke();

			context.fillStyle = color;
			context.globalAlpha = 0.9;
			context.beginPath();
			context.arc(
				points[orbitIndex].x,
				points[orbitIndex].y,
				1.8,
				0,
				TWO_PI
			);
			context.fill();

			system.angles[orbitIndex] += system.increments[orbitIndex];
		});
	});

	context.globalAlpha = 1;
	trailsContext.globalAlpha = 1;
};

export const OrbitalTrails = ({
	label,
	palette = 'brand',
	variant = 'grid',
	seed = 17,
	warmupFrames = 0,
	paused = false,
	className
}: OrbitalTrailsProps) => {
	const rootRef = useRef<HTMLDivElement>(null);
	const canvasRef = useRef<HTMLCanvasElement>(null);

	useEffect(() => {
		const root = rootRef.current;
		const canvas = canvasRef.current;
		const context = canvas?.getContext('2d');
		if (!root || !canvas || !context) return;
		const trailsCanvas = document.createElement('canvas');
		trailsCanvas.width = CANVAS_SIZE;
		trailsCanvas.height = CANVAS_SIZE;
		const trailsContext = trailsCanvas.getContext('2d');
		if (!trailsContext) return;

		const styles = window.getComputedStyle(root);
		const background = cssVariable(
			styles,
			'--orbital-trails-background',
			'#fcf9f9'
		);
		const colors = [
			cssVariable(styles, '--orbital-trails-color-1', '#b3261e'),
			cssVariable(styles, '--orbital-trails-color-2', '#77565a'),
			cssVariable(styles, '--orbital-trails-color-3', '#755a2f'),
			cssVariable(styles, '--orbital-trails-color-4', '#49454f')
		];
		const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);

		canvas.width = CANVAS_SIZE * pixelRatio;
		canvas.height = CANVAS_SIZE * pixelRatio;
		context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
		context.fillStyle = background;
		context.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
		trailsContext.fillStyle = background;
		trailsContext.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

		const systems = createOrbitalSystems(seed, variant);
		const initialFrames = Math.min(Math.max(warmupFrames, 0), MAX_FRAMES);
		for (let frame = 0; frame < initialFrames; frame += 1) {
			drawFrame(context, trailsContext, trailsCanvas, systems, colors);
		}

		const reducedMotion = window.matchMedia?.(
			'(prefers-reduced-motion: reduce)'
		).matches;
		if (paused || reducedMotion) {
			if (initialFrames === 0) {
				for (let frame = 0; frame < 180; frame += 1) {
					drawFrame(
						context,
						trailsContext,
						trailsCanvas,
						systems,
						colors
					);
				}
			}
			return;
		}

		let animationFrame = 0;
		let lastFrameTime = 0;
		let drawnFrames = initialFrames;
		let isVisible = true;

		const animate = (time: number) => {
			/* The budget is drawn: the canvas is complete and stays as it is. A
			   loader that waits indefinitely ("Ich warte") must not keep waking
			   the main thread at the refresh rate for nothing. */
			if (drawnFrames >= MAX_FRAMES) return;
			if (
				isVisible &&
				document.visibilityState !== 'hidden' &&
				drawnFrames < MAX_FRAMES &&
				time - lastFrameTime >= 30
			) {
				drawFrame(
					context,
					trailsContext,
					trailsCanvas,
					systems,
					colors
				);
				drawnFrames += 1;
				lastFrameTime = time;
			}
			animationFrame = window.requestAnimationFrame(animate);
		};

		/* Pausing off-screen is an optimisation, not a requirement: where the
		   API is missing the loader simply keeps drawing. */
		const observer =
			typeof IntersectionObserver === 'function'
				? new IntersectionObserver(([entry]) => {
						isVisible = entry.isIntersecting;
					})
				: null;
		observer?.observe(root);
		animationFrame = window.requestAnimationFrame(animate);

		return () => {
			observer?.disconnect();
			window.cancelAnimationFrame(animationFrame);
		};
	}, [palette, paused, seed, variant, warmupFrames]);

	return (
		<div
			ref={rootRef}
			className={clsx(
				'orbitalTrails',
				`orbitalTrails--${palette}`,
				className
			)}
			role="status"
			aria-label={label}
		>
			<canvas
				ref={canvasRef}
				className="orbitalTrails__canvas"
				width={CANVAS_SIZE}
				height={CANVAS_SIZE}
				aria-hidden="true"
			/>
		</div>
	);
};
