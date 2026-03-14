import React, {
	forwardRef,
	useEffect,
	useImperativeHandle,
	useMemo,
	useState
} from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import Highlight from '@tiptap/extension-highlight';
import Placeholder from '@tiptap/extension-placeholder';
import {
	FormatBold,
	FormatItalic,
	FormatUnderlined,
	FormatListBulleted,
	FormatListNumbered,
	FormatQuote,
	Code,
	Link as LinkIcon,
	Undo,
	Redo,
	BorderColor
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
	insertSnippet: (payload: HighlightSnippetPayload) => void;
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
				onChange(currentEditor.getText());
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
			const current = editor.getText();
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
							onClick={() => editor.chain().focus().toggleItalic().run()}
							className={editor.isActive('italic') ? 'is-active' : ''}
							aria-label="Italic"
						>
							<FormatItalic fontSize="small" />
						</button>
						<button
							type="button"
							onClick={() => editor.chain().focus().toggleUnderline().run()}
							className={editor.isActive('underline') ? 'is-active' : ''}
							aria-label="Underline"
						>
							<FormatUnderlined fontSize="small" />
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
							<FormatListNumbered fontSize="small" />
						</button>
						<button
							type="button"
							onClick={() => editor.chain().focus().toggleBlockquote().run()}
							className={editor.isActive('blockquote') ? 'is-active' : ''}
							aria-label="Quote"
						>
							<FormatQuote fontSize="small" />
						</button>
						<button
							type="button"
							onClick={() => editor.chain().focus().toggleCodeBlock().run()}
							className={editor.isActive('codeBlock') ? 'is-active' : ''}
							aria-label="Code Block"
						>
							<Code fontSize="small" />
						</button>
						<button
							type="button"
							onClick={() => {
								const previousUrl =
									editor.getAttributes('link').href || '';
								const url = window.prompt('URL', previousUrl);
								if (url === null) {
									return;
								}
								if (url === '') {
									editor.chain().focus().unsetLink().run();
									return;
								}
								editor.chain().focus().setLink({ href: url }).run();
							}}
							className={editor.isActive('link') ? 'is-active' : ''}
							aria-label="Link"
						>
							<LinkIcon fontSize="small" />
						</button>
						<button
							type="button"
							onClick={() => editor.chain().focus().toggleHighlight().run()}
							className={editor.isActive('highlight') ? 'is-active' : ''}
							aria-label="Highlight"
						>
							<BorderColor fontSize="small" />
						</button>
					</div>
				)}
				<EditorContent editor={editor} className="tiptap-composer__content" />
			</div>
		);
	}
);

TipTapComposer.displayName = 'TipTapComposer';


