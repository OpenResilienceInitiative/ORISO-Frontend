// @vitest-environment jsdom
import * as React from 'react';
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { RegistrationFooter } from './RegistrationFooter';

/**
 * # What this file is for
 *
 * Frank, 2026-09-22, on the postcode step of the phone registration: "wenn ich
 * da das Textboxfeld wegen den Zahlen eingebe, springt der nicht mit nach oben,
 * was total komfortabel wäre, dann weiß ich nämlich, was ich als nächstes
 * machen muss."
 *
 * The bar is `position: fixed; bottom: 0`, which is a position in the *layout*
 * viewport, and opening the software keyboard does not change that viewport.
 * So the bar keeps the place it had and the keyboard is simply drawn over it.
 * These tests hold the bar to the visible bottom edge instead.
 */

const listeners: Record<string, Array<() => void>> = {};

const installViewport = (layoutHeight: number) => {
	Object.keys(listeners).forEach((key) => delete listeners[key]);
	Object.defineProperty(window, 'innerHeight', {
		value: layoutHeight,
		configurable: true,
		writable: true
	});
	const viewport = {
		height: layoutHeight,
		offsetTop: 0,
		addEventListener: (type: string, listener: () => void) => {
			listeners[type] = [...(listeners[type] ?? []), listener];
		},
		removeEventListener: (type: string, listener: () => void) => {
			listeners[type] = (listeners[type] ?? []).filter(
				(entry) => entry !== listener
			);
		}
	};
	Object.defineProperty(window, 'visualViewport', {
		value: viewport,
		configurable: true,
		writable: true
	});
	return viewport;
};

const settle = () =>
	act(async () => {
		await new Promise((resolve) => setTimeout(resolve, 32));
	});

const openKeyboard = async (
	viewport: { height: number },
	visibleHeight: number
) => {
	viewport.height = visibleHeight;
	await act(async () => {
		(listeners.resize ?? []).forEach((listener) => listener());
		await new Promise((resolve) => setTimeout(resolve, 32));
	});
};

const bar = () =>
	document.querySelector('[data-cy="registration-footer"]') as HTMLElement;

afterEach(() => {
	cleanup();
	Object.defineProperty(window, 'visualViewport', {
		value: undefined,
		configurable: true,
		writable: true
	});
});

describe('registration footer — the on-screen keyboard', () => {
	it('rides above the keyboard while it is up, and returns to the screen edge when it closes', async () => {
		const viewport = installViewport(844);

		render(<RegistrationFooter animateIn primary={{ label: 'Weiter' }} />);
		await settle();

		expect(
			bar().style.bottom,
			'nothing is covered, so the bar keeps the stylesheet position'
		).toBe('');

		await openKeyboard(viewport, 508);

		expect(bar().style.bottom).toBe('336px');
		expect(bar().getAttribute('data-keyboard-inset')).toBe('336');

		await openKeyboard(viewport, 844);

		expect(bar().style.bottom).toBe('');
		expect(bar().getAttribute('data-keyboard-inset')).toBe(null);
	});

	it('keeps its place where the browser cannot report a keyboard', async () => {
		Object.defineProperty(window, 'visualViewport', {
			value: undefined,
			configurable: true,
			writable: true
		});

		render(<RegistrationFooter primary={{ label: 'Weiter' }} />);
		await settle();

		expect(bar().style.bottom).toBe('');
	});
});
