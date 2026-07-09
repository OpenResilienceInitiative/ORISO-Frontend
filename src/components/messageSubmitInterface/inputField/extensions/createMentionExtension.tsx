import { ReactRenderer } from '@tiptap/react';
import Mention from '@tiptap/extension-mention';
import type { SuggestionOptions } from '@tiptap/suggestion';
import { computePosition, flip, offset, shift } from '@floating-ui/dom';
import { MentionList, MentionListRef } from './MentionList';
import { filterMentionCandidates, MentionCandidate } from './mentionFiltering';

export interface MentionProvider {
	/** Returns the agency consultants to offer for the given query. */
	getCandidates: (query: string) => MentionCandidate[];
	/** The author's id, excluded from the list. */
	selfId?: string;
	notInChatLabel: string;
}

/**
 * Configures the TipTap Mention extension with a Slack-like suggestion popup.
 * Candidates come from the injected provider (agency consultants + room
 * membership); the pill stores the consultant id + matrix id so the message
 * layer can serialize m.mentions.
 */
export const createMentionExtension = (provider: MentionProvider) => {
	const suggestion: Omit<SuggestionOptions, 'editor'> = {
		char: '@',
		items: ({ query }) =>
			filterMentionCandidates(
				provider.getCandidates(query),
				query,
				provider.selfId
			).slice(0, 8),
		render: () => {
			let component: ReactRenderer<MentionListRef> | null = null;
			let popup: HTMLDivElement | null = null;

			const reposition = (clientRect: (() => DOMRect | null) | null) => {
				if (!popup || !clientRect) {
					return;
				}
				const rect = clientRect();
				if (!rect) {
					return;
				}
				const virtualEl = {
					getBoundingClientRect: () => rect
				};
				computePosition(virtualEl as any, popup, {
					placement: 'top-start',
					middleware: [offset(8), flip(), shift({ padding: 8 })]
				}).then(({ x, y }) => {
					if (popup) {
						popup.style.left = `${x}px`;
						popup.style.top = `${y}px`;
					}
				});
			};

			return {
				onStart: (props) => {
					component = new ReactRenderer(MentionList, {
						props: {
							items: props.items,
							command: props.command,
							notInChatLabel: provider.notInChatLabel
						},
						editor: props.editor
					});
					popup = document.createElement('div');
					popup.className = 'mentionList__popup';
					popup.style.position = 'absolute';
					popup.style.zIndex = '80';
					popup.appendChild(component.element);
					document.body.appendChild(popup);
					reposition(props.clientRect ?? null);
				},
				onUpdate: (props) => {
					component?.updateProps({
						items: props.items,
						command: props.command,
						notInChatLabel: provider.notInChatLabel
					});
					reposition(props.clientRect ?? null);
				},
				onKeyDown: (props) => {
					if (props.event.key === 'Escape') {
						return true;
					}
					return component?.ref?.onKeyDown(props.event) ?? false;
				},
				onExit: () => {
					popup?.remove();
					popup = null;
					component?.destroy();
					component = null;
				}
			};
		}
	};

	return Mention.configure({
		HTMLAttributes: { class: 'messageItem__mention' },
		renderHTML({ options, node }) {
			return [
				'span',
				{
					'class': 'messageItem__mention',
					'data-mention-id': node.attrs.id,
					'data-mention-username': node.attrs.label ?? node.attrs.id
				},
				`@${node.attrs.label ?? node.attrs.id}`
			];
		},
		suggestion
	});
};
