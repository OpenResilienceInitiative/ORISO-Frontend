import type { Platform, ShortcutBinding, ShortcutDefinition } from '../types';
import { bindingsEqual } from '../utils/binding';
import {
	CANCEL_BINDING_ESCAPE,
	CANCEL_BINDING_OPTIONS,
	EDIT_LAST_BINDING_ARROW_UP,
	EDIT_LAST_BINDING_OPTIONS,
	EMOJI_BINDING_OPTIONS,
	EMOJI_BINDING_PRIMARY_E,
	HELP_BINDING_F1,
	HELP_BINDING_PRIMARY_SLASH,
	HELP_BINDING_QUESTION,
	NEWLINE_BINDING_ALT_ENTER,
	NEWLINE_BINDING_ENTER,
	NEWLINE_BINDING_PRIMARY_ENTER,
	NEWLINE_BINDING_SHIFT_ENTER,
	PALETTE_BINDING_OPTIONS,
	PALETTE_BINDING_PRIMARY_K,
	SEND_BINDING_ALT_ENTER,
	SEND_BINDING_ENTER,
	SEND_BINDING_PRIMARY_ENTER,
	SEND_BINDING_SHIFT_ENTER,
	UPLOAD_BINDING_OPTIONS,
	UPLOAD_BINDING_PRIMARY_SHIFT_U
} from './sendOptions';

export const SHORTCUT_REGISTRY: ShortcutDefinition[] = [
	{
		id: 'chat.sendMessage',
		category: 'messaging',
		defaultBinding: SEND_BINDING_ALT_ENTER,
		supportedBindings: [
			SEND_BINDING_ALT_ENTER,
			SEND_BINDING_PRIMARY_ENTER,
			SEND_BINDING_ENTER,
			SEND_BINDING_SHIFT_ENTER
		],
		activeInTextInput: true,
		canDisable: false,
		preventDefault: true,
		scope: 'composer',
		labelTranslationKey: 'shortcuts.actions.sendMessage.label',
		descriptionTranslationKey: 'shortcuts.actions.sendMessage.description',
		implemented: true
	},
	{
		id: 'chat.insertNewLine',
		category: 'messaging',
		defaultBinding: NEWLINE_BINDING_ENTER,
		supportedBindings: [
			NEWLINE_BINDING_ENTER,
			NEWLINE_BINDING_SHIFT_ENTER,
			NEWLINE_BINDING_PRIMARY_ENTER,
			NEWLINE_BINDING_ALT_ENTER
		],
		activeInTextInput: true,
		canDisable: false,
		preventDefault: false,
		scope: 'composer',
		labelTranslationKey: 'shortcuts.actions.insertNewLine.label',
		descriptionTranslationKey:
			'shortcuts.actions.insertNewLine.description',
		implemented: true
	},
	{
		id: 'chat.editLastMessage',
		category: 'messaging',
		defaultBinding: EDIT_LAST_BINDING_ARROW_UP,
		supportedBindings: EDIT_LAST_BINDING_OPTIONS,
		activeInTextInput: true,
		canDisable: true,
		preventDefault: true,
		scope: 'composer',
		labelTranslationKey: 'shortcuts.actions.editLastMessage.label',
		descriptionTranslationKey:
			'shortcuts.actions.editLastMessage.description',
		implemented: true
	},
	{
		id: 'chat.cancelReplyOrEdit',
		category: 'messaging',
		defaultBinding: CANCEL_BINDING_ESCAPE,
		supportedBindings: CANCEL_BINDING_OPTIONS,
		activeInTextInput: true,
		canDisable: true,
		preventDefault: true,
		scope: 'composer',
		labelTranslationKey: 'shortcuts.actions.cancelReplyOrEdit.label',
		descriptionTranslationKey:
			'shortcuts.actions.cancelReplyOrEdit.description',
		implemented: true
	},
	{
		id: 'chat.uploadFile',
		category: 'attachments',
		defaultBinding: UPLOAD_BINDING_PRIMARY_SHIFT_U,
		supportedBindings: UPLOAD_BINDING_OPTIONS,
		activeInTextInput: true,
		canDisable: true,
		preventDefault: true,
		scope: 'composer',
		labelTranslationKey: 'shortcuts.actions.uploadFile.label',
		descriptionTranslationKey: 'shortcuts.actions.uploadFile.description',
		implemented: true
	},
	{
		id: 'chat.openEmojiPicker',
		category: 'emoji',
		defaultBinding: EMOJI_BINDING_PRIMARY_E,
		supportedBindings: EMOJI_BINDING_OPTIONS,
		activeInTextInput: true,
		canDisable: true,
		preventDefault: true,
		scope: 'composer',
		labelTranslationKey: 'shortcuts.actions.openEmojiPicker.label',
		descriptionTranslationKey:
			'shortcuts.actions.openEmojiPicker.description',
		implemented: true
	},
	{
		id: 'app.showShortcutHelp',
		category: 'application',
		defaultBinding: HELP_BINDING_PRIMARY_SLASH,
		supportedBindings: [
			HELP_BINDING_PRIMARY_SLASH,
			HELP_BINDING_QUESTION,
			HELP_BINDING_F1
		],
		activeInTextInput: true,
		canDisable: true,
		preventDefault: true,
		scope: 'global',
		labelTranslationKey: 'shortcuts.actions.showShortcutHelp.label',
		descriptionTranslationKey:
			'shortcuts.actions.showShortcutHelp.description',
		implemented: true
	},
	{
		id: 'app.openCommandPalette',
		category: 'application',
		defaultBinding: PALETTE_BINDING_PRIMARY_K,
		supportedBindings: PALETTE_BINDING_OPTIONS,
		activeInTextInput: true,
		canDisable: true,
		preventDefault: true,
		scope: 'global',
		labelTranslationKey: 'shortcuts.actions.openCommandPalette.label',
		descriptionTranslationKey:
			'shortcuts.actions.openCommandPalette.description',
		implemented: true
	}
];

/** Category display order in Settings. */
export const SETTINGS_CATEGORY_ORDER = [
	'messaging',
	'attachments',
	'emoji',
	'application'
] as const;

export const getShortcutDefinition = (
	id: ShortcutDefinition['id']
): ShortcutDefinition | undefined =>
	SHORTCUT_REGISTRY.find((entry) => entry.id === id);

export const getImplementedShortcuts = (): ShortcutDefinition[] =>
	SHORTCUT_REGISTRY.filter((entry) => entry.implemented);

/** All registry rows for Settings. */
export const getSettingsShortcutRows = (): ShortcutDefinition[] =>
	SHORTCUT_REGISTRY.filter((entry) => entry.implemented);

export const isSupportedBinding = (
	definition: ShortcutDefinition,
	binding: ShortcutBinding | null,
	platform: Platform
): boolean => {
	if (binding === null) {
		return definition.canDisable;
	}
	return definition.supportedBindings.some((supported) =>
		bindingsEqual(supported, binding, platform)
	);
};
