import { useEffect, useRef } from 'react';
import { useKeyboardShortcuts } from '../context/KeyboardShortcutsProvider';
import { resolveEffectiveBinding } from '../utils/resolveComposerShortcut';
import { isImeComposing, matchesShortcut } from '../utils/match';

const isEditableTarget = (target: EventTarget | null): boolean => {
	if (!(target instanceof HTMLElement)) {
		return false;
	}
	const tag = target.tagName;
	if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
		return true;
	}
	return target.isContentEditable;
};

/**
 * Global listener for app.showShortcutHelp (toggle).
 * Plain keys like `?` do not fire while typing in inputs.
 */
export const useShortcutHelpHotkey = (enabled = true) => {
	const { preferences, platform, toggleHelp, isHelpOpen } =
		useKeyboardShortcuts();
	const toggleHelpRef = useRef(toggleHelp);
	toggleHelpRef.current = toggleHelp;

	useEffect(() => {
		if (!enabled) {
			return;
		}
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.defaultPrevented || isImeComposing(event)) {
				return;
			}
			const binding = resolveEffectiveBinding(
				preferences,
				'app.showShortcutHelp',
				platform
			);
			if (!binding || !matchesShortcut(event, binding, platform)) {
				return;
			}
			const hasModifier = !!(
				binding.primaryModifier ||
				binding.ctrl ||
				binding.meta ||
				binding.alt
			);
			if (
				!hasModifier &&
				binding.key !== 'F1' &&
				isEditableTarget(event.target)
			) {
				return;
			}
			// Allow toggle while our own help is open; block other modals.
			if (!isHelpOpen) {
				const dialog = document.querySelector(
					'[role="dialog"][aria-modal="true"]'
				);
				if (dialog) {
					return;
				}
			}
			event.preventDefault();
			toggleHelpRef.current();
		};
		window.addEventListener('keydown', onKeyDown);
		return () => window.removeEventListener('keydown', onKeyDown);
	}, [enabled, preferences, platform, isHelpOpen]);
};
