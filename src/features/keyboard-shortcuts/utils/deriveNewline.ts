import type { Platform, ShortcutBinding } from '../types';
import {
	NEWLINE_BINDING_ENTER,
	NEWLINE_BINDING_OPTIONS,
	NEWLINE_BINDING_SHIFT_ENTER,
	SEND_BINDING_ENTER,
	SEND_BINDING_SHIFT_ENTER
} from '../constants/sendOptions';
import { bindingsEqual } from './binding';

/**
 * Default newline from send binding:
 * - Enter sends → Shift+Enter newline
 * - Shift+Enter sends → Enter newline
 * - otherwise → Enter newline
 */
export const deriveNewlineBinding = (
	sendBinding: ShortcutBinding | null | undefined,
	platform: Platform
): ShortcutBinding => {
	if (
		sendBinding &&
		bindingsEqual(sendBinding, SEND_BINDING_ENTER, platform)
	) {
		return { ...NEWLINE_BINDING_SHIFT_ENTER };
	}
	if (
		sendBinding &&
		bindingsEqual(sendBinding, SEND_BINDING_SHIFT_ENTER, platform)
	) {
		return { ...NEWLINE_BINDING_ENTER };
	}
	return { ...NEWLINE_BINDING_ENTER };
};

/** True when newline must follow send (Enter-to-send locks Shift+Enter). */
export const isNewlineLockedToSend = (
	sendBinding: ShortcutBinding | null | undefined,
	platform: Platform
): boolean =>
	!!(sendBinding && bindingsEqual(sendBinding, SEND_BINDING_ENTER, platform));

/**
 * Resolve effective newline: locked derivation, else stored if valid, else derived.
 */
export const resolveNewlineBinding = (
	sendBinding: ShortcutBinding | null | undefined,
	storedNewline: ShortcutBinding | null | undefined,
	platform: Platform
): ShortcutBinding => {
	const derived = deriveNewlineBinding(sendBinding, platform);
	if (isNewlineLockedToSend(sendBinding, platform)) {
		return derived;
	}
	if (
		storedNewline &&
		NEWLINE_BINDING_OPTIONS.some((option) =>
			bindingsEqual(option, storedNewline, platform)
		) &&
		!(sendBinding && bindingsEqual(storedNewline, sendBinding, platform))
	) {
		return { ...storedNewline };
	}
	return derived;
};

/** Newline options that do not conflict with the current send binding. */
export const getAvailableNewlineOptions = (
	sendBinding: ShortcutBinding | null | undefined,
	platform: Platform
): ShortcutBinding[] => {
	if (isNewlineLockedToSend(sendBinding, platform)) {
		return [NEWLINE_BINDING_SHIFT_ENTER];
	}
	return NEWLINE_BINDING_OPTIONS.filter(
		(option) =>
			!(sendBinding && bindingsEqual(option, sendBinding, platform))
	);
};
