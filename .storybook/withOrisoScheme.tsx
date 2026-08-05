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
import { useGlobals } from 'storybook/preview-api';
import {
	type OrisoSchemeName,
	computeOrisoPalette
} from '../src/utils/theme/orisoScheme';

/** The ORISO default tenant; the switcher previews schemes, not seeds. */
export const STORYBOOK_SEED = '#A5000A';

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

	useEffect(() => {
		const { tokens } = computeOrisoPalette(
			{ primary: STORYBOOK_SEED },
			active
		);
		const root = document.documentElement;
		for (const [name, value] of Object.entries(tokens)) {
			root.style.setProperty(name, value);
		}
		// The canvas is not a component, so it has no role of its own to
		// read; without this the story would sit on Storybook's white
		// while its content renders dark.
		document.body.style.backgroundColor = tokens['--m3-surface'];
		document.body.style.color = tokens['--m3-on-surface'];
		return (): void => {
			for (const name of Object.keys(tokens)) {
				root.style.removeProperty(name);
			}
			document.body.style.removeProperty('background-color');
			document.body.style.removeProperty('color');
		};
	}, [active]);

	return <Story />;
};
