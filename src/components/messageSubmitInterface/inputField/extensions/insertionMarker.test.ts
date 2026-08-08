// @vitest-environment jsdom
/**
 * #996 — recording a voice message types nothing, so without this dot the
 * user cannot see where in a half-written message the recording will land.
 * The marker is a decoration: it must never become document content.
 */
import { Editor } from '@tiptap/core';
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import { afterEach, describe, expect, it } from 'vitest';

import { InsertionMarker, insertionMarkerKey } from './insertionMarker';

let editor: Editor | null = null;

const createEditor = (content: string) => {
	const element = document.createElement('div');
	document.body.appendChild(element);
	editor = new Editor({
		element,
		extensions: [Document, Paragraph, Text, InsertionMarker],
		content
	});
	return editor;
};

const setMarker = (target: Editor, value: number | null) =>
	target.view.dispatch(target.state.tr.setMeta(insertionMarkerKey, value));

const markerCount = (target: Editor) =>
	target.view.dom.querySelectorAll('.composerInsertionMarker').length;

afterEach(() => {
	editor?.destroy();
	editor = null;
	document.body.replaceChildren();
});

describe('composer insertion marker (#996)', () => {
	it('shows nothing until a voice insertion is pending', () => {
		const target = createEditor('<p>Guten Tag</p>');

		expect(markerCount(target)).toBe(0);
	});

	it('pins a dot at the position it is given', () => {
		const target = createEditor('<p>Guten Tag</p>');

		setMarker(target, 4);

		expect(markerCount(target)).toBe(1);
	});

	it('never becomes part of the message', () => {
		const target = createEditor('<p>Guten Tag</p>');
		const before = target.getHTML();

		setMarker(target, 4);

		expect(target.getHTML()).toBe(before);
		expect(target.state.doc.textContent).toBe('Guten Tag');
	});

	it('follows the text when the user keeps typing in front of it', () => {
		const target = createEditor('<p>Guten Tag</p>');
		setMarker(target, 6);

		target.commands.insertContentAt(1, 'Hallo, ');

		expect(markerCount(target)).toBe(1);
		expect(target.state.doc.textContent).toBe('Hallo, Guten Tag');
	});

	it('disappears when the insertion is committed or cancelled', () => {
		const target = createEditor('<p>Guten Tag</p>');
		setMarker(target, 4);
		expect(markerCount(target)).toBe(1);

		setMarker(target, null);

		expect(markerCount(target)).toBe(0);
	});

	it('shows only one dot even if it is pinned twice', () => {
		const target = createEditor('<p>Guten Tag</p>');

		setMarker(target, 3);
		setMarker(target, 6);

		expect(markerCount(target)).toBe(1);
	});
});
