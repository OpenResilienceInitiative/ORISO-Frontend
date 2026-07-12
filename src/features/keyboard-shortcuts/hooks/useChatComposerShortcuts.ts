import { useCallback } from 'react';
import { useKeyboardShortcuts } from '../context/KeyboardShortcutsProvider';
import {
	resolveComposerShortcutAction,
	type ResolveComposerOptions
} from '../utils/resolveComposerShortcut';
import { resolveMatchedAction } from '../utils/resolveAction';
import type { MatchableKeyboardEvent } from '../utils/match';
import type { ShortcutActionId } from '../types';

export type ComposerActionHandlers = {
	onSend: () => void;
	onEditLast?: () => boolean;
	onCancel?: () => boolean;
	onUpload?: () => boolean;
	onOpenEmoji?: () => boolean;
};

export type UseChatComposerShortcutsArgs = ResolveComposerOptions &
	ComposerActionHandlers & {
		/** When true, composer is empty (required for edit-last). */
		isComposerEmpty?: boolean;
	};

/**
 * Shared composer shortcut handler. Wire into TipTap editorProps.handleKeyDown.
 * Returns true when the event was handled (caller should preventDefault).
 */
export const useChatComposerShortcuts = ({
	onSend,
	onEditLast,
	onCancel,
	onUpload,
	onOpenEmoji,
	disabled,
	isSending,
	hasOpenSuggestions,
	isComposerEmpty
}: UseChatComposerShortcutsArgs) => {
	const { preferences, platform } = useKeyboardShortcuts();

	const handleComposerKeyDown = useCallback(
		(event: MatchableKeyboardEvent): boolean => {
			const sendOrNewline = resolveComposerShortcutAction(
				event,
				preferences,
				platform,
				{ disabled, isSending, hasOpenSuggestions }
			);
			if (sendOrNewline === 'send') {
				event.preventDefault?.();
				onSend();
				return true;
			}
			if (sendOrNewline === 'newline') {
				return false;
			}

			const action = resolveMatchedAction(event, preferences, platform, {
				scopes: ['composer'],
				disabled,
				isSending,
				hasOpenSuggestions,
				inTextInput: true,
				exclude: ['chat.sendMessage', 'chat.insertNewLine']
			});

			if (!action) {
				return false;
			}

			const handled = dispatchComposerAction(action, {
				onEditLast,
				onCancel,
				onUpload,
				onOpenEmoji,
				isComposerEmpty,
				hasOpenSuggestions
			});
			if (handled) {
				event.preventDefault?.();
			}
			return handled;
		},
		[
			preferences,
			platform,
			disabled,
			isSending,
			hasOpenSuggestions,
			isComposerEmpty,
			onSend,
			onEditLast,
			onCancel,
			onUpload,
			onOpenEmoji
		]
	);

	return { handleComposerKeyDown, preferences, platform };
};

export const dispatchComposerAction = (
	action: ShortcutActionId,
	opts: {
		onEditLast?: () => boolean;
		onCancel?: () => boolean;
		onUpload?: () => boolean;
		onOpenEmoji?: () => boolean;
		isComposerEmpty?: boolean;
		hasOpenSuggestions?: boolean;
	}
): boolean => {
	switch (action) {
		case 'chat.cancelReplyOrEdit':
			return opts.onCancel?.() ?? false;
		case 'chat.editLastMessage':
			if (opts.hasOpenSuggestions || opts.isComposerEmpty === false) {
				return false;
			}
			return opts.onEditLast?.() ?? false;
		case 'chat.uploadFile':
			return opts.onUpload?.() ?? false;
		case 'chat.openEmojiPicker':
			return opts.onOpenEmoji?.() ?? false;
		default:
			return false;
	}
};
