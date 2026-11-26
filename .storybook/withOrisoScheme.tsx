/**
 * Scheme switcher for Storybook (Frontend#898).
 *
 * Applies a computed OrisoScheme palette to the story canvas so any
 * component can be viewed in light, dark or inverted. The values come
 * from `computeOrisoPalette` at render time — there is no second copy of
 * the palette to go stale.
 *
 * The contrast toolbar uses the same generator as the application. The
 * Inverted preview continues to use its existing Admin palette.
 */
import * as React from 'react';
import { useLayoutEffect } from 'react';
import type { GlobalTypes } from 'storybook/internal/types';
import { useGlobals, useParameter } from 'storybook/preview-api';
import {
	type OrisoSchemeName,
	type OrisoSeeds,
	computeOrisoPalette
} from '../src/utils/theme/orisoScheme';
import { parseContrastLevel } from '../src/features/personal-display/preferences';
import { THEME_APPLIED_EVENT } from '../src/utils/theme/applyTenantTheme';

/** The ORISO default tenant; the switcher previews schemes, not seeds. */
export const STORYBOOK_SEED = '#A5000A';

/**
 * A story can set `parameters.orisoSeed` to render with a Träger's own
 * brand colour, e.g. a light one that must still yield legible text.
 */
export const ORISO_SEED_PARAMETER = 'orisoSeed';
const ORISO_SEEDS_PARAMETER = 'orisoSeeds';

export const orisoSchemeGlobalType: GlobalTypes = {
	scheme: {
		name: 'Scheme',
		description: 'ORISO colour scheme applied to the story canvas',
		toolbar: {
			icon: 'paintbrush',
			items: [
				{ value: 'light', title: 'Light' },
				{ value: 'dark', title: 'Dark' },
				{ value: 'inverted', title: 'Inverted (admin)' }
			],
			dynamicTitle: true
		}
	},
	contrast: {
		name: 'Contrast',
		description: 'ORISO contrast level',
		toolbar: {
			icon: 'circlehollow',
			items: [
				{ value: 'standard', title: 'Standard' },
				{ value: 'medium', title: 'Medium' },
				{ value: 'high', title: 'High' }
			],
			dynamicTitle: true
		}
	}
};

/**
 * Runs `change` with every CSS transition switched off, so a scheme switch
 * repaints at once. Without it, a component whose colours transition (the
 * session-list chips: 480 ms) still shows a light/dark mix when a story's
 * play function measures contrast (2.85:1 instead of 11.3:1 in CI).
 */
const withoutTransitions = (change: () => void) => {
	const freeze = document.createElement('style');
	freeze.textContent =
		'*, *::before, *::after { transition: none !important; }';
	document.head.appendChild(freeze);
	change();
	// Commit the new colours while transitions are off.
	void getComputedStyle(document.documentElement).color;
	void document.body.offsetHeight;
	freeze.remove();
};

const isScheme = (value: unknown): value is OrisoSchemeName =>
	value === 'light' || value === 'dark' || value === 'inverted';

export const withOrisoScheme = function OrisoSchemeDecorator(
	Story: React.ComponentType
): React.ReactElement {
	const [{ scheme, contrast }] = useGlobals();
	const active: OrisoSchemeName = isScheme(scheme) ? scheme : 'light';
	const seed = useParameter<string>(ORISO_SEED_PARAMETER, STORYBOOK_SEED);
	const seeds = useParameter<OrisoSeeds | null>(ORISO_SEEDS_PARAMETER, null);
	const level =
		active === 'inverted' ? 'standard' : parseContrastLevel(contrast);

	// Before paint, so the story's first frame already has the scheme.
	useLayoutEffect(() => {
		const { tokens } = computeOrisoPalette(
			seeds ?? { primary: seed },
			active,
			level
		);
		const root = document.documentElement;
		withoutTransitions(() => {
			if (active !== 'inverted') {
				root.dataset.orisoPersonalScheme = active;
				root.dataset.orisoContrastLevel = level;
			}
			for (const [name, value] of Object.entries(tokens)) {
				root.style.setProperty(name, value);
			}
			// The canvas is not a component, so it has no role of its own to
			// read; without this the story would sit on Storybook's white
			// while its content renders dark.
			document.body.style.backgroundColor = tokens['--m3-surface'];
			document.body.style.color = tokens['--m3-on-surface'];
		});
		const rebuildMui =
			active === 'dark' ||
			level !== 'standard' ||
			seeds !== null ||
			seed !== STORYBOOK_SEED;
		const announce = () => {
			if (!rebuildMui) return;
			// Include subscribers mounted in the same passive-effect flush.
			queueMicrotask(() =>
				window.dispatchEvent(new CustomEvent(THEME_APPLIED_EVENT))
			);
		};
		announce();
		return () => {
			withoutTransitions(() => {
				for (const name of Object.keys(tokens)) {
					root.style.removeProperty(name);
				}
				delete root.dataset.orisoPersonalScheme;
				delete root.dataset.orisoContrastLevel;
				document.body.style.removeProperty('background-color');
				document.body.style.removeProperty('color');
			});
			announce();
		};
	}, [active, level, seed, seeds]);

	return <Story />;
};
