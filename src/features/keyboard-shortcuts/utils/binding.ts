import type { Platform, ShortcutBinding } from '../types';
import { getPrimaryModifier } from './platform';

const normalizeKeyName = (key: string): string => {
	if (!key) {
		return '';
	}
	if (key === ' ') {
		return 'Space';
	}
	if (key.length === 1) {
		return key.toUpperCase();
	}
	// Enter, Escape, ArrowUp, etc.
	return key.length === 1 ? key.toUpperCase() : key;
};

export const normalizeBindingKey = (key: string): string =>
	normalizeKeyName(key);

/**
 * Expand primaryModifier into concrete ctrl/meta for the given platform.
 * Does not mutate the original binding.
 */
export const normalizeBinding = (
	binding: ShortcutBinding,
	platform: Platform
): ShortcutBinding => {
	const key = normalizeBindingKey(binding.key);
	const result: ShortcutBinding = {
		key,
		shift: !!binding.shift,
		alt: !!binding.alt,
		ctrl: !!binding.ctrl,
		meta: !!binding.meta
	};

	if (binding.primaryModifier) {
		const primary = getPrimaryModifier(platform);
		if (primary === 'meta') {
			result.meta = true;
		} else {
			result.ctrl = true;
		}
	}

	return result;
};

/** Stable identity for conflict detection (platform-normalized). */
export const bindingIdentity = (
	binding: ShortcutBinding | null | undefined,
	platform: Platform
): string | null => {
	if (!binding || !binding.key) {
		return null;
	}
	const n = normalizeBinding(binding, platform);
	return [
		n.key,
		n.ctrl ? 'c' : '',
		n.meta ? 'm' : '',
		n.shift ? 's' : '',
		n.alt ? 'a' : ''
	].join('+');
};

export const bindingsEqual = (
	a: ShortcutBinding | null | undefined,
	b: ShortcutBinding | null | undefined,
	platform: Platform
): boolean => {
	const ia = bindingIdentity(a, platform);
	const ib = bindingIdentity(b, platform);
	if (ia === null || ib === null) {
		return false;
	}
	return ia === ib;
};

export const isMalformedBinding = (value: unknown): boolean => {
	if (!value || typeof value !== 'object') {
		return true;
	}
	const b = value as Record<string, unknown>;
	if (typeof b.key !== 'string' || !b.key.trim()) {
		return true;
	}
	for (const flag of [
		'primaryModifier',
		'ctrl',
		'meta',
		'shift',
		'alt'
	] as const) {
		if (flag in b && typeof b[flag] !== 'boolean') {
			return true;
		}
	}
	return false;
};

export const parseBinding = (value: unknown): ShortcutBinding | null => {
	if (value === null) {
		return null;
	}
	if (isMalformedBinding(value)) {
		return null;
	}
	const b = value as ShortcutBinding;
	return {
		key: normalizeBindingKey(b.key),
		...(b.primaryModifier ? { primaryModifier: true } : {}),
		...(b.ctrl ? { ctrl: true } : {}),
		...(b.meta ? { meta: true } : {}),
		...(b.shift ? { shift: true } : {}),
		...(b.alt ? { alt: true } : {})
	};
};
