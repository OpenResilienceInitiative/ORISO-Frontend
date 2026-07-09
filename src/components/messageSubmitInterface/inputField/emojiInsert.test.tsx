// @vitest-environment jsdom
import * as React from 'react';
import { createRef } from 'react';
import { cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

type EditorMock = {
	commands: {
		setContent: (value: string) => boolean;
		clearContent: () => boolean;
		focus: () => boolean;
		setTextAlign: (align: string) => boolean;
	};
	chain: () => {
		focus: () => ReturnType<EditorMock['chain']>;
		insertContent: (value: string) => ReturnType<EditorMock['chain']>;
		run: () => boolean;
	};
	getHTML: () => string;
	setEditable: () => void;
};

const { editorMock, extensionStub, registerEditorOnUpdate } = vi.hoisted(() => {
	const extensionStub = { configure: () => extensionStub };
	let html = '<p></p>';
	let onUpdate: ((args: { editor: EditorMock }) => void) | undefined;

	const notify = () => onUpdate?.({ editor: editorMock });

	const editorMock: EditorMock = {
		commands: {
			setContent: (value: string) => {
				html = value ? `<p>${value}</p>` : '<p></p>';
				notify();
				return true;
			},
			clearContent: () => {
				html = '<p></p>';
				notify();
				return true;
			},
			focus: () => true,
			setTextAlign: () => true
		},
		chain: () => {
			const chain = {
				focus: () => chain,
				insertContent: (value: string) => {
					html = html.replace('</p>', `${value}</p>`);
					notify();
					return chain;
				},
				run: () => true
			};
			return chain;
		},
		getHTML: () => html,
		setEditable: () => {}
	};

	return {
		editorMock,
		extensionStub,
		registerEditorOnUpdate: (
			cb: ((args: { editor: EditorMock }) => void) | undefined
		) => {
			onUpdate = cb;
		}
	};
});

vi.mock('@mui/icons-material', () => ({
	FormatBold: () => null,
	FormatListBulleted: () => null,
	FilterList: () => null,
	Undo: () => null,
	Redo: () => null,
	ChevronRight: () => null
}));
vi.mock('@tiptap/starter-kit', () => ({ default: extensionStub }));
vi.mock('@tiptap/extension-underline', () => ({ default: extensionStub }));
vi.mock('@tiptap/extension-link', () => ({ default: extensionStub }));
vi.mock('@tiptap/extension-highlight', () => ({ default: extensionStub }));
vi.mock('@tiptap/extension-text-align', () => ({ default: extensionStub }));
vi.mock('@tiptap/extension-placeholder', () => ({ default: extensionStub }));
vi.mock('@tiptap/extension-task-list', () => ({ default: extensionStub }));
vi.mock('@tiptap/extension-task-item', () => ({ default: extensionStub }));
vi.mock('@tiptap/core', () => ({ Mark: { create: () => extensionStub } }));
vi.mock('./extensions/createMentionExtension', () => ({
	createMentionExtension: () => extensionStub
}));
vi.mock('@tiptap/react', () => ({
	useEditor: (config: {
		onUpdate?: (args: { editor: EditorMock }) => void;
	}) => {
		registerEditorOnUpdate(config.onUpdate);
		queueMicrotask(() => config.onUpdate?.({ editor: editorMock }));
		return editorMock;
	},
	EditorContent: () => null
}));

import { TipTapComposer, TipTapComposerRef } from '../TipTapComposer';

afterEach(() => cleanup());

/**
 * Emojis must land at the caret, not be appended at the end. The composer's
 * insertText (used by handleEmojiPick) is the contract the emoji popup calls.
 */
describe('emoji insertion at cursor', () => {
	it('inserts the emoji at the current caret position', async () => {
		const ref = createRef<TipTapComposerRef>();
		let html = '';
		render(
			<TipTapComposer
				ref={ref}
				value=""
				placeholder="test"
				showToolbar={false}
				readOnly={false}
				onChange={(v) => {
					html = v;
				}}
				onSubmitShortcut={() => {}}
			/>
		);

		await waitFor(() => expect(ref.current).toBeTruthy());

		ref.current!.setText('Hallo');
		ref.current!.insertText('😀');

		await waitFor(() => {
			expect(ref.current!.getHTML()).toContain('Hallo');
			expect(ref.current!.getHTML()).toContain('😀');
			expect(html).toContain('Hallo');
			expect(html).toContain('😀');
		});
	});
});
