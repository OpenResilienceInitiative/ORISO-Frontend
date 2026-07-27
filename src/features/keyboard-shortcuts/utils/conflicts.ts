import type {
	KeyboardShortcutPreferencesV1,
	Platform,
	ShortcutActionId,
	ShortcutBinding,
	ShortcutConflict
} from '../types';
import {
	getImplementedShortcuts,
	getShortcutDefinition
} from '../constants/registry';
import {
	isReservedBinding,
	isRiskyBrowserBinding,
	isUnsafePlainKeyBinding
} from '../constants/reserved';
import { bindingIdentity, bindingsEqual } from './binding';
import { resolveNewlineBinding } from './deriveNewline';

const scopesOverlap = (
	a: 'composer' | 'chat' | 'global',
	b: 'composer' | 'chat' | 'global'
): boolean => {
	if (a === b) {
		return true;
	}
	// Global overlaps everything; chat overlaps composer
	if (a === 'global' || b === 'global') {
		return true;
	}
	if (
		(a === 'chat' && b === 'composer') ||
		(a === 'composer' && b === 'chat')
	) {
		return true;
	}
	return false;
};

export const validateShortcutPreferences = (
	preferences: KeyboardShortcutPreferencesV1,
	platform: Platform
): ShortcutConflict[] => {
	const conflicts: ShortcutConflict[] = [];
	const implemented = getImplementedShortcuts();

	const effective = new Map<ShortcutActionId, ShortcutBinding | null>();

	for (const def of implemented) {
		const stored = preferences.bindings[def.id];
		if (stored === undefined) {
			effective.set(def.id, def.defaultBinding);
		} else if (stored === null) {
			if (!def.canDisable) {
				conflicts.push({
					actionId: def.id,
					type: 'unsupported',
					messageTranslationKey: 'shortcuts.conflicts.cannotDisable'
				});
				effective.set(def.id, def.defaultBinding);
			} else {
				effective.set(def.id, null);
			}
		} else {
			const supported = def.supportedBindings.some((b) =>
				bindingsEqual(b, stored, platform)
			);
			if (!supported) {
				conflicts.push({
					actionId: def.id,
					type: 'unsupported',
					messageTranslationKey: 'shortcuts.conflicts.unsupported'
				});
				effective.set(def.id, def.defaultBinding);
			} else {
				effective.set(def.id, stored);
			}
		}
	}

	// Resolve newline (locked when Enter-to-send; else allow stored)
	const send = effective.get('chat.sendMessage') ?? null;
	const storedNewline = preferences.bindings['chat.insertNewLine'];
	effective.set(
		'chat.insertNewLine',
		resolveNewlineBinding(send, storedNewline, platform)
	);

	for (const [actionId, binding] of effective) {
		if (!binding) {
			continue;
		}
		if (isReservedBinding(binding, platform)) {
			conflicts.push({
				actionId,
				type: 'reserved',
				messageTranslationKey: 'shortcuts.conflicts.reserved'
			});
		}
		// Risky browser shortcuts only block when not an intentional allowlisted option
		const def = getShortcutDefinition(actionId);
		const intentionallyAllowed =
			!!def &&
			def.supportedBindings.some((b) =>
				bindingsEqual(b, binding, platform)
			);
		if (isRiskyBrowserBinding(binding, platform) && !intentionallyAllowed) {
			conflicts.push({
				actionId,
				type: 'reserved',
				messageTranslationKey: 'shortcuts.conflicts.browserConflict'
			});
		}
		if (
			def &&
			def.activeInTextInput &&
			isUnsafePlainKeyBinding(binding) &&
			!intentionallyAllowed
		) {
			conflicts.push({
				actionId,
				type: 'unsafe-plain-key',
				messageTranslationKey: 'shortcuts.conflicts.unsafePlainKey'
			});
		}
	}

	const sendBinding = effective.get('chat.sendMessage');
	const newlineBinding = effective.get('chat.insertNewLine');
	if (
		sendBinding &&
		newlineBinding &&
		bindingsEqual(sendBinding, newlineBinding, platform)
	) {
		conflicts.push({
			actionId: 'chat.sendMessage',
			conflictingActionId: 'chat.insertNewLine',
			type: 'send-newline',
			messageTranslationKey: 'shortcuts.conflicts.sendNewline'
		});
	}

	const seen = new Map<string, ShortcutActionId>();
	for (const [actionId, binding] of effective) {
		if (!binding) {
			continue;
		}
		const def = getShortcutDefinition(actionId);
		if (!def) {
			continue;
		}
		const id = bindingIdentity(binding, platform);
		if (!id) {
			continue;
		}
		const previous = seen.get(id);
		if (previous) {
			const prevDef = getShortcutDefinition(previous);
			if (prevDef && scopesOverlap(prevDef.scope, def.scope)) {
				conflicts.push({
					actionId,
					conflictingActionId: previous,
					type: 'duplicate',
					messageTranslationKey: 'shortcuts.conflicts.duplicate'
				});
			}
		} else {
			seen.set(id, actionId);
		}
	}

	return conflicts;
};

export const hasBlockingConflicts = (conflicts: ShortcutConflict[]): boolean =>
	conflicts.length > 0;

/**
 * Non-blocking warnings for intentionally-allowed risky browser shortcuts.
 * Callers should surface these in Settings (aria-live) without rejecting the binding.
 */
export const getBindingWarnings = (
	actionId: ShortcutActionId,
	binding: ShortcutBinding | null,
	platform: Platform
): ShortcutConflict[] => {
	if (!binding) {
		return [];
	}
	if (!isRiskyBrowserBinding(binding, platform)) {
		return [];
	}
	const def = getShortcutDefinition(actionId);
	const intentionallyAllowed =
		!!def &&
		def.supportedBindings.some((b) => bindingsEqual(b, binding, platform));
	if (!intentionallyAllowed) {
		return [];
	}
	return [
		{
			actionId,
			type: 'reserved',
			messageTranslationKey: 'shortcuts.conflicts.browserConflict'
		}
	];
};
