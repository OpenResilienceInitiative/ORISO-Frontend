import type { ShortcutActionId, ShortcutBinding } from '../types';

/** Approved send bindings for Settings select (structured, not display strings). */
export const SEND_BINDING_PRIMARY_ENTER: ShortcutBinding = {
	key: 'Enter',
	primaryModifier: true
};

export const SEND_BINDING_ENTER: ShortcutBinding = {
	key: 'Enter'
};

export const SEND_BINDING_SHIFT_ENTER: ShortcutBinding = {
	key: 'Enter',
	shift: true
};

export const SEND_BINDING_ALT_ENTER: ShortcutBinding = {
	key: 'Enter',
	alt: true
};

export const SEND_BINDING_OPTIONS: ShortcutBinding[] = [
	SEND_BINDING_ALT_ENTER,
	SEND_BINDING_PRIMARY_ENTER,
	SEND_BINDING_ENTER,
	SEND_BINDING_SHIFT_ENTER
];

export const NEWLINE_BINDING_ENTER: ShortcutBinding = {
	key: 'Enter'
};

export const NEWLINE_BINDING_SHIFT_ENTER: ShortcutBinding = {
	key: 'Enter',
	shift: true
};

export const NEWLINE_BINDING_PRIMARY_ENTER: ShortcutBinding = {
	key: 'Enter',
	primaryModifier: true
};

export const NEWLINE_BINDING_ALT_ENTER: ShortcutBinding = {
	key: 'Enter',
	alt: true
};

/** User-selectable newline options when not forced by Enter-to-send. */
export const NEWLINE_BINDING_OPTIONS: ShortcutBinding[] = [
	NEWLINE_BINDING_ENTER,
	NEWLINE_BINDING_SHIFT_ENTER,
	NEWLINE_BINDING_PRIMARY_ENTER,
	NEWLINE_BINDING_ALT_ENTER
];

export const HELP_BINDING_PRIMARY_SLASH: ShortcutBinding = {
	key: '/',
	primaryModifier: true
};

export const HELP_BINDING_QUESTION: ShortcutBinding = {
	key: '?'
};

export const HELP_BINDING_F1: ShortcutBinding = {
	key: 'F1'
};

export const HELP_BINDING_OPTIONS: ShortcutBinding[] = [
	HELP_BINDING_PRIMARY_SLASH,
	HELP_BINDING_QUESTION,
	HELP_BINDING_F1
];

export const EDIT_LAST_BINDING_ARROW_UP: ShortcutBinding = { key: 'ArrowUp' };
export const EDIT_LAST_BINDING_F2: ShortcutBinding = { key: 'F2' };
export const EDIT_LAST_BINDING_OPTIONS: ShortcutBinding[] = [
	EDIT_LAST_BINDING_ARROW_UP,
	EDIT_LAST_BINDING_F2
];

export const CANCEL_BINDING_ESCAPE: ShortcutBinding = { key: 'Escape' };
export const CANCEL_BINDING_OPTIONS: ShortcutBinding[] = [
	CANCEL_BINDING_ESCAPE
];

export const UPLOAD_BINDING_PRIMARY_SHIFT_U: ShortcutBinding = {
	key: 'U',
	primaryModifier: true,
	shift: true
};
export const UPLOAD_BINDING_PRIMARY_U: ShortcutBinding = {
	key: 'U',
	primaryModifier: true
};
export const UPLOAD_BINDING_OPTIONS: ShortcutBinding[] = [
	UPLOAD_BINDING_PRIMARY_SHIFT_U,
	UPLOAD_BINDING_PRIMARY_U
];

export const EMOJI_BINDING_PRIMARY_E: ShortcutBinding = {
	key: 'E',
	primaryModifier: true
};
export const EMOJI_BINDING_OPTIONS: ShortcutBinding[] = [
	EMOJI_BINDING_PRIMARY_E
];

export const PALETTE_BINDING_PRIMARY_K: ShortcutBinding = {
	key: 'K',
	primaryModifier: true
};
export const PALETTE_BINDING_PRIMARY_SHIFT_P: ShortcutBinding = {
	key: 'P',
	primaryModifier: true,
	shift: true
};
export const PALETTE_BINDING_OPTIONS: ShortcutBinding[] = [
	PALETTE_BINDING_PRIMARY_K,
	PALETTE_BINDING_PRIMARY_SHIFT_P
];

/** Approved selectable options per action (Settings dropdowns). */
export const ACTION_BINDING_OPTIONS: Record<
	ShortcutActionId,
	ShortcutBinding[]
> = {
	'chat.sendMessage': SEND_BINDING_OPTIONS,
	'chat.insertNewLine': NEWLINE_BINDING_OPTIONS,
	'chat.editLastMessage': EDIT_LAST_BINDING_OPTIONS,
	'chat.cancelReplyOrEdit': CANCEL_BINDING_OPTIONS,
	'chat.uploadFile': UPLOAD_BINDING_OPTIONS,
	'chat.openEmojiPicker': EMOJI_BINDING_OPTIONS,
	'app.showShortcutHelp': HELP_BINDING_OPTIONS,
	'app.openCommandPalette': PALETTE_BINDING_OPTIONS
};
