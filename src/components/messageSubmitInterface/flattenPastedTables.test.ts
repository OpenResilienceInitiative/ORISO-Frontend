// @vitest-environment oriso-jsdom
import { describe, expect, it } from 'vite-plus/test';
import { flattenPastedTables } from './flattenPastedTables';

/**
 * #2135 battle test: the composer has no table node, so a table pasted from
 * Word or a mail ran its cells together ("Spalte ASpalte B12"). Each row
 * becomes one line with its cells separated, so the content stays readable.
 */
describe('flattenPastedTables', () => {
	it('turns every row into one paragraph with separated cells', () => {
		expect(
			flattenPastedTables(
				'<p>Vorher</p><table><tr><th>Spalte A</th><th>Spalte B</th></tr><tr><td>1</td><td>2</td></tr></table><p>Nachher</p>'
			)
		).toBe(
			'<p>Vorher</p><p>Spalte A | Spalte B</p><p>1 | 2</p><p>Nachher</p>'
		);
	});

	it('keeps inline formatting inside a cell and skips empty cells', () => {
		expect(
			flattenPastedTables(
				'<table><tbody><tr><td><b>fett</b></td><td> </td><td><a href="https://oriso.org">Link</a></td></tr></tbody></table>'
			)
		).toBe('<p><b>fett</b> | <a href="https://oriso.org">Link</a></p>');
	});

	it('leaves HTML without a table untouched', () => {
		const html = '<h1>Titel</h1><ul><li>Eins</li></ul>';

		expect(flattenPastedTables(html)).toBe(html);
	});
});
