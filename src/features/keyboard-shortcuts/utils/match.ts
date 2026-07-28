import type { Platform, ShortcutBinding } from '../types';
import { normalizeBinding, normalizeBindingKey } from './binding';
import { isPrimaryModifierPressed } from './platform';

export type MatchableKeyboardEvent = Pick<
	KeyboardEvent,
	| 'key'
	| 'ctrlKey'
	| 'metaKey'
	| 'shiftKey'
	| 'altKey'
	| 'isComposing'
	| 'defaultPrevented'
> & {
	keyCode?: number;
	target?: EventTarget | null;
	preventDefault?: () => void;
};

export const isImeComposing = (event: MatchableKeyboardEvent): boolean =>
	!!event.isComposing || event.keyCode === 229;

/**
 * Exact modifier match against a structured binding (platform-aware).
 */
export const matchesShortcut = (
	event: MatchableKeyboardEvent,
	binding: ShortcutBinding | null | undefined,
	platform: Platform
): boolean => {
	if (!binding || !binding.key) {
		return false;
	}
	if (event.defaultPrevented) {
		return false;
	}
	if (isImeComposing(event)) {
		return false;
	}

	const expected = normalizeBinding(binding, platform);
	const eventKey = normalizeBindingKey(event.key);
	if (eventKey !== expected.key) {
		return false;
	}

	const wantCtrl = !!expected.ctrl;
	const wantMeta = !!expected.meta;
	const wantShift = !!expected.shift;
	const wantAlt = !!expected.alt;

	// `?` is typed with Shift on most layouts — accept either shift state.
	const ignoreShift = expected.key === '?' || expected.key === 'F1';

	// When binding uses primaryModifier, require the platform primary only
	// and reject the opposite modifier (avoids Ctrl+Cmd+Enter duplicates).
	if (binding.primaryModifier) {
		if (!isPrimaryModifierPressed(event, platform)) {
			return false;
		}
		if (platform === 'mac' && event.ctrlKey) {
			return false;
		}
		if (platform !== 'mac' && event.metaKey) {
			return false;
		}
	} else {
		if (event.ctrlKey !== wantCtrl) {
			return false;
		}
		if (event.metaKey !== wantMeta) {
			return false;
		}
	}

	if (!ignoreShift && event.shiftKey !== wantShift) {
		return false;
	}
	if (event.altKey !== wantAlt) {
		return false;
	}

	return true;
};
