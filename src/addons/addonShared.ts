import * as React from 'react';
import * as ReactDOMClient from 'react-dom/client';
import * as jsxRuntime from 'react/jsx-runtime';
import { ADDON_CONTRACT } from './addonTypes';
import { webKit } from './kit';

export const ADDON_SHARED_GLOBAL = '__ORISO_ADDON_SHARED__';

/**
 * Add-ons use the host's React and component kit instead of bundling their own (ADR-034).
 * Their build maps `react`, `react-dom/client`, `react/jsx-runtime` and `@oriso/web-kit`
 * onto this global.
 */
export const installAddonShared = (
	target: Record<string, unknown> = globalThis as never
) => {
	target[ADDON_SHARED_GLOBAL] = Object.freeze({
		contract: ADDON_CONTRACT,
		react: React,
		reactDomClient: ReactDOMClient,
		jsxRuntime,
		kit: webKit
	});
};
