import type {
	ComposerShortcutAction,
	KeyboardShortcutPreferencesV1,
	Platform
} from '../types';
import { resolveEffectiveBinding } from './resolveAction';
import {
	isImeComposing,
	matchesShortcut,
	type MatchableKeyboardEvent
} from './match';

export { resolveEffectiveBinding } from './resolveAction';

export type ResolveComposerOptions = {
	disabled?: boolean;
	isSending?: boolean;
	/** Mention / emoji / autocomplete owns Enter */
	hasOpenSuggestions?: boolean;
};

/**
 * Resolve composer keyboard intent from preferences.
 * Does not call preventDefault — caller does when action is handled.
 */
export const resolveComposerShortcutAction = (
	event: MatchableKeyboardEvent,
	preferences: KeyboardShortcutPreferencesV1,
	platform: Platform,
	options: ResolveComposerOptions = {}
): ComposerShortcutAction | null => {
	if (event.defaultPrevented) {
		return null;
	}
	if (isImeComposing(event)) {
		return null;
	}
	if (options.disabled || options.isSending) {
		return null;
	}
	if (options.hasOpenSuggestions) {
		return null;
	}

	const sendBinding = resolveEffectiveBinding(
		preferences,
		'chat.sendMessage',
		platform
	);
	const newlineBinding = resolveEffectiveBinding(
		preferences,
		'chat.insertNewLine',
		platform
	);

	if (sendBinding && matchesShortcut(event, sendBinding, platform)) {
		return 'send';
	}

	// When Enter sends, Shift+Enter is newline even if TipTap would also
	// insert a hard break — we report newline so callers can skip send.
	if (newlineBinding && matchesShortcut(event, newlineBinding, platform)) {
		return 'newline';
	}

	// In primary/alt send modes, bare Shift+Enter should still be newline
	// (TipTap default) even though derived newline is plain Enter.
	if (
		sendBinding &&
		!matchesShortcut(event, sendBinding, platform) &&
		event.key === 'Enter' &&
		event.shiftKey &&
		!event.altKey &&
		!event.ctrlKey &&
		!event.metaKey
	) {
		return 'newline';
	}

	return null;
};
