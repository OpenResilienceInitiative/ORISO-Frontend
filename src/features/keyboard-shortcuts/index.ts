export type {
	Platform,
	ShortcutActionId,
	ShortcutBinding,
	ShortcutDefinition,
	KeyboardShortcutPreferencesV1,
	ShortcutConflict,
	ComposerShortcutAction
} from './types';

export {
	SHORTCUT_REGISTRY,
	getImplementedShortcuts
} from './constants/registry';
export {
	SEND_BINDING_OPTIONS,
	SEND_BINDING_PRIMARY_ENTER,
	SEND_BINDING_ENTER,
	SEND_BINDING_ALT_ENTER
} from './constants/sendOptions';

export { getPlatform, getPrimaryModifier } from './utils/platform';
export { normalizeBinding, bindingsEqual } from './utils/binding';
export { matchesShortcut } from './utils/match';
export { formatShortcut } from './utils/format';
export { deriveNewlineBinding } from './utils/deriveNewline';
export { validateShortcutPreferences } from './utils/conflicts';
export { resolveComposerShortcutAction } from './utils/resolveComposerShortcut';

export {
	KEYBOARD_SHORTCUTS_STORAGE_KEY,
	loadShortcutPreferences,
	saveShortcutPreferences,
	createDefaultPreferences
} from './storage/preferenceStore';

export {
	KeyboardShortcutsProvider,
	useKeyboardShortcuts
} from './context/KeyboardShortcutsProvider';
export { useChatComposerShortcuts } from './hooks/useChatComposerShortcuts';
export { useGlobalShortcuts } from './hooks/useGlobalShortcuts';
export { useShortcutHelpHotkey } from './hooks/useShortcutHelpHotkey';
// UI components: import from their files to avoid pulling i18n into composer tests
export { KeyboardShortcutsSettings } from './components/KeyboardShortcutsSettings';
export { ShortcutHelpDialog } from './components/ShortcutHelpDialog';
export { CommandPaletteDialog } from './components/CommandPaletteDialog';
export { KeyboardShortcutsAppShell } from './components/KeyboardShortcutsAppShell';
