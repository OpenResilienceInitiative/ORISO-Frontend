// @vitest-environment jsdom

import * as React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { WelcomeScreen } from './WelcomeScreen';

/**
 * #83. Every info row centred its icon against the whole text block
 * (`alignItems: 'center'`), so the icon's vertical position depended on how
 * much text sat next to it. A row whose text is missing — or simply wraps to
 * one line instead of two — put its icon at a different height than its
 * neighbours, and the icons stopped reading as a column.
 */

const SUBLINE_BY_KEY: Record<string, string> = {
	'registration.welcomeScreen.info1.text': 'First explanation',
	'registration.welcomeScreen.info2.text': '',
	'registration.welcomeScreen.info3.text': 'Third explanation',
	'registration.welcomeScreen.info4.text': 'Fourth explanation'
};

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string) => (key in SUBLINE_BY_KEY ? SUBLINE_BY_KEY[key] : key)
	}),
	Trans: () => null
}));

vi.mock('../preselectionBox/PreselectionBox', () => ({
	PreselectionBox: () => null
}));

const renderWelcomeScreen = () =>
	render(
		<MemoryRouter>
			<WelcomeScreen nextStepUrl="/registration" />
		</MemoryRouter>
	);

const infoRows = () =>
	Array.from(document.querySelectorAll('[data-welcome-info-row]'));

describe('WelcomeScreen info rows', () => {
	afterEach(cleanup);

	it('renders one row per info section', () => {
		renderWelcomeScreen();

		expect(infoRows()).toHaveLength(4);
	});

	it('keeps the icon column aligned to the top instead of the text centre', () => {
		renderWelcomeScreen();

		// MUI compiles `sx` to emotion classes, so read the resolved value.
		infoRows().forEach((row) => {
			expect(window.getComputedStyle(row).alignItems).toBe('flex-start');
		});
	});

	it('gives every icon the same fixed-height column, whatever the text does', () => {
		renderWelcomeScreen();

		const heights = infoRows().map(
			(row) =>
				window.getComputedStyle(
					row.querySelector('[data-welcome-info-icon]') as HTMLElement
				).minHeight
		);

		expect(heights).toHaveLength(4);
		expect(new Set(heights).size).toBe(1);
		expect(heights[0]).toBe('30px');
	});

	it('renders no empty paragraph for a section without explanatory text', () => {
		renderWelcomeScreen();

		const rowWithoutText = infoRows()[1];

		expect(
			rowWithoutText.querySelectorAll('[data-welcome-info-subline]')
		).toHaveLength(0);
	});

	it('still renders the text of the sections that have it', () => {
		renderWelcomeScreen();

		expect(screen.getByText('First explanation')).toBeTruthy();
		expect(screen.getByText('Fourth explanation')).toBeTruthy();
	});
});
