/**
 * The stage effect a tenant has chosen for its login screen.
 *
 * Stored per tenant as `theming.loginEffect`; `none` is the default and keeps
 * the login screen exactly as it is today (cursor light cone only).
 */
export type StageEffectName = 'none' | 'lines' | 'connectedDots' | 'cracks';

export const STAGE_EFFECT_NAMES: StageEffectName[] = [
	'none',
	'lines',
	'connectedDots',
	'cracks'
];

export const isStageEffectName = (
	value: unknown
): value is StageEffectName =>
	typeof value === 'string' &&
	(STAGE_EFFECT_NAMES as string[]).includes(value);

export interface StageEffectContext {
	/** The canvas the effect draws into. Already sized for the device pixel ratio. */
	canvas: HTMLCanvasElement;
	/** The stage element — the effect reads pointer position relative to it. */
	host: HTMLElement;
	/** CSS pixel size of the canvas (not device pixels). */
	width: number;
	height: number;
	/** 0.4 … 1.6. Tenants may dial an effect down without switching it off. */
	intensity: number;
	/**
	 * True when the visitor asked for reduced motion. Effects must still render
	 * a sensible resting frame — they simply must not move.
	 */
	reducedMotion: boolean;
}

export interface StageEffect {
	/** Called once per animation frame while the stage is on screen. */
	frame: (elapsedSeconds: number) => void;
	/** Release listeners, timers and offscreen canvases. */
	destroy?: () => void;
}

export type StageEffectFactory = (
	context: StageEffectContext
) => StageEffect | null;
