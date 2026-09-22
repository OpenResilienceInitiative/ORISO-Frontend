// @vitest-environment jsdom
import * as React from 'react';
import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/* An editor whose document is plain HTML we control, and whose options (with
   onUpdate) the test can reach — the real editor's timing is what varies. */
const mocks = vi.hoisted(() => {
	const editor: any = {
		isDestroyed: false,
		html: '',
		setEditable: vi.fn(),
		getHTML: () => editor.html,
		state: {
			doc: {
				get textContent() {
					return editor.html.replace(/<[^>]+>/g, '');
				}
			},
			tr: { setMeta: () => ({}) }
		},
		view: { dispatch: vi.fn() },
		commands: {
			setTextAlign: vi.fn(),
			clearContent: vi.fn(),
			focus: vi.fn(),
			setContent: vi.fn((next: string) => {
				editor.html = next;
			})
		}
	};
	return { editor, options: null as any };
});

vi.mock('@tiptap/react', () => ({
	EditorContent: () => null,
	useEditor: (options: any) => {
		mocks.options = options;
		return mocks.editor;
	}
}));

// The component import must follow the hoisted module mock.
// eslint-disable-next-line import/first
import { TipTapComposer } from './TipTapComposer';

const props = {
	placeholder: 'test',
	showToolbar: false,
	readOnly: false,
	onSubmitShortcut: () => {}
};

/** A keystroke: the editor moves on and reports its new HTML. */
const type = (html: string) => {
	mocks.editor.html = html;
	mocks.options.onUpdate({ editor: mocks.editor });
};

beforeEach(() => {
	mocks.editor.html = '';
	vi.clearAllMocks();
});
afterEach(() => cleanup());

describe('TipTapComposer — a value that lags behind the editor', () => {
	/* CI, under load (Enquiry team panel spec): the editor was at "Wir besp"
	   while the parent re-rendered with the value from the keystroke before,
	   "Wir bes". The value sync wrote that back and the "p" was gone —
	   "Wir besrechen". An echo of the editor's own earlier state is not news. */
	it('does not write its own earlier state back over newer typing', () => {
		const onChange = vi.fn();
		const view = render(
			<TipTapComposer {...props} value="" onChange={onChange} />
		);

		type('<p>Wir bes</p>');
		type('<p>Wir besp</p>');
		view.rerender(
			<TipTapComposer
				{...props}
				value="<p>Wir bes</p>"
				onChange={onChange}
			/>
		);

		expect(mocks.editor.commands.setContent).not.toHaveBeenCalledWith(
			'<p>Wir bes</p>'
		);
		expect(mocks.editor.html).toBe('<p>Wir besp</p>');
	});

	it('still applies a value the editor never produced (a draft, a reset)', () => {
		const onChange = vi.fn();
		const view = render(
			<TipTapComposer {...props} value="" onChange={onChange} />
		);

		type('<p>Wir bes</p>');
		view.rerender(
			<TipTapComposer
				{...props}
				value="<p>Gespeicherter Entwurf</p>"
				onChange={onChange}
			/>
		);

		expect(mocks.editor.html).toBe('<p>Gespeicherter Entwurf</p>');
	});
});
