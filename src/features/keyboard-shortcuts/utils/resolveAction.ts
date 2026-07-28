import type {
	KeyboardShortcutPreferencesV1,
	Platform,
	ShortcutActionId,
	ShortcutBinding,
	ShortcutScope
} from '../types';
import {
	getImplementedShortcuts,
	getShortcutDefinition
} from '../constants/registry';
import { resolveNewlineBinding } from './deriveNewline';
import {
	isImeComposing,
	matchesShortcut,
	type MatchableKeyboardEvent
} from './match';

export const resolveEffectiveBinding = (
	preferences: KeyboardShortcutPreferencesV1,
	actionId: ShortcutActionId,
	platform: Platform
): ShortcutBinding | null => {
	const def = getShortcutDefinition(actionId);
	if (!def) {
		return null;
	}
	if (actionId === 'chat.insertNewLine') {
		const send =
			preferences.bindings['chat.sendMessage'] ??
			getShortcutDefinition('chat.sendMessage')?.defaultBinding ??
			null;
		return resolveNewlineBinding(
			send,
			preferences.bindings['chat.insertNewLine'],
			platform
		);
	}
	const stored = preferences.bindings[actionId];
	if (stored === undefined) {
		return def.defaultBinding;
	}
	return stored;
};

export type ResolveActionOptions = {
	/** Limit matching to these scopes (default: all implemented). */
	scopes?: ShortcutScope[];
	/** Skip when IME composing / modal / suggestions. */
	disabled?: boolean;
	isSending?: boolean;
	hasOpenSuggestions?: boolean;
	/** Skip actions that should not fire inside text inputs. */
	inTextInput?: boolean;
	/** Action ids to skip (e.g. send handled elsewhere). */
	exclude?: ShortcutActionId[];
};

const isEditableTarget = (target: EventTarget | null | undefined): boolean => {
	if (!(target instanceof HTMLElement)) {
		return false;
	}
	const tag = target.tagName;
	if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
		return true;
	}
	return target.isContentEditable;
};

export const hasOpenModalDialog = (): boolean => {
	if (typeof document === 'undefined') {
		return false;
	}
	// Prefer native <dialog open>. Also match explicit aria-modal dialogs that
	// are not display:none / aria-hidden (avoids blocking on dormant overlays).
	if (document.querySelector('dialog[open]')) {
		return true;
	}
	const candidates = document.querySelectorAll(
		'[role="dialog"][aria-modal="true"]'
	);
	for (const el of Array.from(candidates)) {
		if (!(el instanceof HTMLElement)) {
			continue;
		}
		if (el.getAttribute('aria-hidden') === 'true') {
			continue;
		}
		const style = window.getComputedStyle(el);
		if (style.display === 'none' || style.visibility === 'hidden') {
			continue;
		}
		return true;
	}
	return false;
};

/**
 * Match a keyboard event against preference bindings for the given scopes.
 * Returns the first matching action id (registry order within scopes).
 */
export const resolveMatchedAction = (
	event: MatchableKeyboardEvent,
	preferences: KeyboardShortcutPreferencesV1,
	platform: Platform,
	options: ResolveActionOptions = {}
): ShortcutActionId | null => {
	if (event.defaultPrevented || isImeComposing(event)) {
		return null;
	}
	if (options.disabled || options.isSending) {
		return null;
	}
	if (options.hasOpenSuggestions) {
		return null;
	}

	const scopes = options.scopes;
	const exclude = new Set(options.exclude ?? []);
	const inTextInput = options.inTextInput ?? isEditableTarget(event.target);

	for (const def of getImplementedShortcuts()) {
		if (exclude.has(def.id)) {
			continue;
		}
		if (scopes && !scopes.includes(def.scope)) {
			continue;
		}
		if (inTextInput && !def.activeInTextInput) {
			// Still allow global help with modifiers / F1
			const binding = resolveEffectiveBinding(
				preferences,
				def.id,
				platform
			);
			const hasModifier =
				!!binding &&
				!!(
					binding.primaryModifier ||
					binding.ctrl ||
					binding.meta ||
					binding.alt ||
					binding.shift
				);
			if (
				def.scope !== 'global' ||
				(!hasModifier && binding?.key !== 'F1')
			) {
				continue;
			}
		}

		const binding = resolveEffectiveBinding(preferences, def.id, platform);
		if (!binding) {
			continue;
		}
		if (matchesShortcut(event, binding, platform)) {
			return def.id;
		}
	}
	return null;
};
