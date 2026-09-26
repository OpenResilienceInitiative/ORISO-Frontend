/**
 * Scheme switcher for Storybook (Frontend#898).
 *
 * Applies a computed OrisoScheme palette to the story canvas so any
 * component can be viewed in light, dark or inverted. The values come
 * from `computeOrisoPalette` at render time — there is no second copy of
 * the palette to go stale.
 *
 * This is a Storybook-only capability. It does not touch
 * `ACTIVE_SCHEMES`: dark stays off for the running app.
 *
 * Expect components to look wrong in dark. That is the finding this
 * switcher exists to surface, not a regression it introduces.
 */
import * as React from 'react';
import { useEffect } from 'react';
import type { GlobalTypes } from 'storybook/internal/types';
import { useGlobals, useParameter } from 'storybook/preview-api';
import {
	type OrisoSchemeName,
	computeOrisoPalette
} from '../src/utils/theme/orisoScheme';
import { THEME_APPLIED_EVENT } from '../src/utils/theme/applyTenantTheme';

/** The ORISO default tenant; the switcher previews schemes, not seeds. */
export const STORYBOOK_SEED = '#A5000A';

/**
 * A story can set `parameters.orisoSeed` to render with a Träger's own
 * brand colour, e.g. a light one that must still yield legible text.
 */
export const ORISO_SEED_PARAMETER = 'orisoSeed';

export const orisoSchemeGlobalType: GlobalTypes = {
	scheme: {
		name: 'Scheme',
		description: 'ORISO colour scheme applied to the story canvas',
		toolbar: {
			icon: 'paintbrush',
			items: [
				{ value: 'light', title: 'Light (shipping)' },
				{ value: 'dark', title: 'Dark (call UI only)' },
				{ value: 'inverted', title: 'Inverted (admin)' }
			],
			dynamicTitle: true
		}
	}
};

const isScheme = (value: unknown): value is OrisoSchemeName =>
	value === 'light' || value === 'dark' || value === 'inverted';

export const withOrisoScheme = (
	Story: React.ComponentType
): React.ReactElement => {
	const [{ scheme }] = useGlobals();
	const active: OrisoSchemeName = isScheme(scheme) ? scheme : 'light';
	const seed = useParameter<string>(ORISO_SEED_PARAMETER, STORYBOOK_SEED);

	useEffect(() => {
		const { tokens } = computeOrisoPalette({ primary: seed }, active);
		const root = document.documentElement;
		for (const [name, value] of Object.entries(tokens)) {
			root.style.setProperty(name, value);
		}
		// The canvas is not a component, so it has no role of its own to
		// read; without this the story would sit on Storybook's white
		// while its content renders dark.
		document.body.style.backgroundColor = tokens['--m3-surface'];
		document.body.style.color = tokens['--m3-on-surface'];
		// Only a story seed rebuilds the MUI theme, so the other stories
		// render exactly as before.
		const announce = (): void => {
			if (seed !== STORYBOOK_SEED) {
				window.dispatchEvent(new CustomEvent(THEME_APPLIED_EVENT));
			}
		};
		announce();
		return (): void => {
			for (const name of Object.keys(tokens)) {
				root.style.removeProperty(name);
			}
			document.body.style.removeProperty('background-color');
			document.body.style.removeProperty('color');
			announce();
		};
	}, [active, seed]);

	return <Story />;
};
