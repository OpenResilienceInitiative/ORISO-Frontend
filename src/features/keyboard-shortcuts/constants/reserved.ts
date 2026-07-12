import type { Platform, ShortcutBinding } from '../types';
import { bindingIdentity, normalizeBinding } from '../utils/binding';

/**
 * Hard-blocked browser / OS shortcuts (never assignable).
 * Represented with primaryModifier where Ctrl/Cmd is interchangeable.
 * L/N/U/F/K are intentionally allowed as options with warnings (see RISKY).
 */
export const RESERVED_BINDINGS: ShortcutBinding[] = [
	{ key: 'W', primaryModifier: true },
	{ key: 'T', primaryModifier: true },
	{ key: 'R', primaryModifier: true },
	{ key: 'Tab', ctrl: true },
	{ key: 'Tab', ctrl: true, shift: true },
	{ key: 'F4', alt: true },
	{ key: 'Q', meta: true }
];

/**
 * Risky browser shortcuts — allowed when listed in an action’s supportedBindings,
 * but Settings should surface a warning.
 */
export const RISKY_BROWSER_BINDINGS: ShortcutBinding[] = [
	{ key: 'F', primaryModifier: true },
	{ key: 'K', primaryModifier: true },
	{ key: 'P', primaryModifier: true },
	{ key: 'S', primaryModifier: true },
	{ key: 'L', primaryModifier: true },
	{ key: 'N', primaryModifier: true },
	{ key: 'U', primaryModifier: true }
];

export const isReservedBinding = (
	binding: ShortcutBinding,
	platform: Platform
): boolean => {
	const id = bindingIdentity(binding, platform);
	if (!id) {
		return false;
	}
	return RESERVED_BINDINGS.some(
		(reserved) => bindingIdentity(reserved, platform) === id
	);
};

export const isRiskyBrowserBinding = (
	binding: ShortcutBinding,
	platform: Platform
): boolean => {
	const id = bindingIdentity(binding, platform);
	if (!id) {
		return false;
	}
	return RISKY_BROWSER_BINDINGS.some(
		(risky) => bindingIdentity(risky, platform) === id
	);
};

/** Plain letter/symbol with no modifiers — unsafe while typing in inputs. */
export const isUnsafePlainKeyBinding = (binding: ShortcutBinding): boolean => {
	const n = normalizeBinding(binding, 'linux');
	const hasModifier = !!(n.ctrl || n.meta || n.alt);
	if (hasModifier) {
		return false;
	}
	// Shift+Enter is a known newline combo, not a plain typing key.
	if (n.shift && n.key === 'Enter') {
		return false;
	}
	if (n.key === 'Enter' || n.key === 'Escape' || n.key === 'Tab') {
		return false;
	}
	// ArrowUp used for edit-last is intentional when composer empty (runtime guard).
	if (n.key === 'ArrowUp' || n.key === 'F1' || n.key === 'F2') {
		return false;
	}
	// Single printable / navigation keys without modifiers
	if (
		n.key.length === 1 ||
		n.key.startsWith('Arrow') ||
		n.key === 'Backspace' ||
		n.key === 'Delete'
	) {
		return !n.shift; // bare key
	}
	if (['/', ':', '?'].includes(n.key)) {
		return true;
	}
	return false;
};
