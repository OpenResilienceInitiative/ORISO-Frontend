// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { isFocusInsideOpenMenu } from './focusGuards';

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
