import * as React from 'react';
import { useEffect, useId, useImperativeHandle, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { BubbleMenuPlugin } from '@tiptap/extension-bubble-menu';
import { isTextSelection, type Editor } from '@tiptap/core';
import { useEditorState } from '@tiptap/react';
import { PluginKey } from '@tiptap/pm/state';
import FormatBold from '@mui/icons-material/FormatBold';
import FormatItalic from '@mui/icons-material/FormatItalic';
import FormatListBulleted from '@mui/icons-material/FormatListBulleted';
import FormatListNumbered from '@mui/icons-material/FormatListNumbered';
import { ToolbarButton } from './ToolbarButton';
import {
	applyQuickComposerFormat,
	quickComposerFormats,
	type QuickComposerFormat
} from './extensions/quickComposerFormats';
import type { ComposerFormatGate } from './extensions/composerFormatGate';
import type { ChatComposerFormat } from '../../message/chatMessageConfig';
import './composerToolbar.styles.scss';
import './composerFormatMenus.styles.scss';

const glyphs = {
	bold: FormatBold,
	italic: FormatItalic,
	bulletList: FormatListBulleted,
	orderedList: FormatListNumbered
};

export const selectionFormatMenuKey = new PluginKey('selectionFormatMenu');

export const ComposerSelectionFormatMenu = ({
	editor,
	gate,
	disabledFormats
}: {
	editor: Editor;
	gate: ComposerFormatGate;
	disabledFormats: ReadonlySet<ChatComposerFormat>;
}) => {
	const { t } = useTranslation();
	const [element] = useState(() => {
		const node = document.createElement('div');
		node.className = 'composerFormatMenu composerFormatMenu--selection';
		node.dataset.keepsFocus = '';
		return node;
	});
	const activeFormats = useEditorState({
		editor,
		selector: ({ editor: current }) =>
			quickComposerFormats
				.filter(({ id }) => current.isActive(id))
				.map(({ id }) => id)
	});
	const hasEnabledFormat = quickComposerFormats.some(
		({ id }) => !disabledFormats.has(id)
	);

	useEffect(() => {
		if (!hasEnabledFormat || editor.isDestroyed) {
			return;
		}
		// A dedicated mount makes TipTap distinguish focus in the menu from
		// focus anywhere else, including the second editor in a split view.
		const mount = document.createElement('div');
		const editorElement = editor.view.dom;
		const focusToolbar = (event: KeyboardEvent) => {
			if (event.altKey && event.key === 'F10' && element.isConnected) {
				event.preventDefault();
				element.querySelector('button')?.focus();
			}
		};
		const hideOnOutsideInteraction = (event: Event) => {
			const target = event.target;
			if (
				element.isConnected &&
				target instanceof Node &&
				!element.contains(target) &&
				!editorElement.contains(target) &&
				!editor.isDestroyed
			) {
				editor.commands.setMeta(selectionFormatMenuKey, 'hide');
			}
		};
		// BubbleMenu listens to window scroll. The editor also scrolls independently.
		let scrollFrame: number | null = null;
		const updatePositionAfterEditorScroll = () => {
			if (scrollFrame !== null || !element.isConnected) return;

			scrollFrame = window.requestAnimationFrame(() => {
				scrollFrame = null;
				if (
					editorElement.isConnected &&
					element.isConnected &&
					!editor.isDestroyed
				) {
					editor.commands.setMeta(
						selectionFormatMenuKey,
						'updatePosition'
					);
				}
			});
		};
		editorElement.addEventListener('keydown', focusToolbar);
		editorElement.addEventListener(
			'scroll',
			updatePositionAfterEditorScroll,
			{
				passive: true
			}
		);
		document.addEventListener('focusin', hideOnOutsideInteraction);
		document.addEventListener(
			'pointerdown',
			hideOnOutsideInteraction,
			true
		);
		document.body.appendChild(mount);
		editor.registerPlugin(
			BubbleMenuPlugin({
				editor,
				element,
				pluginKey: selectionFormatMenuKey,
				appendTo: mount,
				updateDelay: 0,
				shouldShow: ({ view, state, from, to }) =>
					editor.isEditable &&
					(view.hasFocus() ||
						element.contains(document.activeElement)) &&
					isTextSelection(state.selection) &&
					!state.selection.empty &&
					!!state.doc.textBetween(from, to).trim(),
				options: {
					strategy: 'fixed',
					placement: 'top',
					offset: 8,
					flip: { padding: 8 },
					shift: { padding: 8 },
					onShow: () =>
						editorElement.setAttribute(
							'aria-keyshortcuts',
							'Alt+F10'
						),
					onHide: () =>
						editorElement.removeAttribute('aria-keyshortcuts')
				}
			})
		);
		return () => {
			editorElement.removeEventListener('keydown', focusToolbar);
			editorElement.removeEventListener(
				'scroll',
				updatePositionAfterEditorScroll
			);
			if (scrollFrame !== null) window.cancelAnimationFrame(scrollFrame);
			document.removeEventListener('focusin', hideOnOutsideInteraction);
			document.removeEventListener(
				'pointerdown',
				hideOnOutsideInteraction,
				true
			);
			editorElement.removeAttribute('aria-keyshortcuts');
			if (!editor.isDestroyed) {
				editor.unregisterPlugin(selectionFormatMenuKey);
			}
			mount.remove();
		};
	}, [editor, element, hasEnabledFormat]);

	if (!hasEnabledFormat) {
		return null;
	}

	return createPortal(
		<div
			className="composerFormatMenu__toolbar"
			role="toolbar"
			aria-label={t('message.submit.toolbar.selectionFormats')}
			onMouseDown={(event) => event.preventDefault()}
			onKeyDown={(event) => {
				if (event.key === 'Escape') {
					event.stopPropagation();
					editor.commands.focus();
				}
			}}
		>
			{quickComposerFormats
				.filter(({ id }) => !disabledFormats.has(id))
				.map(({ id }) => {
					const Glyph = glyphs[id];
					const label = t(`message.submit.toolbar.${id}`);
					return (
						<ToolbarButton
							key={id}
							label={label}
							title={label}
							selected={activeFormats.includes(id)}
							onClick={() =>
								applyQuickComposerFormat(editor, gate, id)
							}
						>
							<Glyph aria-hidden />
						</ToolbarButton>
					);
				})}
		</div>,
		element
	);
};

export interface SlashFormatListRef {
	onKeyDown: (event: KeyboardEvent) => boolean;
}

export const SlashFormatList = React.forwardRef<
	SlashFormatListRef,
	{
		editor: Editor;
		items: (typeof quickComposerFormats)[number][];
		command: (item: (typeof quickComposerFormats)[number]) => void;
		label: string;
		getLabel: (id: QuickComposerFormat) => string;
		locale: 'de' | 'en';
	}
>(({ editor, items, command, label, getLabel, locale }, ref) => {
	const listId = useId();
	const [requestedIndex, setRequestedIndex] = useState(0);
	const itemIndex = Math.min(requestedIndex, items.length - 1);
	const optionId = `${listId}-${itemIndex}`;
	const selectedOption = useRef<HTMLButtonElement>(null);

	useEffect(() => {
		const field = editor.view.dom;
		if (itemIndex < 0) {
			return;
		}
		field.setAttribute('aria-controls', listId);
		field.setAttribute('aria-activedescendant', optionId);
		selectedOption.current?.scrollIntoView?.({ block: 'nearest' });
		return () => {
			field.removeAttribute('aria-controls');
			field.removeAttribute('aria-activedescendant');
		};
	}, [editor, itemIndex, listId, optionId]);

	useImperativeHandle(
		ref,
		() => ({
			onKeyDown: (event) => {
				if (!items.length || event.isComposing) {
					return false;
				}
				switch (event.key) {
					case 'ArrowDown':
						setRequestedIndex((itemIndex + 1) % items.length);
						return true;
					case 'ArrowUp':
						setRequestedIndex(
							(itemIndex + items.length - 1) % items.length
						);
						return true;
					case 'Enter':
						command(items[itemIndex]);
						return true;
					default:
						return false;
				}
			}
		}),
		[command, itemIndex, items]
	);

	return (
		<div
			id={listId}
			className="composerFormatMenu__list"
			role="listbox"
			aria-label={label}
			onMouseDown={(event) => event.preventDefault()}
		>
			{items.map((format, index) => {
				const Glyph = glyphs[format.id];
				const selected = index === itemIndex;
				return (
					<button
						key={format.id}
						id={`${listId}-${index}`}
						ref={selected ? selectedOption : undefined}
						role="option"
						type="button"
						tabIndex={-1}
						aria-selected={selected}
						className="composerToolbar__menuItem"
						onMouseEnter={() => setRequestedIndex(index)}
						onClick={() => command(format)}
					>
						<Glyph fontSize="small" aria-hidden />
						<span>{getLabel(format.id)}</span>
						<span
							className="composerFormatMenu__shortcut"
							aria-hidden
						>
							/{format[locale]}
						</span>
					</button>
				);
			})}
		</div>
	);
});
SlashFormatList.displayName = 'SlashFormatList';
