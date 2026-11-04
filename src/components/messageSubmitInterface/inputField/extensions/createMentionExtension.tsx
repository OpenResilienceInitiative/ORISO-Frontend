import { Editor, Range, ReactRenderer } from '@tiptap/react';
import Mention from '@tiptap/extension-mention';
import { PluginKey } from '@tiptap/pm/state';
import { exitSuggestion, SuggestionOptions } from '@tiptap/suggestion';
import { computePosition, flip, offset, shift } from '@floating-ui/dom';
import {
	MentionDirectoryState,
	MentionList,
	MentionListRef,
	MentionPick
} from './MentionList';
import { filterMentionCandidates, MentionCandidate } from './mentionFiltering';

export interface MentionProvider {
	/** Returns the agency consultants to offer for the given query. */
	getCandidates: (query: string) => MentionCandidate[];
	/** The author's id, excluded from the list. */
	selfId?: string;
	notInChatLabel: string;
	/**
	 * Why the directory is the way it is, read live at popup time (#993).
	 * Without it an empty list is silent and a failed request is invisible.
	 */
	getDirectoryState?: () => MentionDirectoryState;
	emptyLabel?: string;
	unavailableLabel?: string;
	loadingLabel?: string;
	/** The popup's accessible name. */
	listLabel?: string;
	getCheckLabel?: (name: string) => string;
	getCheckedLabel?: (count: number) => string;
}

/**
 * Intentional mentions (#435): a resolved Matrix room-member id, stored as
 * `data-mention-matrix-id` alongside the default `id`/`label` attrs. Absent
 * for candidates the composer couldn't resolve to a real room member (a
 * consultant not yet in the chat) — `extractMentionedUserIds` then simply
 * has nothing to read for that pill, which is the correct, safe behavior
 * (never guess a Matrix id from a display name).
 */
const MentionWithMatrixId = Mention.extend({
	addAttributes() {
		return {
			...this.parent?.(),
			matrixUserId: {
				default: null,
				parseHTML: (element: HTMLElement) =>
					element.getAttribute('data-mention-matrix-id'),
				renderHTML: (attributes: { matrixUserId?: string | null }) =>
					attributes.matrixUserId
						? { 'data-mention-matrix-id': attributes.matrixUserId }
						: {}
			}
		};
	}
});

const toPills = (people: MentionPick[]) =>
	people.flatMap((person) => [
		{ type: 'mention', attrs: person },
		{ type: 'text', text: ' ' }
	]);

/** Replaces the typed `@…` with one pill per person, each followed by a space. */
const insertMentions = (
	editor: Editor,
	range: Range,
	people: MentionPick[]
) => {
	const nodeAfter = editor.view.state.selection.$to.nodeAfter;
	const to = nodeAfter?.text?.startsWith(' ') ? range.to + 1 : range.to;
	editor
		.chain()
		.focus()
		.insertContentAt({ from: range.from, to }, toPills(people))
		.run();
};

/**
 * The search ended by itself, for instance on the space in a full name. What
 * was typed may be the message, so it stays, and the people ticked so far go
 * in front of it with the caret left where it was.
 */
const insertMentionsBefore = (
	editor: Editor,
	from: number,
	people: MentionPick[]
) => {
	if (editor.isDestroyed || from > editor.state.doc.content.size) {
		return;
	}
	editor.commands.insertContentAt(from, toPills(people), {
		updateSelection: false
	});
};

/**
 * Configures the TipTap Mention extension with a Slack-like suggestion popup.
 * Candidates come from the injected provider (agency consultants + room
 * membership); the pill stores the consultant id + matrix id so the message
 * layer can serialize m.mentions.
 */
export const createMentionExtension = (provider: MentionProvider) => {
	// Mention would make up its own key, and exitSuggestion needs to know it.
	const pluginKey = new PluginKey('mentionSuggestion');
	const suggestion: Omit<SuggestionOptions, 'editor'> = {
		char: '@',
		pluginKey,
		items: ({ query }) =>
			filterMentionCandidates(
				provider.getCandidates(query),
				query,
				provider.selfId
			).slice(0, 8),
		render: () => {
			let component: ReactRenderer<MentionListRef> | null = null;
			let popup: HTMLDivElement | null = null;
			// Always the newest: the range grows with every typed character.
			let editor: Editor | null = null;
			let range: Range | null = null;
			// The person decided: what is ticked was inserted or thrown away.
			let isSettled = false;

			const statusProps = () => ({
				directoryState: provider.getDirectoryState?.() ?? 'ready',
				emptyLabel: provider.emptyLabel,
				unavailableLabel: provider.unavailableLabel,
				loadingLabel: provider.loadingLabel,
				listLabel: provider.listLabel,
				getCheckLabel: provider.getCheckLabel,
				getCheckedLabel: provider.getCheckedLabel
			});

			const close = () => {
				if (editor) {
					exitSuggestion(editor.view, pluginKey);
				}
			};

			const commandMany = (people: MentionPick[]) => {
				isSettled = true;
				if (editor && range) {
					insertMentions(editor, range, people);
				}
				close();
			};

			// Ticking clears the search, so the next name can be typed straight away.
			const clearQuery = () => {
				if (editor && range && range.to > range.from + 1) {
					editor
						.chain()
						.deleteRange({ from: range.from + 1, to: range.to })
						.run();
				}
			};

			// Only an active click beside the list ends it: this is what lets
			// somebody tick a second person.
			const onPointerDownOutside = (event: PointerEvent) => {
				if (popup?.contains(event.target as Node)) {
					return;
				}
				const people = component?.ref?.getChecked() ?? [];
				if (people.length) {
					commandMany(people);
				} else {
					close();
				}
			};

			const reposition = (clientRect: (() => DOMRect | null) | null) => {
				if (!popup || !clientRect) {
					return;
				}
				const rect = clientRect();
				if (!rect) {
					return;
				}
				const virtualEl = { getBoundingClientRect: () => rect };
				computePosition(virtualEl as any, popup, {
					placement: 'top-start',
					middleware: [offset(6), flip(), shift({ padding: 8 })]
				}).then(({ x, y, placement }) => {
					if (popup) {
						popup.style.left = `${x}px`;
						popup.style.top = `${y}px`;
						// The corner facing the @ goes square, like a speech bubble.
						popup.dataset.placement = placement;
					}
				});
			};

			return {
				onStart: (props) => {
					editor = props.editor;
					range = props.range;
					isSettled = false;
					component = new ReactRenderer(MentionList, {
						props: {
							items: props.items,
							command: (item: MentionPick) => {
								isSettled = true;
								props.command(item);
							},
							commandMany,
							onCheckedChange: clearQuery,
							notInChatLabel: provider.notInChatLabel,
							...statusProps()
						},
						editor: props.editor
					});
					popup = document.createElement('div');
					popup.className = 'mentionList__popup';
					popup.style.position = 'absolute';
					popup.style.zIndex = '80';
					popup.appendChild(component.element);
					document.body.appendChild(popup);
					document.addEventListener(
						'pointerdown',
						onPointerDownOutside,
						true
					);
					reposition(props.clientRect ?? null);
				},
				onUpdate: (props) => {
					range = props.range;
					component?.updateProps({
						items: props.items,
						command: (item: MentionPick) => {
							isSettled = true;
							props.command(item);
						},
						notInChatLabel: provider.notInChatLabel,
						...statusProps()
					});
					reposition(props.clientRect ?? null);
				},
				onKeyDown: (props) => {
					if (props.event.key === 'Escape') {
						// The plugin ends the suggestion itself after this.
						isSettled = true;
						return true;
					}
					return component?.ref?.onKeyDown(props.event) ?? false;
				},
				onExit: () => {
					const leftBehind = isSettled
						? []
						: (component?.ref?.getChecked() ?? []);
					if (leftBehind.length && editor && range) {
						const target = editor;
						const { from } = range;
						// Not inside the update that ended the suggestion.
						queueMicrotask(() =>
							insertMentionsBefore(target, from, leftBehind)
						);
					}
					document.removeEventListener(
						'pointerdown',
						onPointerDownOutside,
						true
					);
					popup?.remove();
					popup = null;
					component?.destroy();
					component = null;
				}
			};
		}
	};

	return MentionWithMatrixId.configure({
		HTMLAttributes: { class: 'messageItem__mention' },
		renderHTML({ options, node }) {
			return [
				'span',
				{
					'class': 'messageItem__mention',
					'data-mention-id': node.attrs.id,
					'data-mention-username': node.attrs.label ?? node.attrs.id,
					...(node.attrs.matrixUserId
						? { 'data-mention-matrix-id': node.attrs.matrixUserId }
						: {})
				},
				`@${node.attrs.label ?? node.attrs.id}`
			];
		},
		suggestion
	});
};
