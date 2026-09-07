// @vitest-environment jsdom
import * as React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ErstantwortNotifyChoice } from './ErstantwortNotifyChoice';

/* No i18next mock: the molecule takes an optional `translate` and falls back to
   its German copy map, so the tests exercise exactly what Storybook renders. */

describe('ErstantwortNotifyChoice (Modul 2, Vorschlag 07.09.2026)', () => {
	afterEach(cleanup);

	it('offers e-mail and browser as equals, each with its own button, plus the combination', () => {
		render(
			<ErstantwortNotifyChoice
				isEmailOpen
				browserState="available"
				onChoose={() => undefined}
			/>
		);

		expect(screen.getAllByRole('button')).toHaveLength(3);
		expect(screen.getByText(/E-Mail-Adresse eingeben/i)).toBeTruthy();
		expect(screen.getByText(/Benachrichtigungen erlauben/i)).toBeTruthy();
		expect(screen.getByText(/Beides einrichten/i)).toBeTruthy();
	});

	it('reports the chosen channel to the caller', () => {
		const onChoose = vi.fn();
		render(
			<ErstantwortNotifyChoice
				isEmailOpen
				browserState="available"
				onChoose={onChoose}
			/>
		);

		fireEvent.click(screen.getByText(/Benachrichtigungen erlauben/i));

		expect(onChoose).toHaveBeenCalledWith('BROWSER');
	});

	it('renders no button at all without a handler — an enabled control that does nothing is worse than none', () => {
		render(
			<ErstantwortNotifyChoice isEmailOpen browserState="available" />
		);

		expect(screen.queryAllByRole('button')).toHaveLength(0);
	});

	it('keeps the e-mail text and drops its button once an address is on file', () => {
		render(
			<ErstantwortNotifyChoice
				isEmailOpen={false}
				browserState="available"
				onChoose={() => undefined}
			/>
		);

		expect(screen.getByText(/E-Mail-Adresse hinterlegen/i)).toBeTruthy();
		expect(screen.queryByText(/E-Mail-Adresse eingeben/i)).toBeNull();
		expect(screen.getByText(/ist hinterlegt/i)).toBeTruthy();
	});

	it('drops the combination once one of the two halves is settled', () => {
		render(
			<ErstantwortNotifyChoice
				isEmailOpen={false}
				browserState="available"
				onChoose={() => undefined}
			/>
		);

		expect(screen.queryByText(/Beides einrichten/i)).toBeNull();
		expect(screen.getAllByRole('button')).toHaveLength(1);
	});

	it('never offers a browser signal the device cannot deliver', () => {
		render(
			<ErstantwortNotifyChoice
				isEmailOpen
				browserState="unsupported"
				onChoose={() => undefined}
			/>
		);

		expect(screen.queryByText(/Benachrichtigungen erlauben/i)).toBeNull();
		expect(screen.queryByText(/Benachrichtigungen des Browsers/i)).toBeNull();
		expect(screen.getAllByRole('button')).toHaveLength(1);
	});

	it('says out loud that a browser signal reaches one device only', () => {
		render(
			<ErstantwortNotifyChoice
				isEmailOpen
				browserState="available"
				onChoose={() => undefined}
			/>
		);

		expect(screen.getByText(/nur für dieses Gerät/i)).toBeTruthy();
	});

	it('reports a granted permission instead of asking again', () => {
		render(
			<ErstantwortNotifyChoice
				isEmailOpen
				browserState="granted"
				onChoose={() => undefined}
			/>
		);

		expect(screen.getByText(/sind aktiviert/i)).toBeTruthy();
		expect(
			screen.queryByRole('button', {
				name: /Benachrichtigungen erlauben/i
			})
		).toBeNull();
	});

	it('offers no button when the browser has blocked us — requestPermission would resolve to denied with no prompt', () => {
		render(
			<ErstantwortNotifyChoice
				isEmailOpen
				browserState="blocked"
				onChoose={() => undefined}
			/>
		);

		expect(screen.getByText(/abgelehnt/i)).toBeTruthy();
		expect(
			screen.queryByRole('button', {
				name: /Benachrichtigungen erlauben/i
			})
		).toBeNull();
		/* Only the e-mail action survives — and the blocked copy points at it. */
		expect(screen.getAllByRole('button')).toHaveLength(1);
		expect(screen.getByText(/E-Mail-Adresse eingeben/i)).toBeTruthy();
	});

	/*
	 * Franks Anforderung 4 vom 07.09.2026: je Auswahlfeld ein führendes Symbol
	 * aus der vorhandenen Bibliothek. Geprüft wird die Zuordnung, nicht die
	 * Pfaddaten — Vitest ersetzt jede `.svg` durch einen Stub (`vitest.config.mts`),
	 * es gibt also gar keine Pfade zu prüfen. Was hier schiefgehen kann, ist
	 * genau eins: eine Option ohne Symbol, oder ein Symbol, das der Screenreader
	 * zusätzlich zur Beschriftung vorliest.
	 */
	it('gives every option a leading icon that screen readers skip', () => {
		const { container } = render(
			<ErstantwortNotifyChoice
				isEmailOpen
				browserState="available"
				onChoose={() => undefined}
			/>
		);

		const icons = container.querySelectorAll('.erstantwortNotify__icon');

		expect(icons).toHaveLength(3);
		icons.forEach((icon) =>
			expect(icon.getAttribute('aria-hidden')).toBe('true')
		);
	});
});
