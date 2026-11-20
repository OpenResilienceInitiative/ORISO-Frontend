// @vitest-environment oriso-jsdom
import { afterEach, describe, expect, it } from 'vite-plus/test';
import { focusChatComposer } from './focusChatComposer';

afterEach(() => {
	document.body.innerHTML = '';
});

describe('focusChatComposer', () => {
	it('puts the cursor into the conversation composer', () => {
		document.body.innerHTML =
			'<div class="textarea__input"><div contenteditable="true" tabindex="0"></div></div>';
		expect(focusChatComposer()).toBe(true);
		expect(document.activeElement?.getAttribute('contenteditable')).toBe(
			'true'
		);
	});

	it('reports when there is no composer to focus', () => {
		expect(focusChatComposer()).toBe(false);
	});
});
