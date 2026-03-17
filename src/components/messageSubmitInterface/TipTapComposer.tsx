import React, {
	forwardRef,
	useEffect,
	useImperativeHandle,
	useMemo,
	useState
} from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import { JSONContent } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import Highlight from '@tiptap/extension-highlight';
import Placeholder from '@tiptap/extension-placeholder';
import {
	FormatBold,
	FormatListBulleted,
	FilterList,
	Undo,
	Redo,
	ChevronRight
} from '@mui/icons-material';
import './TipTapComposer.styles.scss';

export interface HighlightSnippetPayload {
	text: string;
	anchorId?: string | null;
	sourceMessageId?: string | null;
}

export interface TipTapComposerRef {
	clear: () => void;
	focus: () => void;
	setText: (value: string) => void;
	getHTML: () => string;
	insertText: (value: string) => void;
	insertSnippet: (payload: HighlightSnippetPayload) => void;
	runAction: (action: string) => void;
}

interface TipTapComposerProps {
	value: string;
	placeholder: string;
	showToolbar: boolean;
	readOnly: boolean;
	onChange: (value: string) => void;
	onSubmitShortcut: () => void;
	onSelectionSnippet?: (payload: HighlightSnippetPayload | null) => void;
}

const escapeMarkdownText = (value: string): string =>
	value.replace(/([\\`*_~\[\]()])/g, '\\$1');

const applyTextMarks = (
	text: string,
	marks: Array<{ type: string; attrs?: Record<string, any> }> = []
): string => {
	if (!text) {
		return '';
	}

	let result = text;
	const linkMark = marks.find((mark) => mark.type === 'link');
	const codeMark = marks.some((mark) => mark.type === 'code');
	const boldMark = marks.some((mark) => mark.type === 'bold');
	const italicMark = marks.some((mark) => mark.type === 'italic');
	const strikeMark = marks.some((mark) => mark.type === 'strike');
	const underlineMark = marks.some((mark) => mark.type === 'underline');
	const highlightMark = marks.some((mark) => mark.type === 'highlight');

	if (codeMark) {
		result = `\`${result}\``;
	}
	if (boldMark) {
		result = `**${result}**`;
	}
	if (italicMark) {
		result = `*${result}*`;
	}
	if (strikeMark) {
		result = `~~${result}~~`;
	}
	if (underlineMark) {
		result = `<u>${result}</u>`;
	}
	if (highlightMark) {
		result = `<mark>${result}</mark>`;
	}
	if (linkMark?.attrs?.href) {
		result = `[${result}](${linkMark.attrs.href})`;
	}

	return result;
};

const serializeInlineNodes = (nodes: JSONContent[] = []): string =>
	nodes
		.map((node) => {
			if (node.type === 'text') {
				return applyTextMarks(
					escapeMarkdownText(node.text || ''),
					(node.marks as Array<{ type: string; attrs?: Record<string, any> }>) || []
				);
			}
			if (node.type === 'hardBreak') {
				return '\n';
			}
			if (node.content?.length) {
				return serializeInlineNodes(node.content);
			}
			return '';
		})
		.join('');

const serializeBlocks = (node?: JSONContent): string => {
	if (!node) {
		return '';
	}

	if (node.type === 'doc') {
		return (node.content || [])
			.map((child) => serializeBlocks(child).trimEnd())
			.filter(Boolean)
			.join('\n\n');
	}

	if (node.type === 'paragraph') {
		return serializeInlineNodes(node.content || []);
	}

	if (node.type === 'heading') {
		const level = Math.min(Math.max(node.attrs?.level || 1, 1), 6);
		return `${'#'.repeat(level)} ${serializeInlineNodes(node.content || [])}`;
	}

	if (node.type === 'blockquote') {
		const quoted = (node.content || [])
			.map((child) => serializeBlocks(child))
			.filter(Boolean)
			.join('\n')
			.split('\n')
			.map((line) => `> ${line}`)
			.join('\n');
		return quoted;
	}

	if (node.type === 'bulletList') {
		return (node.content || [])
			.map((item) => {
				const text = (item.content || [])
					.map((child) => serializeBlocks(child))
					.join('\n')
					.trim();
				return `- ${text}`;
			})
			.join('\n');
	}

	if (node.type === 'orderedList') {
		return (node.content || [])
			.map((item, index) => {
				const text = (item.content || [])
					.map((child) => serializeBlocks(child))
					.join('\n')
					.trim();
				return `${index + 1}. ${text}`;
			})
			.join('\n');
	}

	if (node.type === 'listItem') {
		return (node.content || [])
			.map((child) => serializeBlocks(child))
			.join('\n');
	}

	if (node.type === 'codeBlock') {
		const text = serializeInlineNodes(node.content || []);
		return `\`\`\`\n${text}\n\`\`\``;
	}

	if (node.type === 'text') {
		return applyTextMarks(
			escapeMarkdownText(node.text || ''),
			(node.marks as Array<{ type: string; attrs?: Record<string, any> }>) || []
		);
	}

	if (node.content?.length) {
		return node.content.map((child) => serializeBlocks(child)).join('\n');
	}

	return '';
};

const serializeEditorToMarkdown = (doc?: JSONContent): string =>
	serializeBlocks(doc).trim();

export const TipTapComposer = forwardRef<TipTapComposerRef, TipTapComposerProps>(
	(
		{
			value,
			placeholder,
			showToolbar,
			readOnly,
			onChange,
			onSubmitShortcut,
			onSelectionSnippet
		},
		ref
	) => {
		const [isSyncingFromValue, setIsSyncingFromValue] = useState(false);

		const editor = useEditor({
			extensions: useMemo(
				() => [
					StarterKit,
					Underline,
					Highlight.configure({ multicolor: true }),
					Link.configure({
						openOnClick: false,
						autolink: true
					}),
					Placeholder.configure({
						placeholder
					})
				],
				[placeholder]
			),
			content: value || '',
			editable: !readOnly,
			editorProps: {
				handleKeyDown: (_, event) => {
					if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
						event.preventDefault();
						onSubmitShortcut();
						return true;
					}
					return false;
				}
			},
			onUpdate: ({ editor: currentEditor }) => {
				if (isSyncingFromValue) {
					return;
				}
				onChange(currentEditor.getHTML());
			},
			onSelectionUpdate: ({ editor: currentEditor }) => {
				if (!onSelectionSnippet) {
					return;
				}
				const { from, to } = currentEditor.state.selection;
				if (from === to) {
					onSelectionSnippet(null);
					return;
				}
				const text = currentEditor.state.doc.textBetween(from, to, ' ');
				if (!text.trim()) {
					onSelectionSnippet(null);
					return;
				}
				onSelectionSnippet({
					text
				});
			}
		});

		useEffect(() => {
			if (!editor) {
				return;
			}
			editor.setEditable(!readOnly);
		}, [editor, readOnly]);

		useEffect(() => {
			if (!editor) {
				return;
			}
			const current = editor.getHTML();
			if ((value || '') === current) {
				return;
			}
			setIsSyncingFromValue(true);
			editor.commands.setContent(value || '');
			setTimeout(() => setIsSyncingFromValue(false), 0);
		}, [editor, value]);

		useImperativeHandle(ref, () => ({
			clear: () => {
				editor?.commands.clearContent();
			},
			focus: () => {
				editor?.commands.focus();
			},
			setText: (nextValue: string) => {
				editor?.commands.setContent(nextValue || '');
			},
			getHTML: () => {
				if (!editor) {
					return '';
				}
				return editor.getHTML();
			},
			insertText: (nextValue: string) => {
				if (!editor || !nextValue) {
					return;
				}
				editor.chain().focus().insertContent(nextValue).run();
			},
			insertSnippet: (payload: HighlightSnippetPayload) => {
				if (!editor || !payload?.text) {
					return;
				}
				const anchorMeta = payload.anchorId
					? ` [anchor:${payload.anchorId}]`
					: '';
				editor
					.chain()
					.focus()
					.setHighlight()
					.insertContent(payload.text)
					.unsetHighlight()
					.insertContent(anchorMeta)
					.run();
			},
			runAction: (action: string) => {
				if (!editor) {
					return;
				}

				switch (action) {
					case 'undo':
						editor.chain().focus().undo().run();
						return;
					case 'redo':
						editor.chain().focus().redo().run();
						return;
					case 'bold':
						editor.chain().focus().toggleBold().run();
						return;
					case 'italic':
						editor.chain().focus().toggleItalic().run();
						return;
					case 'underline':
						editor.chain().focus().toggleUnderline().run();
						return;
					case 'highlight':
						editor.chain().focus().toggleHighlight({ color: '#fff59d' }).run();
						return;
					case 'highlightYellow':
						editor.chain().focus().setHighlight({ color: '#fff59d' }).run();
						return;
					case 'highlightOrange':
						editor.chain().focus().setHighlight({ color: '#ffcc80' }).run();
						return;
					case 'highlightRose':
						editor.chain().focus().setHighlight({ color: '#ffcdd2' }).run();
						return;
					case 'highlightMint':
						editor.chain().focus().setHighlight({ color: '#b2f2bb' }).run();
						return;
					case 'highlightBlue':
						editor.chain().focus().setHighlight({ color: '#b3e5fc' }).run();
						return;
					case 'bulletList':
						editor.chain().focus().toggleBulletList().run();
						return;
					case 'orderedList':
						editor.chain().focus().toggleOrderedList().run();
						return;
					case 'strike':
						editor.chain().focus().toggleStrike().run();
						return;
					case 'insertEmoji':
						editor.chain().focus().insertContent('🙂').run();
						return;
					case 'insertImageMarker': {
						const imageUrl = window.prompt('Image URL', '');
						if (imageUrl === null || !imageUrl.trim()) {
							return;
						}
						editor
							.chain()
							.focus()
							.insertContent(` [image: ${imageUrl.trim()}] `)
							.run();
						return;
					}
					case 'insertDateTime': {
						const now = new Date();
						const stamp = now.toLocaleString();
						editor.chain().focus().insertContent(` ${stamp} `).run();
						return;
					}
					case 'blockquote': {
						const { from, to, empty } = editor.state.selection;
						if (empty) {
							// No explicit selection: toggle quote on the current block only.
							if (editor.isActive('blockquote')) {
								editor.chain().focus().unsetBlockquote().run();
							} else {
								editor.chain().focus().setBlockquote().run();
							}
							return;
						}
						// Explicit selection: quote selected paragraph(s)/lines only.
						editor
							.chain()
							.focus()
							.setTextSelection({ from, to })
							.toggleBlockquote()
							.run();
						return;
					}
					case 'setLink': {
						const previousUrl = editor.getAttributes('link').href || '';
						const url = window.prompt('URL', previousUrl);
						if (url === null) {
							return;
						}
						if (url === '') {
							editor.chain().focus().unsetLink().run();
							return;
						}
						editor.chain().focus().setLink({ href: url }).run();
						return;
					}
					case 'unsetLink':
						editor.chain().focus().unsetLink().run();
						return;
					case 'clearFormatting':
						editor.chain().focus().clearNodes().unsetAllMarks().run();
						return;
					case 'focusEnd':
						editor.commands.focus('end');
						return;
					default:
						return;
				}
			}
		}));

		if (!editor) {
			return <div className="tiptap-composer__loading" />;
		}

		return (
			<div className="tiptap-composer">
				{showToolbar && (
					<div className="tiptap-composer__toolbar">
						<button
							type="button"
							onClick={() => editor.chain().focus().undo().run()}
							disabled={!editor.can().undo()}
							aria-label="Undo"
						>
							<Undo fontSize="small" />
						</button>
						<button
							type="button"
							onClick={() => editor.chain().focus().redo().run()}
							disabled={!editor.can().redo()}
							aria-label="Redo"
						>
							<Redo fontSize="small" />
						</button>
						<button
							type="button"
							onClick={() => editor.chain().focus().toggleBold().run()}
							className={editor.isActive('bold') ? 'is-active' : ''}
							aria-label="Bold"
						>
							<FormatBold fontSize="small" />
						</button>
						<button
							type="button"
							onClick={() => editor.chain().focus().toggleBulletList().run()}
							className={editor.isActive('bulletList') ? 'is-active' : ''}
							aria-label="Bullet List"
						>
							<FormatListBulleted fontSize="small" />
						</button>
						<button
							type="button"
							onClick={() => editor.chain().focus().toggleOrderedList().run()}
							className={editor.isActive('orderedList') ? 'is-active' : ''}
							aria-label="Ordered List"
						>
							<FilterList fontSize="small" />
						</button>
						<button
							type="button"
							onClick={() => editor.chain().focus().toggleLink({ href: '#' }).run()}
							className={editor.isActive('link') ? 'is-active' : ''}
							aria-label="Quick Link"
						>
							<ChevronRight fontSize="small" />
						</button>
					</div>
				)}
				<EditorContent editor={editor} className="tiptap-composer__content" />
			</div>
		);
	}
);

TipTapComposer.displayName = 'TipTapComposer';


