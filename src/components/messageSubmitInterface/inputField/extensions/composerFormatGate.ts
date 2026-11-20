import {
	Extension,
	InputRule,
	PasteRule,
	type AnyExtension,
	type KeyboardShortcutCommand
} from '@tiptap/core';
import { Fragment, Slice, type Node, type Schema } from '@tiptap/pm/model';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import type { ChatComposerFormat } from '../../../message/chatMessageConfig';

/**
 * Platform-wide format switches for the composer.
 *
 * Off means "cannot be created while composing". It never means "removed": every
 * extension stays in the editor's schema, so a draft or an edited message that
 * already contains the format keeps it, and switching the format on again needs
 * no new editor. That is why the switches gate the *ways in* at the moment they
 * fire, instead of configuring extensions away (`StarterKit.configure({ bold:
 * false })` would drop `<strong>` from every message loaded into the composer).
 *
 * Ways in, all gated here: keyboard shortcut, markdown input rule, paste rule,
 * pasted or dropped rich content, and link autolinking. Toolbar actions are
 * gated in `TipTapComposer.runAction`.
 */
export interface ComposerFormatGate {
	isEnabled: (format: ChatComposerFormat) => boolean;
}

const FORMAT_OF_EXTENSION: Record<string, ChatComposerFormat> = {
	heading: 'heading',
	bulletList: 'bulletList',
	orderedList: 'orderedList',
	taskList: 'taskList',
	// Owns the `[ ] ` input rule that starts a task list.
	taskItem: 'taskList',
	blockquote: 'blockquote',
	codeBlock: 'codeBlock',
	bold: 'bold',
	italic: 'italic',
	strike: 'strike',
	code: 'code',
	underline: 'underline',
	highlight: 'highlight',
	link: 'link',
	superscript: 'superscript',
	subscript: 'subscript'
};

/**
 * Wraps one extension. Only `Mod-…` bindings create a format; plain keys such as
 * Enter or Backspace inside a code block keep working, because they are how
 * someone edits a block that is already there. A blocked shortcut still reports
 * "handled": otherwise the browser's own Cmd+B would apply bold natively and
 * ProseMirror would read it back into the document.
 */
export const gateExtension = (
	extension: AnyExtension,
	gate: ComposerFormatGate
): AnyExtension => {
	const format = FORMAT_OF_EXTENSION[extension.name];
	if (!format) {
		return extension;
	}
	return extension.extend({
		addKeyboardShortcuts() {
			const bindings = (this.parent?.() ?? {}) as Record<
				string,
				KeyboardShortcutCommand
			>;
			return Object.fromEntries(
				Object.entries(bindings).map(([shortcut, command]) => [
					shortcut,
					shortcut.startsWith('Mod-')
						? (props) =>
								gate.isEnabled(format) ? command(props) : true
						: command
				])
			);
		},
		addInputRules() {
			return (this.parent?.() ?? []).map(
				(rule: InputRule) =>
					new InputRule({
						find: rule.find,
						handler: (props) =>
							gate.isEnabled(format) ? rule.handler(props) : null
					})
			);
		},
		addPasteRules() {
			return (this.parent?.() ?? []).map(
				(rule: PasteRule) =>
					new PasteRule({
						find: rule.find,
						handler: (props) =>
							gate.isEnabled(format) ? rule.handler(props) : null
					})
			);
		}
	});
};

const blocksFromCodeBlock = (node: Node, schema: Schema): Node[] =>
	node.textContent
		.split('\n')
		.map((line) =>
			schema.nodes.paragraph.create(
				null,
				line ? schema.text(line) : undefined
			)
		);

const stripNode = (
	node: Node,
	schema: Schema,
	gate: ComposerFormatGate
): Node[] => {
	if (node.isText) {
		const marks = node.marks.filter((mark) => {
			const format = FORMAT_OF_EXTENSION[mark.type.name];
			return !format || gate.isEnabled(format);
		});
		return [node.mark(marks)];
	}
	const content = stripFragment(node.content, schema, gate);
	const format = FORMAT_OF_EXTENSION[node.type.name];
	if (format && !gate.isEnabled(format)) {
		switch (node.type.name) {
			case 'heading':
				return [schema.nodes.paragraph.create(null, content)];
			case 'codeBlock':
				return blocksFromCodeBlock(node, schema);
			default:
				// blockquote and the lists: their children stand on their own.
				return flattenListItems(content);
		}
	}
	return [node.copy(content)];
};

/** A `listItem` cannot stand outside a list; its paragraphs can. */
const flattenListItems = (content: Fragment): Node[] => {
	const blocks: Node[] = [];
	content.forEach((child) => {
		if (child.type.name === 'listItem' || child.type.name === 'taskItem') {
			child.content.forEach((grandChild) => blocks.push(grandChild));
		} else {
			blocks.push(child);
		}
	});
	return blocks;
};

const stripFragment = (
	fragment: Fragment,
	schema: Schema,
	gate: ComposerFormatGate
): Fragment => {
	const nodes: Node[] = [];
	fragment.forEach((node) => nodes.push(...stripNode(node, schema, gate)));
	return Fragment.fromArray(nodes);
};

/** Pasted or dropped rich content: the text stays, disabled formats do not. */
export const stripDisabledFormats = (
	slice: Slice,
	schema: Schema,
	gate: ComposerFormatGate
): Slice => {
	const content = stripFragment(slice.content, schema, gate);
	if (content.eq(slice.content)) {
		return slice;
	}
	// Removing a wrapper changes the depth the slice was open to.
	return content.childCount === slice.content.childCount &&
		slice.openStart <= 1 &&
		slice.openEnd <= 1
		? new Slice(content, slice.openStart, slice.openEnd)
		: Slice.maxOpen(content);
};

const composerFormatGatePluginKey = new PluginKey('composerFormatGate');

export const createComposerFormatGateExtension = (gate: ComposerFormatGate) =>
	Extension.create({
		name: 'composerFormatGate',
		// Ahead of CodeBlock's own paste plugin, see `handlePaste` below.
		priority: 1000,
		addProseMirrorPlugins() {
			return [
				new Plugin({
					key: composerFormatGatePluginKey,
					props: {
						// CodeBlock turns anything copied from VS Code into a code
						// block by itself, without going through `transformPasted`.
						handlePaste: (view, event) => {
							if (
								gate.isEnabled('codeBlock') ||
								!event.clipboardData?.getData(
									'vscode-editor-data'
								)
							) {
								return false;
							}
							view.pasteText(
								event.clipboardData.getData('text/plain')
							);
							return true;
						},
						transformPasted: (slice, view) =>
							stripDisabledFormats(slice, view.state.schema, gate)
					}
				})
			];
		}
	});

/** The toolbar and imperative actions that create a format. */
export const FORMAT_OF_ACTION: Record<string, ChatComposerFormat> = {
	heading1: 'heading',
	heading2: 'heading',
	heading3: 'heading',
	heading4: 'heading',
	bulletList: 'bulletList',
	orderedList: 'orderedList',
	taskList: 'taskList',
	blockquote: 'blockquote',
	codeBlock: 'codeBlock',
	bold: 'bold',
	italic: 'italic',
	strike: 'strike',
	code: 'code',
	underline: 'underline',
	highlight: 'highlight',
	highlightYellow: 'highlight',
	highlightOrange: 'highlight',
	highlightRose: 'highlight',
	highlightMint: 'highlight',
	highlightBlue: 'highlight',
	setLink: 'link',
	superscript: 'superscript',
	subscript: 'subscript',
	insertImageMarker: 'image',
	insertDateTime: 'dateTime'
};
