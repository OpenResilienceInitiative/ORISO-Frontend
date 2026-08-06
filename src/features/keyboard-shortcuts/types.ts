export type Platform = 'mac' | 'windows' | 'linux' | 'unknown';

export type ShortcutCategory =
	| 'messaging'
	| 'attachments'
	| 'emoji'
	| 'application';

export type ShortcutScope = 'composer' | 'chat' | 'global';

/**
 * Canonical action identifiers. Only actions with existing app behavior
 * are registered as `implemented` in the registry for Settings UI.
 */
export type ShortcutActionId =
	| 'chat.sendMessage'
	| 'chat.insertNewLine'
	| 'chat.uploadFile'
	| 'chat.editLastMessage'
	| 'chat.cancelReplyOrEdit'
	| 'chat.openEmojiPicker'
	| 'app.showShortcutHelp'
	| 'app.openCommandPalette';

export interface ShortcutBinding {
	key: string;
	primaryModifier?: boolean;
	ctrl?: boolean;
	meta?: boolean;
	shift?: boolean;
	alt?: boolean;
}

export interface ShortcutDefinition {
	id: ShortcutActionId;
	category: ShortcutCategory;
	defaultBinding: ShortcutBinding | null;
	supportedBindings: ShortcutBinding[];
	activeInTextInput: boolean;
	canDisable: boolean;
	preventDefault: boolean;
	scope: ShortcutScope;
	labelTranslationKey: string;
	descriptionTranslationKey: string;
	/** When false, omitted from Settings and help (types only / future). */
	implemented: boolean;
}

export interface KeyboardShortcutPreferencesV1 {
	version: 1;
	bindings: Partial<Record<ShortcutActionId, ShortcutBinding | null>>;
}

export type ShortcutConflictType =
	| 'duplicate'
	| 'reserved'
	| 'send-newline'
	| 'unsafe-plain-key'
	| 'unsupported';

export interface ShortcutConflict {
	actionId: ShortcutActionId;
	conflictingActionId?: ShortcutActionId;
	type: ShortcutConflictType;
	messageTranslationKey: string;
}

export type ComposerShortcutAction = 'send' | 'newline';
