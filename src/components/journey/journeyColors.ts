import { orisoInputColors } from '../form/orisoInputDesign';

/**
 * Every colour the journey components use, each one a design token (Frank, 2026-11-20: only
 * fixed tokens, so a dark or inverted scheme holds). The `--m3-*` roles come from the tenant's
 * scheme (`orisoScheme`); the literal after the comma is only the light fallback where no
 * scheme is injected. Unlike `orisoInputColors`, the layers and the error here are tokens too.
 */
export const journeyColors = {
	...orisoInputColors,
	error: 'var(--m3-error, #b1005e)',
	selectedLayer: 'var(--m3-selected-layer, #f5e6e7)',
	hoverLayer: 'var(--m3-hover-layer, #f9eff0)',
	background: 'var(--m3-background, #fcf9f9)'
} as const;

/**
 * A shadow in the scheme's shadow colour at `percent` strength. An engine without
 * `color-mix()` drops it, which only loses the shadow — nothing a person needs.
 */
export const journeyShadow = (blur: string, percent: number) =>
	`${blur} color-mix(in srgb, var(--m3-shadow, #000000) ${percent}%, transparent)`;
