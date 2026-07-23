import { useEffect, useRef } from 'react';
import { useKeyboardShortcuts } from '../context/KeyboardShortcutsProvider';
import {
	hasOpenModalDialog,
	resolveMatchedAction
} from '../utils/resolveAction';
import { isImeComposing } from '../utils/match';

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
 * Global shortcuts: help and command palette (toggle open/close).
 */
export const useGlobalShortcuts = (enabled = true) => {
	const {
		preferences,
		platform,
		toggleHelp,
		togglePalette,
		isHelpOpen,
		isPaletteOpen
	} = useKeyboardShortcuts();
	const toggleHelpRef = useRef(toggleHelp);
	const togglePaletteRef = useRef(togglePalette);
	toggleHelpRef.current = toggleHelp;
	togglePaletteRef.current = togglePalette;

	useEffect(() => {
		if (!enabled) {
			return;
		}
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.defaultPrevented || isImeComposing(event)) {
				return;
			}

			const action = resolveMatchedAction(event, preferences, platform, {
				scopes: ['global'],
				inTextInput: isEditableTarget(event.target)
			});

			// Always allow help / palette shortcuts to toggle even while open.
			if (action === 'app.showShortcutHelp') {
				event.preventDefault();
				toggleHelpRef.current();
				return;
			}
			if (action === 'app.openCommandPalette') {
				event.preventDefault();
				togglePaletteRef.current();
				return;
			}

			if (isHelpOpen || isPaletteOpen || hasOpenModalDialog()) {
				return;
			}
		};
		// Capture phase so we beat browser defaults (Cmd+K, etc.).
		window.addEventListener('keydown', onKeyDown, true);
		return () => window.removeEventListener('keydown', onKeyDown, true);
	}, [enabled, preferences, platform, isHelpOpen, isPaletteOpen]);
};
