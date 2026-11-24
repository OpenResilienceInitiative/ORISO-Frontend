// @vitest-environment oriso-jsdom
import sanitizeHtml from 'sanitize-html';
import { describe, expect, it } from 'vite-plus/test';
import { sanitizeHtmlDefaultOptions } from '../messageSubmitInterface/richtextHelpers';
import {
	chatMessageWidthStyle,
	parseCollapseThreshold,
	parseDisabledFormats,
	parseMaxWidthDesktop
} from './chatMessageConfig';

describe('parseDisabledFormats', () => {
	it('offers every format when the backend sends nothing or an empty list', () => {
		expect(parseDisabledFormats(undefined).size).toBe(0);
		expect(parseDisabledFormats('').size).toBe(0);
	});

	it('reads the stored keys and ignores keys this build does not know', () => {
		expect([...parseDisabledFormats('bold, blink,heading')].sort()).toEqual(
			['bold', 'heading']
		);
	});
});

describe('parseCollapseThreshold', () => {
	it('keeps the limit of 300 characters when unset or unusable', () => {
		for (const raw of [undefined, null, '', 'abc', '-1', '1.5']) {
			expect(parseCollapseThreshold(raw)).toBe(300);
		}
	});

	it('treats 0 as a real value: collapsing off', () => {
		expect(parseCollapseThreshold('0')).toBe(0);
		expect(parseCollapseThreshold('1200')).toBe(1200);
	});
});

describe('parseMaxWidthDesktop', () => {
	it('keeps 770 pixels when unset or unusable', () => {
		for (const raw of [undefined, '', 'wide', '-5', '0']) {
			expect(parseMaxWidthDesktop(raw)).toBe(770);
		}
	});

	it('leaves the stylesheet alone for the default and overrides it otherwise', () => {
		expect(chatMessageWidthStyle(770)).toBeUndefined();
		expect(chatMessageWidthStyle(1000)).toEqual({
			'--message-item-max-width-desktop': '1000px'
		});
	});
});

/**
 * The hard requirement: the setting only concerns composing. The renderer's
 * sanitizer takes no platform setting at all, so every format the menu can
 * produce has to survive it, whatever the admin switched off later.
 */
describe('old messages keep every format the menu can produce', () => {
	it.each([
		['heading', '<h2>x</h2>', 'h2'],
		['blockquote', '<blockquote><p>x</p></blockquote>', 'blockquote'],
		['codeBlock', '<pre><code>x</code></pre>', 'pre'],
		['bulletList', '<ul><li><p>x</p></li></ul>', 'ul'],
		['orderedList', '<ol><li><p>x</p></li></ol>', 'ol'],
		[
			'taskList',
			'<ul data-type="taskList"><li data-checked="true" data-type="taskItem"><label><input type="checkbox" checked="checked"><span></span></label><div><p>x</p></div></li></ul>',
			'input[type="checkbox"][checked]'
		],
		['bold', '<p><strong>x</strong></p>', 'strong'],
		['italic', '<p><em>x</em></p>', 'em'],
		['strike', '<p><s>x</s></p>', 's'],
		['code', '<p><code>x</code></p>', 'code'],
		['underline', '<p><u>x</u></p>', 'u'],
		[
			'highlight',
			'<p><mark data-color="#fff59d" style="background-color: #fff59d">x</mark></p>',
			'mark'
		],
		['link', '<p><a href="https://example.org">x</a></p>', 'a[href]'],
		['superscript', '<p><sup>x</sup></p>', 'sup'],
		['subscript', '<p><sub>x</sub></p>', 'sub']
	])('%s', (_format, html, selector) => {
		const container = document.createElement('div');
		container.innerHTML = sanitizeHtml(html, sanitizeHtmlDefaultOptions);
		expect(container.querySelector(selector)).not.toBeNull();
	});
});
