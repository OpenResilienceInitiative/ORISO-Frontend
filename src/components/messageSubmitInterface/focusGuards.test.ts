// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	isFocusInsideOpenMenu,
	isFocusProtected,
	scheduleComposerAutoFocus
} from './focusGuards';

afterEach(() => {
	vi.useRealTimers();
});

/**
 * Review v6: the composer's deferred autofocus must never steal focus from
 * an open menu (the channel card, T20) — that was the (d3) flake.
 */
describe('isFocusInsideOpenMenu', () => {
	it('is true for an element inside a role="menu"', () => {
		document.body.innerHTML =
			'<ul role="menu"><li role="none"><button role="menuitem" id="item">x</button></li></ul>';
		expect(isFocusInsideOpenMenu(document.getElementById('item'))).toBe(
			true
		);
	});

	it('is false for body, null and elements outside a menu', () => {
		document.body.innerHTML = '<input id="field" />';
		expect(isFocusInsideOpenMenu(document.body)).toBe(false);
		expect(isFocusInsideOpenMenu(null)).toBe(false);
		expect(isFocusInsideOpenMenu(document.getElementById('field'))).toBe(
			false
		);
	});
});

/**
 * Review v6 (item 6): the panel header keeps focus against the composer's
 * autofocus as well — after a pick from the FAB the header's channel
 * button holds focus, and the freshly mounted panel composer must not
 * pull it away a tick later.
 */
describe('isFocusProtected', () => {
	it('is true inside a region marked data-keeps-focus', () => {
		document.body.innerHTML =
			'<header data-keeps-focus=""><button id="channel">Thread</button></header>';
		expect(isFocusProtected(document.getElementById('channel'))).toBe(true);
	});

	it('is true inside an open menu, false elsewhere', () => {
		document.body.innerHTML =
			'<ul role="menu"><li role="none"><button role="menuitem" id="item">x</button></li></ul><button id="other">y</button>';
		expect(isFocusProtected(document.getElementById('item'))).toBe(true);
		expect(isFocusProtected(document.getElementById('other'))).toBe(false);
		expect(isFocusProtected(document.body)).toBe(false);
		expect(isFocusProtected(null)).toBe(false);
	});
});

/**
 * A side panel selected from the channel FAB explicitly hands focus to its
 * header. The newly mounted ProseMirror composer used to schedule its own
 * focus one tick later and steal that hand-off. `enabled: false` is the
 * ownership signal from the panel host: automatic focus is skipped, while a
 * later user-initiated `.focus()` remains completely untouched.
 */
describe('scheduleComposerAutoFocus', () => {
	it('preserves the panel-header hand-off when automatic focus is disabled', () => {
		vi.useFakeTimers();
		document.body.innerHTML =
			'<header data-keeps-focus><button id="channel">Supervision</button></header><div contenteditable="true" id="editor"></div>';
		const channel = document.getElementById('channel') as HTMLButtonElement;
		const editor = document.getElementById('editor') as HTMLDivElement;
		channel.focus();

		scheduleComposerAutoFocus(() => editor.focus(), false);
		vi.runAllTimers();

		expect(document.activeElement).toBe(channel);
		// The ownership rule suppresses only automatic focus. The editor is
		// still reachable normally when the person chooses it.
		editor.focus();
		expect(document.activeElement).toBe(editor);
	});

	it('focuses the editor when no other surface owns initial focus', () => {
		vi.useFakeTimers();
		document.body.innerHTML = '<div contenteditable="true" id="editor"></div>';
		const editor = document.getElementById('editor') as HTMLDivElement;

		scheduleComposerAutoFocus(() => editor.focus(), true);
		vi.runAllTimers();

		expect(document.activeElement).toBe(editor);
	});
});
