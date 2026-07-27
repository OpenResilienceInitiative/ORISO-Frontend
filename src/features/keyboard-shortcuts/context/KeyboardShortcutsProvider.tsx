import React, {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useState,
	type PropsWithChildren
} from 'react';
import { UserDataContext } from '../../../globalState/context/UserDataContext';
import type {
	KeyboardShortcutPreferencesV1,
	Platform,
	ShortcutActionId,
	ShortcutBinding,
	ShortcutConflict
} from '../types';
import {
	deriveNewlineBinding,
	isNewlineLockedToSend,
	resolveNewlineBinding
} from '../utils/deriveNewline';
import { getPlatform } from '../utils/platform';
import {
	getBindingWarnings,
	hasBlockingConflicts,
	validateShortcutPreferences
} from '../utils/conflicts';
import {
	clearShortcutPreferences,
	createDefaultPreferences,
	loadShortcutPreferences,
	saveShortcutPreferences
} from '../storage/preferenceStore';

export type PersistResult =
	| { ok: true; warnings?: ShortcutConflict[] }
	| { ok: false; conflicts: ShortcutConflict[] };

export type KeyboardShortcutsContextValue = {
	platform: Platform;
	preferences: KeyboardShortcutPreferencesV1;
	isHelpOpen: boolean;
	openHelp: () => void;
	closeHelp: () => void;
	toggleHelp: () => void;
	isPaletteOpen: boolean;
	openPalette: () => void;
	closePalette: () => void;
	togglePalette: () => void;
	setBinding: (
		actionId: ShortcutActionId,
		binding: ShortcutBinding | null
	) => PersistResult;
	setSendBinding: (binding: ShortcutBinding) => PersistResult;
	setHelpBinding: (binding: ShortcutBinding | null) => PersistResult;
	restoreDefaults: () => void;
	getBinding: (
		actionId: keyof KeyboardShortcutPreferencesV1['bindings']
	) => ShortcutBinding | null | undefined;
	isNewlineLocked: boolean;
	getWarningsForBinding: (
		actionId: ShortcutActionId,
		binding: ShortcutBinding | null
	) => ShortcutConflict[];
};

const KeyboardShortcutsContext =
	createContext<KeyboardShortcutsContextValue | null>(null);

export const KeyboardShortcutsProvider = ({
	children,
	platformOverride
}: PropsWithChildren<{ platformOverride?: Platform }>) => {
	const userDataContext = useContext(UserDataContext);
	const userId = userDataContext?.userData?.userId ?? null;
	const platform = platformOverride ?? getPlatform();

	const [preferences, setPreferences] =
		useState<KeyboardShortcutPreferencesV1>(() =>
			loadShortcutPreferences(userId)
		);
	const [isHelpOpen, setIsHelpOpen] = useState(false);
	const [isPaletteOpen, setIsPaletteOpen] = useState(false);

	useEffect(() => {
		setPreferences(loadShortcutPreferences(userId));
	}, [userId]);

	const persist = useCallback(
		(next: KeyboardShortcutPreferencesV1): PersistResult => {
			const send = next.bindings['chat.sendMessage'] ?? null;
			const withNewline: KeyboardShortcutPreferencesV1 = {
				version: 1,
				bindings: {
					...next.bindings,
					'chat.insertNewLine': resolveNewlineBinding(
						send,
						next.bindings['chat.insertNewLine'],
						platform
					)
				}
			};
			const conflicts = validateShortcutPreferences(
				withNewline,
				platform
			);
			if (hasBlockingConflicts(conflicts)) {
				return { ok: false, conflicts };
			}
			saveShortcutPreferences(withNewline, userId);
			setPreferences(withNewline);
			return { ok: true };
		},
		[platform, userId]
	);

	const setBinding = useCallback(
		(actionId: ShortcutActionId, binding: ShortcutBinding | null) => {
			const nextBindings = {
				...preferences.bindings,
				[actionId]: binding
			};
			if (actionId === 'chat.sendMessage') {
				nextBindings['chat.insertNewLine'] = deriveNewlineBinding(
					binding,
					platform
				);
			}
			const result = persist({ version: 1, bindings: nextBindings });
			if (result.ok) {
				const warnings = getBindingWarnings(
					actionId,
					binding,
					platform
				);
				return warnings.length
					? { ok: true as const, warnings }
					: { ok: true as const };
			}
			return result;
		},
		[persist, preferences.bindings, platform]
	);

	const setSendBinding = useCallback(
		(binding: ShortcutBinding) => setBinding('chat.sendMessage', binding),
		[setBinding]
	);

	const setHelpBinding = useCallback(
		(binding: ShortcutBinding | null) =>
			setBinding('app.showShortcutHelp', binding),
		[setBinding]
	);

	const restoreDefaults = useCallback(() => {
		clearShortcutPreferences(userId);
		const defaults = createDefaultPreferences();
		saveShortcutPreferences(defaults, userId);
		setPreferences(defaults);
	}, [userId]);

	const getBinding = useCallback(
		(actionId: keyof KeyboardShortcutPreferencesV1['bindings']) => {
			if (actionId === 'chat.insertNewLine') {
				return resolveNewlineBinding(
					preferences.bindings['chat.sendMessage'] ?? null,
					preferences.bindings['chat.insertNewLine'],
					platform
				);
			}
			return preferences.bindings[actionId];
		},
		[preferences.bindings, platform]
	);

	const getWarningsForBinding = useCallback(
		(actionId: ShortcutActionId, binding: ShortcutBinding | null) =>
			getBindingWarnings(actionId, binding, platform),
		[platform]
	);

	const isNewlineLocked = isNewlineLockedToSend(
		preferences.bindings['chat.sendMessage'] ?? null,
		platform
	);

	const openHelp = useCallback(() => {
		setIsPaletteOpen(false);
		setIsHelpOpen(true);
	}, []);
	const closeHelp = useCallback(() => setIsHelpOpen(false), []);
	const toggleHelp = useCallback(() => {
		setIsHelpOpen((open) => {
			if (open) {
				return false;
			}
			setIsPaletteOpen(false);
			return true;
		});
	}, []);
	const openPalette = useCallback(() => {
		setIsHelpOpen(false);
		setIsPaletteOpen(true);
	}, []);
	const closePalette = useCallback(() => setIsPaletteOpen(false), []);
	const togglePalette = useCallback(() => {
		setIsPaletteOpen((open) => {
			if (open) {
				return false;
			}
			setIsHelpOpen(false);
			return true;
		});
	}, []);

	const value = useMemo<KeyboardShortcutsContextValue>(
		() => ({
			platform,
			preferences,
			isHelpOpen,
			openHelp,
			closeHelp,
			toggleHelp,
			isPaletteOpen,
			openPalette,
			closePalette,
			togglePalette,
			setBinding,
			setSendBinding,
			setHelpBinding,
			restoreDefaults,
			getBinding,
			isNewlineLocked,
			getWarningsForBinding
		}),
		[
			platform,
			preferences,
			isHelpOpen,
			openHelp,
			closeHelp,
			toggleHelp,
			isPaletteOpen,
			openPalette,
			closePalette,
			togglePalette,
			setBinding,
			setSendBinding,
			setHelpBinding,
			restoreDefaults,
			getBinding,
			isNewlineLocked,
			getWarningsForBinding
		]
	);

	return (
		<KeyboardShortcutsContext.Provider value={value}>
			{children}
		</KeyboardShortcutsContext.Provider>
	);
};

export const useKeyboardShortcuts = (): KeyboardShortcutsContextValue => {
	const ctx = useContext(KeyboardShortcutsContext);
	if (!ctx) {
		const platform = getPlatform();
		const preferences = createDefaultPreferences();
		return {
			platform,
			preferences,
			isHelpOpen: false,
			openHelp: () => undefined,
			closeHelp: () => undefined,
			toggleHelp: () => undefined,
			isPaletteOpen: false,
			openPalette: () => undefined,
			closePalette: () => undefined,
			togglePalette: () => undefined,
			setBinding: () => ({ ok: true }),
			setSendBinding: () => ({ ok: true }),
			setHelpBinding: () => ({ ok: true }),
			restoreDefaults: () => undefined,
			getBinding: (actionId) => preferences.bindings[actionId],
			isNewlineLocked: false,
			getWarningsForBinding: () => []
		};
	}
	return ctx;
};
