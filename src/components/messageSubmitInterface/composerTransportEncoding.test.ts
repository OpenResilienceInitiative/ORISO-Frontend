// @vitest-environment jsdom
import sanitizeHtml from 'sanitize-html';
import { describe, expect, it } from 'vitest';
import { composerHtmlToTransportMarkup } from './composerTransportEncoding';
import { transportMarkupToComposerHtml } from './transportMarkupToComposerHtml';
import { sanitizeHtmlDefaultOptions } from './richtextHelpers';

/**
 * Every formatting option the composer toolbar can produce, captured from the
 * real editor by driving `Components/Message/MessageSubmitInterface → Selected`
 * with Playwright and reading `editor.getHTML()` after each toolbar click.
 *
 * `expectRendered` is the marker that must still be present after the message
 * has gone out as transport markup and come back through the sanitizer — it is
 * what proves the formatting actually survives a send, not just a click.
 */
const TOOLBAR_OUTPUT: Array<{
	action: string;
	composerHtml: string;
	expectRendered: RegExp;
}> = [
	{
		action: 'bold',
		composerHtml: '<p style="text-align: left;"><strong>Text</strong></p>',
		expectRendered: /<strong>Text<\/strong>/
	},
	{
		action: 'italic',
		composerHtml: '<p style="text-align: left;"><em>Text</em></p>',
		expectRendered: /<em>Text<\/em>/
	},
	{
		action: 'strike',
		composerHtml: '<p style="text-align: left;"><s>Text</s></p>',
		expectRendered: /<s>Text<\/s>/
	},
	{
		action: 'underline',
		composerHtml: '<p style="text-align: left;"><u>Text</u></p>',
		expectRendered: /<u>Text<\/u>/
	},
	{
		action: 'code',
		composerHtml: '<p style="text-align: left;"><code>Text</code></p>',
		expectRendered: /<code>Text<\/code>/
	},
	{
		action: 'superscript',
		composerHtml: '<p style="text-align: left;"><sup>Text</sup></p>',
		expectRendered: /<sup>Text<\/sup>/
	},
	{
		action: 'subscript',
		composerHtml: '<p style="text-align: left;"><sub>Text</sub></p>',
		expectRendered: /<sub>Text<\/sub>/
	},
	{
		action: 'link',
		composerHtml:
			'<p style="text-align: left;"><a target="_blank" rel="noopener noreferrer nofollow" href="https://example.org/">Text</a></p>',
		expectRendered: /<a [^>]*href="https:\/\/example\.org\/"/
	},
	{
		action: 'blockquote',
		composerHtml:
			'<blockquote><p style="text-align: left;">Text</p></blockquote>',
		expectRendered: /<blockquote>/
	},
	{
		action: 'codeBlock',
		composerHtml: '<pre><code>Text</code></pre>',
		expectRendered: /<pre><code>Text<\/code><\/pre>/
	},
	{
		action: 'heading1',
		composerHtml: '<h1 style="text-align: left;">Text</h1>',
		expectRendered: /<h1[^>]*>Text<\/h1>/
	},
	{
		action: 'heading2',
		composerHtml: '<h2 style="text-align: left;">Text</h2>',
		expectRendered: /<h2[^>]*>Text<\/h2>/
	},
	{
		action: 'heading3',
		composerHtml: '<h3 style="text-align: left;">Text</h3>',
		expectRendered: /<h3[^>]*>Text<\/h3>/
	},
	{
		action: 'heading4',
		composerHtml: '<h4 style="text-align: left;">Text</h4>',
		expectRendered: /<h4[^>]*>Text<\/h4>/
	},
	{
		action: 'bulletList',
		composerHtml: '<ul><li><p style="text-align: left;">Text</p></li></ul>',
		expectRendered: /<ul><li>/
	},
	{
		action: 'orderedList',
		composerHtml: '<ol><li><p style="text-align: left;">Text</p></li></ol>',
		expectRendered: /<ol><li>/
	},
	{
		action: 'highlightYellow',
		composerHtml:
			'<p style="text-align: left;"><mark data-color="#fff59d" style="background-color: rgb(255, 245, 157); color: inherit;">Text</mark></p>',
		expectRendered: /<mark[^>]*#fff59d/
	},
	{
		action: 'highlightBlue',
		composerHtml:
			'<p style="text-align: left;"><mark data-color="#b3e5fc" style="background-color: rgb(179, 229, 252); color: inherit;">Text</mark></p>',
		expectRendered: /<mark[^>]*#b3e5fc/
	}
];

describe('composer formatting survives the transport round trip', () => {
	it.each(TOOLBAR_OUTPUT)(
		'$action keeps its formatting and leaks no transport tokens',
		({ composerHtml, expectRendered }) => {
			const transport = composerHtmlToTransportMarkup(composerHtml);
			const backInComposer = transportMarkupToComposerHtml(transport);

			// #978: the user must never see `[[align:left]]` / `[[hl:…]]`.
			expect(backInComposer).not.toMatch(/\[\[/);
			expect(backInComposer).toMatch(expectRendered);

			// And the same HTML has to survive the render-side sanitizer.
			expect(
				sanitizeHtml(backInComposer, sanitizeHtmlDefaultOptions)
			).toMatch(expectRendered);
		}
	);

	it('is idempotent — re-sending a quoted message does not nest tokens', () => {
		const once = composerHtmlToTransportMarkup(
			'<p style="text-align: center;">Text</p>'
		);
		const twice = composerHtmlToTransportMarkup(
			transportMarkupToComposerHtml(once)
		);

		expect(once).toBe('[[align:center]]<p>Text</p>[[/align]]');
		expect(twice).toBe(once);
	});

	it('round-trips a task list back into the composer intact', () => {
		const composerHtml =
			'<ul data-type="taskList"><li data-checked="true" data-type="taskItem"><label><input type="checkbox"><span></span></label><div><p style="text-align: left;">Erledigt</p></div></li></ul>';

		const back = transportMarkupToComposerHtml(
			composerHtmlToTransportMarkup(composerHtml)
		);

		expect(back).not.toMatch(/\[\[/);
		expect(back).toContain('data-checked="true"');
		expect(back).toContain('Erledigt');
	});

	/**
	 * #1079 — the sender writes ☑ / ☐, so the reader has to see ☑ / ☐. This was
	 * the gap the toolbar audit pinned: the sanitizer used to strip the whole
	 * checkbox structure and the list arrived as plain bullets, which changes
	 * what the message says.
	 */
	describe('task-list state reaches the reader (#1079)', () => {
		const renderTask = (checked: boolean) =>
			sanitizeHtml(
				`<ul data-type="taskList"><li data-checked="${checked}" data-type="taskItem"><label><input type="checkbox"${
					checked ? ' checked' : ''
				}><span></span></label><div><p>Erledigt</p></div></li></ul>`,
				sanitizeHtmlDefaultOptions
			);

		it('keeps a ticked box ticked', () => {
			const rendered = renderTask(true);

			expect(rendered).toContain('Erledigt');
			expect(rendered).toContain('data-checked="true"');
			expect(rendered).toContain('checked="checked"');
		});

		it('keeps an unticked box unticked', () => {
			const rendered = renderTask(false);

			expect(rendered).toContain('data-checked="false"');
			expect(rendered).not.toContain('checked="checked"');
		});

		it('renders the box read-only — it is the sender’s list', () => {
			expect(renderTask(true)).toContain('disabled="disabled"');
		});

		/**
		 * Allowing `<input>` at all is only safe because the transform pins the
		 * type. A message body is remote content: it must not be able to smuggle
		 * a text field, a name, a value or a submit button into the timeline.
		 */
		it.each([
			['a text field', '<input type="text" name="pw" value="secret">'],
			[
				'a submit button',
				'<input type="submit" formaction="https://evil.example">'
			]
		])('coerces %s into an inert checkbox', (_label, hostile) => {
			const rendered = sanitizeHtml(hostile, sanitizeHtmlDefaultOptions);

			expect(rendered).toBe(
				'<input type="checkbox" disabled="disabled" />'
			);
		});
	});

	/**
	 * #1080 — `target="_blank"` without `rel="noopener"` hands the opened page a
	 * live handle on the counselling tab. Forced by the sanitizer rather than
	 * merely allowed through, so neither an old message nor a hostile body can
	 * opt out.
	 */
	describe('sent links cannot reach back into the tab (#1080)', () => {
		it.each([
			[
				'the sender already set it',
				'<p><a target="_blank" rel="noopener noreferrer nofollow" href="https://example.org/">Text</a></p>'
			],
			[
				'the sender omitted it',
				'<p><a target="_blank" href="https://example.org/">Text</a></p>'
			],
			[
				'the body tries to drop it',
				'<p><a target="_blank" rel="opener" href="https://evil.example/">Text</a></p>'
			]
		])('forces rel when %s', (_label, body) => {
			const rendered = sanitizeHtml(body, sanitizeHtmlDefaultOptions);

			expect(rendered).toContain('rel="noopener noreferrer nofollow"');
			expect(rendered).not.toContain('rel="opener"');
		});
	});
});
