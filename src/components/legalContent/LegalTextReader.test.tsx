// @vitest-environment jsdom
import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
	within
} from '@testing-library/react';
import { LegalTextReader } from './LegalTextReader';

let mockLanguage = 'de';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string, fallback?: string) => fallback ?? key,
		i18n: { language: mockLanguage }
	})
}));

/** A machine-translated map, so the renderer offers "Original anzeigen". */
const TRANSLATED = JSON.stringify({
	de: '<h2>Erstes Kapitel</h2><p>Verbindliche deutsche Fassung.</p><h2>Zweites Kapitel</h2>',
	en: '<h2>First chapter</h2><p>Machine translated text.</p><h2>Second chapter</h2>',
	en__meta: JSON.stringify({ mt: true, src: 'de' })
});

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
	afterEach(() => {
		cleanup();
		mockLanguage = 'de';
	});

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

	/**
	 * The toggle has broken more than once, so both directions are pinned, not
	 * just the opening one.
	 */
	it('returns focus to the toggle when fullscreen is left', async () => {
		render(<LegalTextReader content={POLICY} label="Datenschutz" />);
		const toggle = screen.getByTestId('legal-reader-fullscreen-toggle');
		toggle.focus();

		fireEvent.click(toggle);
		// The layer takes focus, so a keyboard reader is inside the document.
		expect(document.activeElement).toBe(
			screen.getByTestId('legal-reader-fullscreen')
		);

		fireEvent.click(screen.getByTestId('legal-reader-fullscreen-toggle'));
		await waitFor(() =>
			expect(document.activeElement).toBe(
				screen.getByTestId('legal-reader-fullscreen-toggle')
			)
		);
	});

	it('leaves fullscreen on Escape', () => {
		render(<LegalTextReader content={POLICY} label="Datenschutz" />);
		fireEvent.click(screen.getByTestId('legal-reader-fullscreen-toggle'));
		expect(screen.getByTestId('legal-reader-fullscreen')).toBeTruthy();

		fireEvent.keyDown(document, { key: 'Escape' });

		expect(screen.queryByTestId('legal-reader-fullscreen')).toBeNull();
	});

	/**
	 * Fullscreen covers the host dialog's own ✕, so without this the only way
	 * out of a full-screen legal text is to leave fullscreen first.
	 */
	it('offers a close control in fullscreen when the host gives it one', () => {
		const onClose = vi.fn();
		render(
			<LegalTextReader
				content={POLICY}
				label="Datenschutz"
				onClose={onClose}
			/>
		);
		expect(screen.queryByTestId('legal-reader-close')).toBeNull();

		fireEvent.click(screen.getByTestId('legal-reader-fullscreen-toggle'));
		fireEvent.click(screen.getByTestId('legal-reader-close'));

		expect(onClose).toHaveBeenCalledTimes(1);
	});

	it('marks the fullscreen control as the exit variant while it is open', () => {
		render(<LegalTextReader content={POLICY} label="Datenschutz" />);
		const toggle = () =>
			screen.getByTestId('legal-reader-fullscreen-toggle');
		expect(toggle().className).not.toContain('--exit');

		fireEvent.click(toggle());

		expect(toggle().className).toContain('--exit');
	});

	/**
	 * `LegalContentRenderer` swaps its whole subtree from its OWN state when a
	 * reader flips a machine-translated document to the original. No prop of the
	 * reader changes, so without watching the DOM the chips would keep the
	 * previous language's labels and point at headings that are gone.
	 */
	it('re-reads the chapters when the rendered text is swapped underneath it', async () => {
		render(<LegalTextReader content={POLICY} label="Datenschutz" />);
		expect(chip('2. Ihre Rechte')).toBeTruthy();

		const text = document.querySelector('.legalTextReader__text');
		const rendered = text?.firstElementChild as HTMLElement;
		rendered.innerHTML = '<h2>Chapter one</h2><h2>Chapter two</h2>';

		await waitFor(() => expect(chip('Chapter one')).toBeTruthy());
		expect(chip('Chapter two')).toBeTruthy();
		expect(
			within(screen.getByTestId('legal-anchor-chips')).queryByRole(
				'button',
				{ name: '2. Ihre Rechte' }
			)
		).toBeNull();
	});

	/**
	 * The layer covers the host dialog but renders inside it, so without a trap
	 * Tab walks on to the host's close/Back/Confirm buttons behind the overlay —
	 * which is exactly what its `aria-modal` tells a screen reader cannot happen.
	 */
	it('keeps Tab inside the fullscreen layer', () => {
		render(
			<LegalTextReader
				content={POLICY}
				label="Datenschutz"
				onClose={() => undefined}
			/>
		);
		fireEvent.click(screen.getByTestId('legal-reader-fullscreen-toggle'));
		const layer = screen.getByTestId('legal-reader-fullscreen');
		expect(layer.getAttribute('aria-modal')).toBe('true');

		const close = screen.getByTestId('legal-reader-close');
		close.focus();
		// Tab off the LAST control wraps to the first instead of leaving.
		const forward = fireEvent.keyDown(document, { key: 'Tab' });
		expect(forward).toBe(false);
		expect(layer.contains(document.activeElement)).toBe(true);
	});

	/**
	 * The reason the fullscreen toggle "kept breaking": returning a bare body
	 * when windowed and a wrapped one in fullscreen changed the returned
	 * element's TYPE, so React unmounted the whole subtree on every toggle —
	 * including `LegalContentRenderer`'s own show-original state. A reader who
	 * had switched a machine-translated document to the binding German original
	 * was silently flipped back to the translation by pressing fullscreen.
	 */
	it('keeps the show-original choice across a fullscreen toggle', () => {
		// English UI, so the machine-translated English version is the one
		// shown and the "show original" escape hatch is offered.
		mockLanguage = 'en';
		render(<LegalTextReader content={TRANSLATED} label="Datenschutz" />);

		fireEvent.click(screen.getByText('Original anzeigen'));
		expect(screen.getByText('Verbindliche deutsche Fassung.')).toBeTruthy();

		fireEvent.click(screen.getByTestId('legal-reader-fullscreen-toggle'));

		expect(screen.getByText('Verbindliche deutsche Fassung.')).toBeTruthy();
		expect(screen.queryByText('Machine translated text.')).toBeNull();
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
