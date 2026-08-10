import React, {
	forwardRef,
	useEffect,
	useImperativeHandle,
	useMemo,
	useRef,
	useState
} from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import { Mark } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import Highlight from '@tiptap/extension-highlight';
import TextAlign from '@tiptap/extension-text-align';
import Placeholder from '@tiptap/extension-placeholder';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import {
	createMentionExtension,
	MentionProvider
} from './inputField/extensions/createMentionExtension';
import {
	InsertionMarker,
	insertionMarkerKey
} from './inputField/extensions/insertionMarker';
import {
	FormatBold,
	FormatListBulleted,
	FilterList,
	Undo,
	Redo,
	ChevronRight
} from '@mui/icons-material';
import { useChatComposerShortcuts } from '../../features/keyboard-shortcuts/hooks/useChatComposerShortcuts';
import {
	filesFromDataTransfer,
	hasComposerFiles
} from './composerFileDropPaste';
import './TipTapComposer.styles.scss';

const isMentionSuggestionOpen = (): boolean =>
	!!document.querySelector(
		'.mentionList__popup .mentionList, .mentionList[role="listbox"]'
	);

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
	/** Inserts '@' so the mention suggestion reliably opens. */
	insertMentionTrigger: () => void;
	/**
	 * Pins a dot at the caret, marking where a voice message will land, and
	 * clears it again (#996).
	 */
	setInsertionMarker: (visible: boolean) => void;
	insertSnippet: (payload: HighlightSnippetPayload) => void;
	runAction: (action: string) => void;
	isActionActive: (action: string) => boolean;
}

interface TipTapComposerProps {
	value: string;
	placeholder: string;
	showToolbar: boolean;
	readOnly: boolean;
	maxLength?: number;
	onChange: (value: string) => void;
	onSubmitShortcut: () => void;
	onSelectionSnippet?: (payload: HighlightSnippetPayload | null) => void;
	/** Editor gained/lost focus — drives the Figma "Selected" container state. */
	onFocusChange?: (focused: boolean) => void;
	/** Enables Slack-like @-mentions for agency consultants when provided. */
	mentionProvider?: MentionProvider;
	/** Shortcut: edit the last own message (returns true if handled). */
	onEditLast?: () => boolean;
	/** Shortcut: cancel the current reply/edit (returns true if handled). */
	onCancel?: () => boolean;
	/** Shortcut: open the file attachment picker (returns true if handled). */
	onUpload?: () => boolean;
	/** Shortcut: open the emoji picker (returns true if handled). */
	onOpenEmoji?: () => boolean;
	/** True when the composer has no text and no attachment. */
	isComposerEmpty?: boolean;
	/**
	 * Files dropped or pasted into the editor (WP-4): routed into the
	 * existing attachment flow by the parent. Absent = files fall through
	 * to the browser default.
	 */
	onFilesSelected?: (files: File[]) => void;
}

const getEditorPlainTextLength = (editorLike: any): number =>
	(editorLike?.state?.doc?.textContent || '').length;

const isEditorReady = (editorLike: any): boolean =>
	Boolean(editorLike && !editorLike.isDestroyed);

/**
 * Drops the voice-message insertion dot (#996). The marker points at a spot in
 * the text, so a content reset — send, clear, draft switch — must drop it.
 */
const clearInsertionMarker = (editorLike: any): void => {
	if (!isEditorReady(editorLike)) {
		return;
	}
	editorLike.view?.dispatch(
		editorLike.state.tr.setMeta(insertionMarkerKey, null)
	);
};

const getSelectionTextLength = (
	editorLike: any,
	from: number,
	to: number
): number => (editorLike?.state?.doc?.textBetween(from, to, '') || '').length;

const getAvailableInputLength = (
	editorLike: any,
	from: number,
	to: number,
	maxLength?: number
): number | null => {
	if (!maxLength) {
		return null;
	}

	const currentLength = getEditorPlainTextLength(editorLike);
	const selectedLength = getSelectionTextLength(editorLike, from, to);
	return maxLength - (currentLength - selectedLength);
};

const enforceEditorMaxLength = (
	editorLike: any,
	maxLength?: number
): boolean => {
	if (!maxLength || !isEditorReady(editorLike)) {
		return false;
	}

	const plainText = editorLike?.state?.doc?.textContent || '';
	if (plainText.length <= maxLength) {
		return false;
	}

	editorLike.commands.setContent(plainText.slice(0, maxLength));
	return true;
};

const Superscript = Mark.create({
	name: 'superscript',
	parseHTML() {
		return [{ tag: 'sup' }];
	},
	renderHTML({ HTMLAttributes }) {
		return ['sup', HTMLAttributes, 0];
	}
});

const Subscript = Mark.create({
	name: 'subscript',
	parseHTML() {
		return [{ tag: 'sub' }];
	},
	renderHTML({ HTMLAttributes }) {
		return ['sub', HTMLAttributes, 0];
	}
});

export const TipTapComposer = forwardRef<
	TipTapComposerRef,
	TipTapComposerProps
>(
	(
		{
			value,
			placeholder,
			showToolbar,
			readOnly,
			maxLength,
			onChange,
			onSubmitShortcut,
			onSelectionSnippet,
			onFocusChange,
			mentionProvider,
			onEditLast,
			onCancel,
			onUpload,
			onOpenEmoji,
			isComposerEmpty,
			onFilesSelected
		},
		ref
	) => {
		const [isSyncingFromValue, setIsSyncingFromValue] = useState(false);

		const { handleComposerKeyDown } = useChatComposerShortcuts({
			onSend: onSubmitShortcut,
			disabled: readOnly,
			hasOpenSuggestions: false,
			onEditLast,
			onCancel,
			onUpload,
			onOpenEmoji,
			isComposerEmpty
		});
		const shortcutHandlerRef = useRef(handleComposerKeyDown);
		shortcutHandlerRef.current = handleComposerKeyDown;
		const onFilesSelectedRef = useRef(onFilesSelected);
		onFilesSelectedRef.current = onFilesSelected;

		const editor = useEditor({
			extensions: useMemo(
				() => [
					// StarterKit v3 bundles Link + Underline; disable them here so the
					// explicitly-configured standalone extensions below are the only ones
					// (avoids "Duplicate extension names found: ['link', 'underline']").
					StarterKit.configure({ link: false, underline: false }),
					Underline,
					Superscript,
					Subscript,
					TextAlign.configure({
						types: ['heading', 'paragraph'],
						defaultAlignment: 'left'
					}),
					Highlight.configure({ multicolor: true }),
					Link.configure({
						openOnClick: false,
						autolink: true
					}),
					Placeholder.configure({
						placeholder
					}),
					TaskList,
					TaskItem.configure({ nested: true }),
					InsertionMarker,
					...(mentionProvider
						? [createMentionExtension(mentionProvider)]
						: [])
				],
				// mentionProvider is captured once on mount — the provider reads
				// live data via its closures, so it need not be a dep.
				// eslint-disable-next-line react-hooks/exhaustive-deps
				[placeholder]
			),
			content: value || '',
			editable: !readOnly,
			editorProps: {
				handleTextInput: (view, from, to, text) => {
					const availableLength = getAvailableInputLength(
						view,
						from,
						to,
						maxLength
					);
					if (
						availableLength === null ||
						text.length <= availableLength
					) {
						return false;
					}
					if (availableLength <= 0) {
						return true;
					}
					view.dispatch(
						view.state.tr.insertText(
							text.slice(0, availableLength),
							from,
							to
						)
					);
					return true;
				},
				handleDrop: (_view, event, _slice, moved) => {
					if (moved || !onFilesSelectedRef.current) {
						return false;
					}
					if (!hasComposerFiles(event.dataTransfer)) {
						return false;
					}
					event.preventDefault();
					onFilesSelectedRef.current(
						filesFromDataTransfer(event.dataTransfer)
					);
					return true;
				},
				handlePaste: (view, event) => {
					// Files first (e.g. a pasted screenshot): route into the
					// attachment flow instead of inserting anything.
					if (
						onFilesSelectedRef.current &&
						hasComposerFiles(event.clipboardData)
					) {
						event.preventDefault();
						onFilesSelectedRef.current(
							filesFromDataTransfer(event.clipboardData)
						);
						return true;
					}
					const pastedText =
						event.clipboardData?.getData('text/plain') || '';
					if (!pastedText) {
						return false;
					}

					const { from, to } = view.state.selection;
					const availableLength = getAvailableInputLength(
						view,
						from,
						to,
						maxLength
					);
					if (
						availableLength === null ||
						pastedText.length <= availableLength
					) {
						return false;
					}

					event.preventDefault();
					if (availableLength > 0) {
						view.dispatch(
							view.state.tr.insertText(
								pastedText.slice(0, availableLength),
								from,
								to
							)
						);
					}
					return true;
				},
				handleKeyDown: (_, event) => {
					if (isMentionSuggestionOpen()) {
						return false;
					}
					return shortcutHandlerRef.current(event);
				}
			},
			onFocus: () => {
				onFocusChange?.(true);
			},
			onBlur: () => {
				onFocusChange?.(false);
				// Deliberately NOT clearing the insertion marker here (#996):
				// pressing the mic button blurs the editor, so a blur-clear
				// would wipe the dot at the exact moment it becomes useful.
				// The parent owns the marker's lifetime; a content reset
				// (send, clear, draft switch) drops it.
			},
			onUpdate: ({ editor: currentEditor }) => {
				if (isSyncingFromValue || !isEditorReady(currentEditor)) {
					return;
				}
				if (enforceEditorMaxLength(currentEditor, maxLength)) {
					onChange(currentEditor.getHTML());
					return;
				}
				onChange(currentEditor.getHTML());
			},
			onSelectionUpdate: ({ editor: currentEditor }) => {
				if (!onSelectionSnippet || !isEditorReady(currentEditor)) {
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
			if (!isEditorReady(editor)) {
				return;
			}
			editor.setEditable(!readOnly);
		}, [editor, readOnly]);

		useEffect(() => {
			if (!isEditorReady(editor)) {
				return;
			}
			const normalizedValue = (value || '')
				.replace(/text-align\s*:\s*right/gi, 'text-align: left')
				.replace(
					/data-text-align\s*=\s*["']right["']/gi,
					'data-text-align="left"'
				);
			// Always keep default writing flow left-to-right for new/empty content.
			if (!normalizedValue.trim()) {
				editor.commands.setTextAlign('left');
			}
			const current = editor.getHTML();
			if (normalizedValue === current) {
				return;
			}
			setIsSyncingFromValue(true);
			try {
				clearInsertionMarker(editor);
				editor.commands.setContent(normalizedValue);
				editor.commands.setTextAlign('left');
				if (enforceEditorMaxLength(editor, maxLength)) {
					onChange(editor.getHTML());
				}
			} catch {
				try {
					editor.commands.clearContent();
				} catch {
					// Ignore — a corrupt stored draft must never break the composer.
				}
			}
			setTimeout(() => setIsSyncingFromValue(false), 0);
		}, [editor, maxLength, onChange, value]);

		useImperativeHandle(ref, () => ({
			clear: () => {
				if (isEditorReady(editor)) {
					editor.commands.clearContent();
				}
			},
			focus: () => {
				if (isEditorReady(editor)) {
					editor.commands.focus();
				}
			},
			setText: (nextValue: string) => {
				if (isEditorReady(editor)) {
					clearInsertionMarker(editor);
					editor.commands.setContent(nextValue || '');
				}
			},
			getHTML: () => {
				if (!isEditorReady(editor)) {
					return '';
				}
				return editor.getHTML();
			},
			insertText: (nextValue: string) => {
				if (!isEditorReady(editor) || !nextValue) {
					return;
				}
				editor.chain().focus().insertContent(nextValue).run();
			},
			setInsertionMarker: (visible: boolean) => {
				if (!isEditorReady(editor)) {
					return;
				}
				const { state, view } = editor;
				view.dispatch(
					state.tr.setMeta(
						insertionMarkerKey,
						visible ? state.selection.from : null
					)
				);
			},
			insertMentionTrigger: () => {
				if (!isEditorReady(editor)) {
					return;
				}
				// The mention suggestion only fires on '@' at a line start or
				// after whitespace — a bare '@' pasted right behind text would
				// silently do nothing, so pad it when needed.
				const { $from } = editor.state.selection;
				const textBefore = $from.parent.textBetween(
					0,
					$from.parentOffset,
					undefined,
					'￼'
				);
				const needsSpace = /\S$/.test(textBefore);
				editor
					.chain()
					.focus()
					.insertContent(needsSpace ? ' @' : '@')
					.run();
			},
			insertSnippet: (payload: HighlightSnippetPayload) => {
				if (!isEditorReady(editor) || !payload?.text) {
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
				if (!isEditorReady(editor)) {
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
					case 'paragraph':
						editor.chain().focus().setParagraph().run();
						return;
					case 'heading1':
						editor
							.chain()
							.focus()
							.toggleHeading({ level: 1 })
							.run();
						return;
					case 'heading2':
						editor
							.chain()
							.focus()
							.toggleHeading({ level: 2 })
							.run();
						return;
					case 'heading3':
						editor
							.chain()
							.focus()
							.toggleHeading({ level: 3 })
							.run();
						return;
					case 'heading4':
						editor
							.chain()
							.focus()
							.toggleHeading({ level: 4 })
							.run();
						return;
					case 'taskList':
						editor.chain().focus().toggleTaskList().run();
						return;
					case 'alignLeft':
						editor.chain().focus().setTextAlign('left').run();
						return;
					case 'alignCenter':
						editor.chain().focus().setTextAlign('center').run();
						return;
					case 'alignRight':
						editor.chain().focus().setTextAlign('right').run();
						return;
					case 'italic':
						editor.chain().focus().toggleItalic().run();
						return;
					case 'underline':
						editor.chain().focus().toggleUnderline().run();
						return;
					case 'highlight':
						editor
							.chain()
							.focus()
							.toggleHighlight({ color: '#fff59d' })
							.run();
						return;
					case 'highlightYellow':
						editor
							.chain()
							.focus()
							.setHighlight({ color: '#fff59d' })
							.run();
						return;
					case 'highlightOrange':
						editor
							.chain()
							.focus()
							.setHighlight({ color: '#ffcc80' })
							.run();
						return;
					case 'highlightRose':
						editor
							.chain()
							.focus()
							.setHighlight({ color: '#ffcdd2' })
							.run();
						return;
					case 'highlightMint':
						editor
							.chain()
							.focus()
							.setHighlight({ color: '#b2f2bb' })
							.run();
						return;
					case 'highlightBlue':
						editor
							.chain()
							.focus()
							.setHighlight({ color: '#b3e5fc' })
							.run();
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
					case 'code':
						editor.chain().focus().toggleCode().run();
						return;
					case 'codeBlock':
						editor.chain().focus().toggleCodeBlock().run();
						return;
					case 'superscript': {
						editor.chain().focus().toggleMark('superscript').run();
						return;
					}
					case 'subscript': {
						editor.chain().focus().toggleMark('subscript').run();
						return;
					}
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
						editor
							.chain()
							.focus()
							.insertContent(` ${stamp} `)
							.run();
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
						return;
					}
					case 'unsetLink':
						editor.chain().focus().unsetLink().run();
						return;
					case 'clearFormatting':
						editor
							.chain()
							.focus()
							.clearNodes()
							.unsetAllMarks()
							.run();
						return;
					case 'focusEnd':
						editor.commands.focus('end');
						return;
					default:
						return;
				}
			},
			isActionActive: (action: string) => {
				if (!isEditorReady(editor)) {
					return false;
				}
				const activeTextAlign = editor.isActive('heading')
					? editor.getAttributes('heading')?.textAlign || 'left'
					: editor.getAttributes('paragraph')?.textAlign || 'left';
				switch (action) {
					case 'bold':
						return editor.isActive('bold');
					case 'paragraph':
						return editor.isActive('paragraph');
					case 'heading1':
						return editor.isActive('heading', { level: 1 });
					case 'heading2':
						return editor.isActive('heading', { level: 2 });
					case 'heading3':
						return editor.isActive('heading', { level: 3 });
					case 'heading4':
						return editor.isActive('heading', { level: 4 });
					case 'taskList':
						return editor.isActive('taskList');
					case 'alignLeft':
						return (
							activeTextAlign !== 'center' &&
							activeTextAlign !== 'right'
						);
					case 'alignCenter':
						return activeTextAlign === 'center';
					case 'alignRight':
						return activeTextAlign === 'right';
					case 'italic':
						return editor.isActive('italic');
					case 'underline':
						return editor.isActive('underline');
					case 'highlight':
						return editor.isActive('highlight');
					case 'bulletList':
						return editor.isActive('bulletList');
					case 'orderedList':
						return editor.isActive('orderedList');
					case 'strike':
						return editor.isActive('strike');
					case 'code':
						return editor.isActive('code');
					case 'codeBlock':
						return editor.isActive('codeBlock');
					case 'superscript':
						return editor.isActive('superscript');
					case 'subscript':
						return editor.isActive('subscript');
					case 'blockquote':
						return editor.isActive('blockquote');
					case 'link':
						return editor.isActive('link');
					default:
						return false;
				}
			}
		}));

		if (!isEditorReady(editor)) {
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
							onClick={() =>
								editor.chain().focus().toggleBold().run()
							}
							className={
								editor.isActive('bold') ? 'is-active' : ''
							}
							aria-label="Bold"
						>
							<FormatBold fontSize="small" />
						</button>
						<button
							type="button"
							onClick={() =>
								editor.chain().focus().toggleBulletList().run()
							}
							className={
								editor.isActive('bulletList') ? 'is-active' : ''
							}
							aria-label="Bullet List"
						>
							<FormatListBulleted fontSize="small" />
						</button>
						<button
							type="button"
							onClick={() =>
								editor.chain().focus().toggleOrderedList().run()
							}
							className={
								editor.isActive('orderedList')
									? 'is-active'
									: ''
							}
							aria-label="Ordered List"
						>
							<FilterList fontSize="small" />
						</button>
						<button
							type="button"
							onClick={() =>
								editor
									.chain()
									.focus()
									.toggleLink({ href: '#' })
									.run()
							}
							className={
								editor.isActive('link') ? 'is-active' : ''
							}
							aria-label="Quick Link"
						>
							<ChevronRight fontSize="small" />
						</button>
					</div>
				)}
				<EditorContent
					editor={editor}
					className="tiptap-composer__content"
				/>
			</div>
		);
	}
);

TipTapComposer.displayName = 'TipTapComposer';
