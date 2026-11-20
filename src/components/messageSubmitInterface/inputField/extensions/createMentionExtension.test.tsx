// @vitest-environment oriso-jsdom
/**
 * The end of a mention search, against a real editor: nobody who was ticked may
 * vanish without the person having decided that, and a click beside the list
 * has to close it even with nobody ticked.
 */
import * as React from 'react';
import {
	act,
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor
} from '@testing-library/react';
import { Editor, EditorContent, useEditor } from '@tiptap/react';
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import { afterEach, describe, expect, it } from 'vite-plus/test';

import { createMentionExtension } from './createMentionExtension';

const people = [
	{ id: 'c-1', displayName: 'Anna Berg', username: 'anna', isInRoom: true },
	{ id: 'c-2', displayName: 'Max Bauer', username: 'max', isInRoom: true }
];

const TestEditor = ({ onReady }: { onReady: (editor: Editor) => void }) => {
	const editor = useEditor({
		extensions: [
			Document,
			Paragraph,
			Text,
			createMentionExtension({
				getCandidates: () => people,
				notInChatLabel: 'not in chat'
			})
		]
	});
	React.useEffect(() => {
		if (editor) {
			onReady(editor);
		}
	}, [editor, onReady]);
	return <EditorContent editor={editor} />;
};

const openList = async () => {
	let editor: Editor | undefined;
	render(
		<TestEditor
			onReady={(ready) => {
				editor = ready;
			}}
		/>
	);
	await waitFor(() => expect(editor).toBeDefined());
	act(() => {
		editor?.commands.focus();
		editor?.commands.insertContent('@');
	});
	await screen.findByRole('button', { name: /Anna Berg/ });
	return editor as Editor;
};

const type = async (editor: Editor, text: string) => {
	await act(async () => {
		editor.commands.insertContent(text);
		await Promise.resolve();
	});
};

const mentionIds = (editor: Editor) => {
	const ids: string[] = [];
	editor.state.doc.descendants((node) => {
		if (node.type.name === 'mention') {
			ids.push(node.attrs.id);
		}
	});
	return ids;
};

const isListOpen = () => document.querySelector('.mentionList') !== null;

const pressEscape = (editor: Editor) =>
	act(() => {
		editor.view.someProp('handleKeyDown', (handle) =>
			handle(editor.view, new KeyboardEvent('keydown', { key: 'Escape' }))
		);
	});

describe('createMentionExtension: how a search ends', () => {
	afterEach(() => cleanup());

	it('keeps the ticked person when a space ends the search', async () => {
		const editor = await openList();

		fireEvent.click(screen.getAllByRole('checkbox')[0]);
		await type(editor, 'Max Bauer');

		await waitFor(() => expect(mentionIds(editor)).toEqual(['c-1']));
		expect(editor.getText()).toContain('@Max Bauer');
		expect(isListOpen()).toBe(false);
		expect(editor.state.selection.$to.parentOffset).toBe(
			editor.state.selection.$to.parent.content.size
		);
	});

	it('inserts nobody when Esc ends it', async () => {
		const editor = await openList();

		fireEvent.click(screen.getAllByRole('checkbox')[0]);
		pressEscape(editor);
		await act(async () => {
			await Promise.resolve();
		});

		expect(isListOpen()).toBe(false);
		expect(mentionIds(editor)).toEqual([]);
	});

	it('inserts a clicked name only once when it was ticked before', async () => {
		const editor = await openList();

		fireEvent.click(screen.getAllByRole('checkbox')[0]);
		fireEvent.click(screen.getByRole('button', { name: /Anna Berg/ }));

		await waitFor(() => expect(isListOpen()).toBe(false));
		await act(async () => {
			await Promise.resolve();
		});
		expect(mentionIds(editor)).toEqual(['c-1']);
	});

	it('closes on a click beside the list with nobody ticked', async () => {
		const editor = await openList();

		fireEvent.pointerDown(document.body);

		await waitFor(() => expect(isListOpen()).toBe(false));
		expect(mentionIds(editor)).toEqual([]);
	});

	it('inserts everyone ticked on a click beside the list', async () => {
		const editor = await openList();

		fireEvent.click(screen.getAllByRole('checkbox')[0]);
		fireEvent.click(screen.getAllByRole('checkbox')[1]);
		fireEvent.pointerDown(document.body);

		await waitFor(() => expect(mentionIds(editor)).toEqual(['c-1', 'c-2']));
		expect(isListOpen()).toBe(false);
	});
});
