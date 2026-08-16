import { orisoInputColors } from '../form/orisoInputDesign';

/**
 * Tokens for the shared step indicator. Colours come from the one ORISO colour
 * source (`orisoInputColors`) rather than being restated here — no invented
 * roles, and every M3 custom property keeps its literal fallback so the
 * m3Sweep guard stays green.
 *
 * `outline` is the divider tone: default outline, per Frank 2026-08-06.
 */
export const stepperColors = {
	primary: orisoInputColors.primary,
	onPrimary: orisoInputColors.onPrimary,
	onSurface: orisoInputColors.onSurface,
	onSurfaceVariant: orisoInputColors.onSurfaceVariant,
	outline: orisoInputColors.outline,
	surface: orisoInputColors.surface,
	surfaceContainer: orisoInputColors.surfaceContainer,
	surfaceContainerHigh: orisoInputColors.surfaceContainerHigh,
	/**
	 * The unfilled progress segments. `orisoInputColors` stops at
	 * `surfaceContainerHigh`, but the design specifies the *highest* step, and
	 * the token exists in the scheme — one tone too light and the segments stop
	 * reading as "not yet".
	 */
	surfaceContainerHighest: 'var(--m3-surface-container-highest, #e4e2e2)',
	selectedLayer: orisoInputColors.selectedLayer,
	focusLayer: orisoInputColors.focusLayer
} as const;

export const stepperMotion = {
	quick: '180ms',
	standard: '200ms'
} as const;
