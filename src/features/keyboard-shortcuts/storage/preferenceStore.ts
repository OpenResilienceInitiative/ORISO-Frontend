import type {
	KeyboardShortcutPreferencesV1,
	ShortcutActionId,
	ShortcutBinding
} from '../types';
import {
	getImplementedShortcuts,
	isSupportedBinding
} from '../constants/registry';
import {
	ACTION_BINDING_OPTIONS,
	SEND_BINDING_OPTIONS
} from '../constants/sendOptions';
import { parseBinding } from '../utils/binding';
import {
	deriveNewlineBinding,
	resolveNewlineBinding
} from '../utils/deriveNewline';
import { getPlatform } from '../utils/platform';

export const KEYBOARD_SHORTCUTS_STORAGE_KEY = 'oriso.keyboardShortcuts.v1';

type StoredBlobV1 = {
	version: 1;
	/** Per-user preference maps; `__anonymous__` when signed out. */
	byUser: Record<string, KeyboardShortcutPreferencesV1['bindings']>;
};

const ANONYMOUS_USER = '__anonymous__';

const safeGetStorage = (): Storage | null => {
	if (typeof window === 'undefined') {
		return null;
	}
	try {
		return window.localStorage;
	} catch {
		return null;
	}
};

export const createDefaultPreferences = (): KeyboardShortcutPreferencesV1 => {
	const bindings: KeyboardShortcutPreferencesV1['bindings'] = {};
	for (const def of getImplementedShortcuts()) {
		if (def.id === 'chat.insertNewLine') {
			continue;
		}
		bindings[def.id] = def.defaultBinding
			? { ...def.defaultBinding }
			: null;
	}
	const platform = getPlatform();
	const send = bindings['chat.sendMessage'] ?? null;
	bindings['chat.insertNewLine'] = deriveNewlineBinding(send, platform);
	return { version: 1, bindings };
};

const emptyBlob = (): StoredBlobV1 => ({
	version: 1,
	byUser: {}
});

const parseBlob = (raw: string | null): StoredBlobV1 => {
	if (!raw) {
		return emptyBlob();
	}
	try {
		const parsed = JSON.parse(raw) as unknown;
		if (
			!parsed ||
			typeof parsed !== 'object' ||
			(parsed as StoredBlobV1).version !== 1
		) {
			return emptyBlob();
		}
		const byUser = (parsed as StoredBlobV1).byUser;
		if (!byUser || typeof byUser !== 'object' || Array.isArray(byUser)) {
			return emptyBlob();
		}
		const safeByUser: StoredBlobV1['byUser'] = {};
		for (const [key, value] of Object.entries(byUser)) {
			if (
				key === '__proto__' ||
				key === 'constructor' ||
				key === 'prototype'
			) {
				continue;
			}
			safeByUser[key] =
				value as KeyboardShortcutPreferencesV1['bindings'];
		}
		return { version: 1, byUser: safeByUser };
	} catch {
		return emptyBlob();
	}
};

const sanitizeBindings = (
	input: unknown
): KeyboardShortcutPreferencesV1['bindings'] => {
	const result: KeyboardShortcutPreferencesV1['bindings'] = {};
	if (!input || typeof input !== 'object' || Array.isArray(input)) {
		return result;
	}
	const implemented = getImplementedShortcuts();
	const implementedIds = new Set(implemented.map((d) => d.id));
	const platform = getPlatform();

	for (const [key, value] of Object.entries(
		input as Record<string, unknown>
	)) {
		if (!implementedIds.has(key as ShortcutActionId)) {
			continue;
		}
		const actionId = key as ShortcutActionId;
		if (value === null) {
			result[actionId] = null;
			continue;
		}
		const binding = parseBinding(value);
		if (!binding) {
			continue;
		}
		const def = implemented.find((d) => d.id === actionId);
		if (!def) {
			continue;
		}
		if (
			actionId === 'chat.insertNewLine' ||
			isSupportedBinding(def, binding, platform)
		) {
			result[actionId] = binding;
		}
	}
	return result;
};

const userKey = (userId?: string | null): string =>
	userId && String(userId).trim() ? String(userId) : ANONYMOUS_USER;

export const loadShortcutPreferences = (
	userId?: string | null
): KeyboardShortcutPreferencesV1 => {
	const defaults = createDefaultPreferences();
	const storage = safeGetStorage();
	if (!storage) {
		return defaults;
	}
	const blob = parseBlob(storage.getItem(KEYBOARD_SHORTCUTS_STORAGE_KEY));
	const stored = sanitizeBindings(blob.byUser[userKey(userId)]);
	const merged: KeyboardShortcutPreferencesV1 = {
		version: 1,
		bindings: { ...defaults.bindings, ...stored }
	};
	const platform = getPlatform();
	const send =
		merged.bindings['chat.sendMessage'] ??
		defaults.bindings['chat.sendMessage'] ??
		null;
	merged.bindings['chat.insertNewLine'] = resolveNewlineBinding(
		send,
		merged.bindings['chat.insertNewLine'],
		platform
	);
	return merged;
};

export const saveShortcutPreferences = (
	preferences: KeyboardShortcutPreferencesV1,
	userId?: string | null
): void => {
	const storage = safeGetStorage();
	if (!storage) {
		return;
	}
	const blob = parseBlob(storage.getItem(KEYBOARD_SHORTCUTS_STORAGE_KEY));
	const platform = getPlatform();
	const send = preferences.bindings['chat.sendMessage'] ?? null;
	const toStore: KeyboardShortcutPreferencesV1['bindings'] = {
		...preferences.bindings,
		'chat.insertNewLine': resolveNewlineBinding(
			send,
			preferences.bindings['chat.insertNewLine'],
			platform
		)
	};
	blob.byUser[userKey(userId)] = sanitizeBindings(toStore);
	try {
		storage.setItem(KEYBOARD_SHORTCUTS_STORAGE_KEY, JSON.stringify(blob));
	} catch {
		// Quota / private mode — ignore
	}
};

export const clearShortcutPreferences = (userId?: string | null): void => {
	const storage = safeGetStorage();
	if (!storage) {
		return;
	}
	const blob = parseBlob(storage.getItem(KEYBOARD_SHORTCUTS_STORAGE_KEY));
	delete blob.byUser[userKey(userId)];
	try {
		storage.setItem(KEYBOARD_SHORTCUTS_STORAGE_KEY, JSON.stringify(blob));
	} catch {
		// ignore
	}
};

export const bindingToOptionValue = (binding: ShortcutBinding): string => {
	const parts = [
		binding.key,
		binding.primaryModifier ? 'primary' : '',
		binding.ctrl ? 'ctrl' : '',
		binding.meta ? 'meta' : '',
		binding.shift ? 'shift' : '',
		binding.alt ? 'alt' : ''
	];
	return parts.filter(Boolean).join('|');
};

export const optionValueToSendBinding = (
	value: string
): ShortcutBinding | null => optionValueToBinding(value, SEND_BINDING_OPTIONS);

export const optionValueToBinding = (
	value: string,
	options: ShortcutBinding[]
): ShortcutBinding | null => {
	for (const option of options) {
		if (bindingToOptionValue(option) === value) {
			return { ...option };
		}
	}
	return null;
};

export const ALL_SELECTABLE_BINDINGS: ShortcutBinding[] = Array.from(
	new Map(
		Object.values(ACTION_BINDING_OPTIONS)
			.flat()
			.map((binding) => [JSON.stringify(binding), binding] as const)
	).values()
);

export const optionValueToAnyKnownBinding = (
	value: string
): ShortcutBinding | null =>
	optionValueToBinding(value, ALL_SELECTABLE_BINDINGS);
