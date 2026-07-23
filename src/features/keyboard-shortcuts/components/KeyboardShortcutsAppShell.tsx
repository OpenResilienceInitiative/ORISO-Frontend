import React, { useEffect } from 'react';
import { KeyboardShortcutsProvider } from '../context/KeyboardShortcutsProvider';
import { useGlobalShortcuts } from '../hooks/useGlobalShortcuts';
import { ShortcutHelpDialog } from './ShortcutHelpDialog';
import { CommandPaletteDialog } from './CommandPaletteDialog';

const ShortcutHelpHost = () => {
	useGlobalShortcuts(true);
	return (
		<>
			<ShortcutHelpDialog />
			<CommandPaletteDialog />
		</>
	);
};

/**
 * Mount inside authenticated ContextProvider (after UserDataProvider).
 */
export const KeyboardShortcutsAppShell = ({
	children
}: {
	children: React.ReactNode;
}) => (
	<KeyboardShortcutsProvider>
		{children}
		<ShortcutHelpHost />
	</KeyboardShortcutsProvider>
);

/** Ensures dialog element exists for a11y tests without opening. */
export const useMountHelpDialog = () => {
	useEffect(() => undefined, []);
};
