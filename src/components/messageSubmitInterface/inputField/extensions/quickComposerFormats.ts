import type { Editor, Range } from '@tiptap/core';
import type { ComposerFormatGate } from './composerFormatGate';

export const quickComposerFormats = [
	{ id: 'bold', en: 'bold', de: 'fett' },
	{ id: 'italic', en: 'italic', de: 'kursiv' },
	{ id: 'bulletList', en: 'list', de: 'liste' },
	{ id: 'orderedList', en: 'numbered', de: 'nummeriert' }
] as const;

export type QuickComposerFormat = (typeof quickComposerFormats)[number]['id'];

export const isQuickComposerFormat = (
	action: string
): action is QuickComposerFormat =>
	quickComposerFormats.some(({ id }) => id === action);

export const applyQuickComposerFormat = (
	editor: Editor,
	gate: ComposerFormatGate,
	action: QuickComposerFormat,
	trigger?: Range
): boolean => {
	if (editor.isDestroyed || !editor.isEditable || !gate.isEnabled(action)) {
		return false;
	}

	const chain = editor.chain().focus();
	if (trigger) {
		// Consume the slash and apply the format in the same editor update.
		chain.deleteRange(trigger);
	}
	switch (action) {
		case 'bold':
			return chain.toggleBold().run();
		case 'italic':
			return chain.toggleItalic().run();
		case 'bulletList':
			return chain.toggleBulletList().run();
		case 'orderedList':
			return chain.toggleOrderedList().run();
	}
};
