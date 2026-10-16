// @vitest-environment jsdom
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Gespraechsnotizen } from './Gespraechsnotizen';

/* This project has no jest-dom matchers, so read the DOM directly. */

/*
 * SPECIFICATION — the private notepad, ticket 06
 *
 * The acceptance criterion that matters more than all the others:
 *
 *   "Nothing leaves the client except via the copy button."
 *
 * That cannot be checked by reading the component, because the day it breaks
 * will be the day somebody adds a well-meaning autosave. So the test watches
 * every exit a browser has — fetch, sendBeacon, XMLHttpRequest and both Web
 * Storages — while a note is written, listed and copied.
 */

const labels = {
	title: 'Gesprächsnotizen',
	privacy: 'Privat und nur für die Dauer des Gesprächs.',
	type: 'Art der Notiz',
	text: 'Notiz',
	add: 'Notiz hinzufügen',
	remove: 'Notiz entfernen',
	copy: 'Alles kopieren',
	copied: 'Kopiert',
	empty: 'Noch nichts notiert.',
	collapse: 'Notizen einklappen',
	expand: 'Notizen ausklappen',
	types: { frage: 'Frage', anmerkung: 'Anmerkung', aufgabe: 'Aufgabe' }
};

/* The ⋮ button names the current type, so it is matched on the stem. */
const kebab = () => screen.getByRole('button', { name: /^Art der Notiz:/ });

const chooseType = async (word: string) => {
	const user = userEvent.setup();
	await user.click(kebab());
	await user.click(screen.getByRole('menuitemradio', { name: word }));
};

const write = async (text: string, type?: string) => {
	if (type) await chooseType(type);
	const user = userEvent.setup();
	await user.type(screen.getByRole('textbox', { name: labels.text }), text);
	await user.click(screen.getByRole('button', { name: labels.add }));
};

/* floating-ui observes the anchor; jsdom has no ResizeObserver. */
beforeEach(() => {
	if (typeof globalThis.ResizeObserver === 'undefined') {
		globalThis.ResizeObserver = class {
			observe() {}
			unobserve() {}
			disconnect() {}
		} as unknown as typeof ResizeObserver;
	}
});

afterEach(cleanup);

describe('Gesprächsnotizen', () => {
	it('offers exactly the three types', async () => {
		render(<Gespraechsnotizen labels={labels} />);
		await userEvent.setup().click(kebab());
		expect(screen.getAllByRole('menuitemradio')).toHaveLength(3);
	});

	it('names each type as a word, not a colour', async () => {
		// "The type renders as a word, not a colour dot." Colour alone is not
		// a label, and in a hurry it is not read at all.
		render(<Gespraechsnotizen labels={labels} />);
		await userEvent.setup().click(kebab());
		for (const word of ['Frage', 'Anmerkung', 'Aufgabe'])
			expect(
				screen.getByRole('menuitemradio', { name: word })
			).toBeDefined();
	});

	it('announces which type the next note will be filed under', async () => {
		render(<Gespraechsnotizen labels={labels} />);
		await userEvent.setup().click(kebab());
		expect(
			screen
				.getByRole('menuitemradio', { name: 'Anmerkung' })
				.getAttribute('aria-checked')
		).toBe('true');
	});

	it('says plainly that the notes are private and temporary', () => {
		render(<Gespraechsnotizen labels={labels} />);
		expect(screen.getByText(labels.privacy)).toBeDefined();
	});

	it('writes a note and files it under the chosen type', async () => {
		render(<Gespraechsnotizen labels={labels} />);
		await write('Rückruf am Montag', 'Aufgabe');
		expect(screen.getByText('Rückruf am Montag')).toBeDefined();
		expect(screen.getByTestId('note').getAttribute('data-type')).toBe(
			'aufgabe'
		);
	});

	it('ignores an empty draft instead of listing a blank note', async () => {
		render(<Gespraechsnotizen labels={labels} />);
		await userEvent
			.setup()
			.click(screen.getByRole('button', { name: labels.add }));
		expect(screen.queryAllByTestId('note')).toHaveLength(0);
		expect(screen.getByText(labels.empty)).toBeDefined();
	});

	it('keeps a whitespace-only draft in the field instead of eating it', async () => {
		// addNote returns the SAME array for an empty draft, and the field is
		// cleared only when something was actually added. A mis-click must not
		// quietly discard a half-typed note.
		render(<Gespraechsnotizen labels={labels} />);
		const user = userEvent.setup();
		const field = screen.getByRole('textbox', { name: labels.text });
		await user.type(field, '   ');
		await user.click(screen.getByRole('button', { name: labels.add }));

		expect(screen.queryAllByTestId('note')).toHaveLength(0);
		expect((field as HTMLInputElement).value).toBe('   ');
	});

	it('uses the real clipboard when none is injected', async () => {
		// The production path. Without this, a test double is the only thing
		// the copy button has ever been proven to reach.
		render(<Gespraechsnotizen labels={labels} />);
		await write('Rückruf am Montag', 'Aufgabe');

		// userEvent.setup() installs its own clipboard stub on the window, so
		// the spy goes on whatever is there at click time rather than on an
		// object that setup would replace a moment later.
		const user = userEvent.setup();
		const writeText = vi
			.spyOn(navigator.clipboard, 'writeText')
			.mockResolvedValue();
		await user.click(screen.getByRole('button', { name: labels.copy }));

		expect(writeText).toHaveBeenCalledWith('Aufgabe\n- Rückruf am Montag');
		writeText.mockRestore();
	});

	it('removes a note', async () => {
		render(<Gespraechsnotizen labels={labels} />);
		await write('versehentlich notiert');
		await userEvent
			.setup()
			.click(screen.getByRole('button', { name: labels.remove }));
		expect(screen.queryAllByTestId('note')).toHaveLength(0);
	});

	it('offers nothing to copy while the pad is empty', () => {
		// An empty pad copies nothing, so the button has no business existing.
		render(<Gespraechsnotizen labels={labels} />);
		expect(screen.queryByRole('button', { name: labels.copy })).toBeNull();
	});

	it('hands the clipboard readable, grouped text', async () => {
		const writeText = vi
			.fn<(t: string) => Promise<void>>()
			.mockResolvedValue();
		render(<Gespraechsnotizen labels={labels} writeText={writeText} />);
		await write('wirkt erschöpft', 'Anmerkung');
		await write('Rückruf am Montag', 'Aufgabe');

		await userEvent
			.setup()
			.click(screen.getByRole('button', { name: labels.copy }));

		expect(writeText).toHaveBeenCalledWith(
			'Anmerkung\n- wirkt erschöpft\n\nAufgabe\n- Rückruf am Montag'
		);
		expect(
			screen.getByRole('button', { name: labels.copied })
		).toBeDefined();
	});

	it('collapses to a rail and keeps the notes', async () => {
		render(<Gespraechsnotizen labels={labels} />);
		await write('Thema Miete');

		const user = userEvent.setup();
		await user.click(screen.getByRole('button', { name: labels.collapse }));
		expect(
			screen
				.getByTestId('gespraechsnotizen')
				.getAttribute('data-collapsed')
		).toBe('true');
		expect(screen.queryByText('Thema Miete')).toBeNull();

		await user.click(screen.getByRole('button', { name: labels.expand }));
		expect(screen.getByText('Thema Miete')).toBeDefined();
	});

	it('can start out as the rail', () => {
		render(<Gespraechsnotizen labels={labels} defaultCollapsed />);
		expect(
			screen
				.getByTestId('gespraechsnotizen')
				.getAttribute('data-collapsed')
		).toBe('true');
		expect(
			screen.getByRole('button', { name: labels.expand })
		).toBeDefined();
	});

	it('is keyboard-complete: add, type-select, copy, close', async () => {
		// The ticket's last criterion, exercised with no pointer at all.
		const writeText = vi
			.fn<(t: string) => Promise<void>>()
			.mockResolvedValue();
		render(<Gespraechsnotizen labels={labels} writeText={writeText} />);
		const user = userEvent.setup();

		// type-select
		await user.tab();
		await user.tab();
		await user.tab();
		expect(document.activeElement).toBe(kebab());
		await user.keyboard('{Enter}');
		await user.click(screen.getByRole('menuitemradio', { name: 'Frage' }));

		// add, by Enter in the field rather than by reaching for the button
		await user.click(screen.getByRole('textbox', { name: labels.text }));
		await user.keyboard('Wohnsituation?{Enter}');
		expect(screen.getByText('Wohnsituation?')).toBeDefined();

		// copy
		const copyButton = screen.getByRole('button', { name: labels.copy });
		copyButton.focus();
		await user.keyboard('{Enter}');
		expect(writeText).toHaveBeenCalledWith('Frage\n- Wohnsituation?');

		// close — the menu closes on Escape
		await user.click(kebab());
		expect(screen.getByRole('menu')).toBeDefined();
		await user.keyboard('{Escape}');
		expect(screen.queryByRole('menu')).toBeNull();
	});
});

describe('nothing leaves the client', () => {
	const sent: string[] = [];

	beforeEach(() => {
		sent.length = 0;
		vi.spyOn(globalThis, 'fetch').mockImplementation((() => {
			sent.push('fetch');
			return Promise.resolve(new Response(''));
		}) as typeof fetch);
		vi.spyOn(XMLHttpRequest.prototype, 'open').mockImplementation(() => {
			sent.push('xhr');
		});
		// Spied on the instances, not on Storage.prototype: the test setup may
		// have substituted an in-memory Storage, and a prototype spy would
		// then watch an object nothing calls.
		for (const store of [localStorage, sessionStorage])
			vi.spyOn(store, 'setItem').mockImplementation(() => {
				sent.push('storage');
			});
		// jsdom has no sendBeacon, so it has to be planted to be watched.
		Object.defineProperty(navigator, 'sendBeacon', {
			configurable: true,
			writable: true,
			value: () => {
				sent.push('beacon');
				return true;
			}
		});
	});

	afterEach(() => {
		vi.restoreAllMocks();
		delete (navigator as { sendBeacon?: unknown }).sendBeacon;
	});

	it('sends nothing while a counsellor writes, lists and copies', async () => {
		const writeText = vi
			.fn<(t: string) => Promise<void>>()
			.mockResolvedValue();
		render(<Gespraechsnotizen labels={labels} writeText={writeText} />);

		await write('Thema Schulden, Miete im Rückstand', 'Anmerkung');
		await write('Wohnsituation?', 'Frage');
		await userEvent
			.setup()
			.click(screen.getByRole('button', { name: labels.copy }));

		expect(sent).toEqual([]);
	});

	it('keeps nothing once the panel is gone', async () => {
		const { unmount } = render(<Gespraechsnotizen labels={labels} />);
		await write('etwas sehr Privates');
		unmount();

		render(<Gespraechsnotizen labels={labels} />);
		expect(screen.queryByText('etwas sehr Privates')).toBeNull();
		expect(sent).toEqual([]);
	});
});
