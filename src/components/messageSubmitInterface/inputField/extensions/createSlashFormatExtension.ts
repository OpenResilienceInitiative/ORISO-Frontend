import { Extension } from '@tiptap/core';
import { ReactRenderer } from '@tiptap/react';
import { PluginKey } from '@tiptap/pm/state';
import { Suggestion, type SuggestionProps } from '@tiptap/suggestion';
import { composerSuggestionPosition } from './composerSuggestionPosition';
import {
	SlashFormatList,
	type SlashFormatListRef
} from '../ComposerFormatMenus';
import {
	applyQuickComposerFormat,
	quickComposerFormats,
	type QuickComposerFormat
} from './quickComposerFormats';
import type { ComposerFormatGate } from './composerFormatGate';

type Option = (typeof quickComposerFormats)[number];
type Labels = {
	locale: 'de' | 'en';
	label: string;
	getLabel: (id: QuickComposerFormat) => string;
};

export const slashFormatSuggestionKey = new PluginKey('slashFormatSuggestion');

export const createSlashFormatExtension = (
	gate: ComposerFormatGate,
	getLabels: () => Labels
) =>
	Extension.create({
		name: 'slashFormats',
		// Consume Enter before StarterKit can insert a newline.
		priority: 101,
		addProseMirrorPlugins() {
			const getItems = (query: string) => {
				const { getLabel } = getLabels();
				const search = query.toLowerCase();
				return quickComposerFormats.filter(
					(format) =>
						gate.isEnabled(format.id) &&
						[
							format.de,
							format.en,
							getLabel(format.id).toLowerCase()
						].some((label) => label.startsWith(search))
				);
			};
			return [
				Suggestion<Option, Option>({
					editor: this.editor,
					pluginKey: slashFormatSuggestionKey,
					char: '/',
					startOfLine: true,
					allow: ({ editor, state, range }) => {
						const start = state.doc.resolve(range.from);
						return (
							editor.isFocused &&
							start.parent.type.name === 'paragraph' &&
							start.parentOffset === 0
						);
					},
					shouldShow: ({ query }) => getItems(query).length > 0,
					items: ({ query }) => getItems(query),
					command: ({ editor, range, props }) =>
						applyQuickComposerFormat(editor, gate, props.id, range),
					...composerSuggestionPosition,
					render: () => {
						let list: ReactRenderer<SlashFormatListRef> | undefined;
						let unmount: (() => void) | undefined;
						const listProps = (
							props: SuggestionProps<Option, Option>
						) => ({
							editor: props.editor,
							items: props.items,
							command: props.command,
							...getLabels()
						});
						return {
							onStart: (props) => {
								list = new ReactRenderer(SlashFormatList, {
									editor: props.editor,
									props: listProps(props),
									className:
										'composerFormatMenu composerFormatMenu--slash'
								});
								unmount = props.mount(
									list.element as HTMLElement
								);
							},
							onUpdate: (props) =>
								list?.updateProps(listProps(props)),
							onKeyDown: ({ event }) =>
								list?.ref?.onKeyDown(event) ??
								event.key === 'Enter',
							onExit: () => {
								unmount?.();
								list?.destroy();
								list = undefined;
								unmount = undefined;
							}
						};
					}
				})
			];
		}
	});
