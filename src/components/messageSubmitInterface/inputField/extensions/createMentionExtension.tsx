import { ReactRenderer } from '@tiptap/react';
import Mention from '@tiptap/extension-mention';
import type { SuggestionOptions } from '@tiptap/suggestion';
import { computePosition, flip, offset, shift } from '@floating-ui/dom';
import {
	MentionDirectoryState,
	MentionList,
	MentionListRef
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

			const statusProps = () => ({
				directoryState: provider.getDirectoryState?.() ?? 'ready',
				emptyLabel: provider.emptyLabel,
				unavailableLabel: provider.unavailableLabel,
				loadingLabel: provider.loadingLabel
			});

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
					reposition(props.clientRect ?? null);
				},
				onUpdate: (props) => {
					component?.updateProps({
						items: props.items,
						command: props.command,
						notInChatLabel: provider.notInChatLabel,
						...statusProps()
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
