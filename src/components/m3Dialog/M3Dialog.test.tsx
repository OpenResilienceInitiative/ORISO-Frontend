// @vitest-environment jsdom
import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { M3Dialog } from './M3Dialog';

describe('M3Dialog', () => {
	afterEach(cleanup);

	it('renders the house anatomy: hero icon, title, description, body', () => {
		render(
			<M3Dialog
				title="Impressum"
				description="Wer die Plattform betreibt."
				icon={<svg data-testid="hero" />}
				onClose={() => undefined}
			>
				<p>Platzhaltertext.</p>
			</M3Dialog>
		);

		expect(screen.getByTestId('hero')).toBeTruthy();
		expect(screen.getByRole('heading', { name: 'Impressum' })).toBeTruthy();
		expect(screen.getByText('Wer die Plattform betreibt.')).toBeTruthy();
		expect(screen.getByText('Platzhaltertext.')).toBeTruthy();
	});

	/**
	 * The reason this component exists rather than a variant of `OrisoDialog`:
	 * a published legal text is longer than the sheet is tall, and only the
	 * body may scroll — otherwise the hero icon and the actions scroll away
	 * with it.
	 */
	it('puts the scroll region on the body and gives it a keyboard tab stop', () => {
		const { container } = render(
			<M3Dialog title="Datenschutz" onClose={() => undefined}>
				<p>Langer Text.</p>
			</M3Dialog>
		);

		const body = container.ownerDocument.querySelector('.m3Dialog__body');
		expect(body).toBeTruthy();
		// WCAG 2.1.1: without the tab stop a keyboard-only reader cannot scroll
		// the rest of the text at all.
		expect(body?.getAttribute('tabindex')).toBe('0');
	});

	it('renders the actions in the given order and calls each handler', () => {
		const onCancel = vi.fn();
		const onConfirm = vi.fn();

		render(
			<M3Dialog
				title="Beenden?"
				onClose={() => undefined}
				actions={[
					{ label: 'Abbrechen', onClick: onCancel },
					{ label: 'Beenden', onClick: onConfirm, primary: true }
				]}
			/>
		);

		const buttons = screen
			.getAllByRole('button')
			.filter((button) => button.className.includes('m3Dialog__action'));
		expect(buttons.map((button) => button.textContent)).toEqual([
			'Abbrechen',
			'Beenden'
		]);

		fireEvent.click(screen.getByText('Abbrechen'));
		expect(onCancel).toHaveBeenCalledTimes(1);
		expect(onConfirm).not.toHaveBeenCalled();

		fireEvent.click(screen.getByText('Beenden'));
		expect(onConfirm).toHaveBeenCalledTimes(1);
	});

	/**
	 * Only the confirming action carries colour. A row where every button is
	 * primary reads as "all equally likely", which is exactly what the M3
	 * neutral/primary split exists to prevent.
	 */
	it('colours only the primary action', () => {
		render(
			<M3Dialog
				title="Beenden?"
				onClose={() => undefined}
				actions={[
					{ label: 'Abbrechen', onClick: () => undefined },
					{
						label: 'Beenden',
						onClick: () => undefined,
						primary: true
					}
				]}
			/>
		);

		expect(
			screen.getByText('Abbrechen').className.includes('--primary')
		).toBe(false);
		expect(
			screen.getByText('Beenden').className.includes('--primary')
		).toBe(true);
	});

	it('marks the error variant so the error role can paint it', () => {
		const { baseElement } = render(
			<M3Dialog
				severity="error"
				title="Senden fehlgeschlagen"
				onClose={() => undefined}
			/>
		);

		expect(baseElement.querySelector('.m3Dialog--error')).toBeTruthy();
	});

	it('does not mark a plain message box as an error', () => {
		const { baseElement } = render(
			<M3Dialog title="Gespeichert" onClose={() => undefined} />
		);

		expect(baseElement.querySelector('.m3Dialog--error')).toBeNull();
	});

	it('names the ✕ with the caller-supplied label', () => {
		render(
			<M3Dialog
				title="Impressum"
				closeLabel="Schließen"
				onClose={() => undefined}
			/>
		);

		// The label is translated by the caller — the dialog itself never calls
		// `t`, so a hardcoded English name here would reach every locale.
		expect(
			screen.getByTestId('m3-dialog-close').getAttribute('aria-label')
		).toBe('Schließen');
	});

	it('closes via the ✕ affordance and can be built without one', () => {
		const onClose = vi.fn();
		const { rerender } = render(
			<M3Dialog title="Hinweis" onClose={onClose} />
		);

		fireEvent.click(screen.getByTestId('m3-dialog-close'));
		expect(onClose).toHaveBeenCalledTimes(1);

		rerender(
			<M3Dialog title="Hinweis" onClose={onClose} closable={false} />
		);
		expect(screen.queryByTestId('m3-dialog-close')).toBeNull();
	});

	it('names itself to assistive technology through title and description', () => {
		render(
			<M3Dialog
				title="Impressum"
				description="Wer die Plattform betreibt."
				onClose={() => undefined}
			/>
		);

		const dialog = screen.getByRole('dialog');
		const heading = screen.getByRole('heading', { name: 'Impressum' });
		expect(dialog.getAttribute('aria-labelledby')).toBe(
			heading.getAttribute('id')
		);
		expect(dialog.getAttribute('aria-describedby')).toBe(
			screen.getByText('Wer die Plattform betreibt.').getAttribute('id')
		);
	});
});
