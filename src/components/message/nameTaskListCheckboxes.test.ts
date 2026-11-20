// @vitest-environment oriso-jsdom
import { describe, expect, it } from 'vite-plus/test';
import { nameTaskListCheckboxes } from './nameTaskListCheckboxes';

/**
 * A received task list showed "checkbox, checked" to a screen reader without
 * saying which task. The checkbox and its text are siblings, so the text is
 * copied onto the checkbox as its accessible name.
 */
describe('nameTaskListCheckboxes', () => {
	it('names each task checkbox after its item text', () => {
		const html =
			'<ul data-type="taskList"><li data-checked="true" data-type="taskItem"><label><input type="checkbox" checked="checked" disabled="disabled"><span></span></label><div><p>Erledigte <strong>Aufgabe</strong></p></div></li></ul>';

		const named = nameTaskListCheckboxes(html);

		expect(named).toContain('aria-label="Erledigte Aufgabe"');
		expect(named).toContain('checked="checked"');
	});

	it('escapes the item text inside the attribute', () => {
		const html =
			'<ul data-type="taskList"><li data-type="taskItem"><label><input type="checkbox"></label><div><p>"x" &lt;b&gt;</p></div></li></ul>';

		expect(nameTaskListCheckboxes(html)).toContain(
			'aria-label="&quot;x&quot; <b>"'
		);
	});

	it('leaves HTML without a task list untouched', () => {
		const html = '<p>Kein <em>Aufgabe</em>-Text</p>';

		expect(nameTaskListCheckboxes(html)).toBe(html);
	});
});
