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
const MAX_FRAMES = 1200;

export type OrbitalPalette = 'brand' | 'mixed' | 'neutral';

export interface OrbitalSystem {
	center: readonly [number, number];
	angles: [number, number, number];
	increments: [number, number, number];
}

export interface OrbitalTrailsProps {
	label: string;
	palette?: OrbitalPalette;
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

export const createOrbitalSystems = (seed: number): OrbitalSystem[] => {
	const random = seededRandom(seed);

	return CENTERS.map((center) => ({
		center,
		angles: [random() * TWO_PI, random() * TWO_PI, random() * TWO_PI],
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
		const points = RADII.map((radius, orbitIndex) => ({
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
		const points = RADII.map((radius, orbitIndex) => ({
			x: system.center[0] + radius * Math.cos(system.angles[orbitIndex]),
			y: system.center[1] + radius * Math.sin(system.angles[orbitIndex])
		}));
		context.strokeStyle = color;
		context.lineWidth = 0.75;

		RADII.forEach((radius, orbitIndex) => {
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

		const systems = createOrbitalSystems(seed);
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

		const observer = new IntersectionObserver(([entry]) => {
			isVisible = entry.isIntersecting;
		});
		observer.observe(root);
		animationFrame = window.requestAnimationFrame(animate);

		return () => {
			observer.disconnect();
			window.cancelAnimationFrame(animationFrame);
		};
	}, [palette, paused, seed, warmupFrames]);

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
