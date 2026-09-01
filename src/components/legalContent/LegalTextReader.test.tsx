// @vitest-environment jsdom
import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	cleanup,
	fireEvent,
	render,
	screen,
	within
} from '@testing-library/react';
import { LegalTextReader } from './LegalTextReader';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string, fallback?: string) => fallback ?? key,
		i18n: { language: 'de' }
	})
}));

const POLICY = [
	'<h1>Datenschutzerklärung</h1>',
	'<p>Einleitung.</p>',
	'<h2>1. Verantwortlich</h2><p>Wer verantwortlich ist.</p>',
	'<h2>2. Ihre Rechte</h2><p>Auskunft, Berichtigung, Löschung.</p>'
].join('');

/** The chapter chip with this label — the heading carries the same text. */
const chip = (label: string): HTMLElement =>
	within(screen.getByTestId('legal-anchor-chips')).getByRole('button', {
		name: label
	});

describe('LegalTextReader', () => {
	afterEach(cleanup);

	it('offers one chip per chapter of the document, in document order', () => {
		render(<LegalTextReader content={POLICY} label="Datenschutz" />);

		const chips = within(screen.getByTestId('legal-anchor-chips'))
			.getAllByRole('button')
			.map((chip) => chip.textContent);

		expect(chips).toEqual([
			'Datenschutzerklärung',
			'1. Verantwortlich',
			'2. Ihre Rechte'
		]);
	});

	/**
	 * One chapter is a label, not a navigation. A row with a single chip is
	 * chrome that costs a line of screen and buys nothing.
	 */
	it('shows no chapter row for a text without chapters', () => {
		render(
			<LegalTextReader
				content="<p>Ein kurzer Hinweis.</p>"
				label="Hinweis"
			/>
		);

		expect(screen.queryByTestId('legal-anchor-chips')).toBeNull();
	});

	/**
	 * Focus, not just scroll: a keyboard or screen-reader user who picks a
	 * chapter and is left reading the previous one has not navigated anywhere.
	 */
	it('moves focus to the chapter that was picked', () => {
		render(<LegalTextReader content={POLICY} label="Datenschutz" />);

		fireEvent.click(chip('2. Ihre Rechte'));

		expect(document.activeElement?.id).toBe('2-ihre-rechte');
		expect(document.activeElement?.tagName).toBe('H2');
	});

	it('marks the picked chapter as the selected chip', () => {
		render(<LegalTextReader content={POLICY} label="Datenschutz" />);

		fireEvent.click(chip('2. Ihre Rechte'));

		expect(chip('2. Ihre Rechte').getAttribute('aria-pressed')).toBe(
			'true'
		);
	});

	it('opens and closes the fullscreen reading mode', () => {
		render(<LegalTextReader content={POLICY} label="Datenschutz" />);
		expect(screen.queryByTestId('legal-reader-fullscreen')).toBeNull();

		fireEvent.click(screen.getByTestId('legal-reader-fullscreen-toggle'));
		const fullscreen = screen.getByTestId('legal-reader-fullscreen');
		// It has to be a dialog to assistive technology, or a screen-reader user
		// is dropped into a text with no announced boundary.
		expect(fullscreen.getAttribute('role')).toBe('dialog');
		expect(fullscreen.getAttribute('aria-label')).toBe('Datenschutz');

		fireEvent.click(screen.getByTestId('legal-reader-fullscreen-toggle'));
		expect(screen.queryByTestId('legal-reader-fullscreen')).toBeNull();
	});

	it('hides the fullscreen affordance where the host has no room for it', () => {
		render(
			<LegalTextReader
				content={POLICY}
				label="Datenschutz"
				allowFullscreen={false}
			/>
		);

		expect(
			screen.queryByTestId('legal-reader-fullscreen-toggle')
		).toBeNull();
	});
});
