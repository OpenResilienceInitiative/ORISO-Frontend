import * as React from 'react';
import {
	ConsultantListProvider,
	ConsultingTypesProvider,
	NotificationsProvider,
	UpdateSessionListProvider,
	UserDataProvider,
	WebsocketConnectionDeactivatedProvider,
	ServerSettingsProvider,
	SessionsDataProvider,
	ModalProvider,
	AgencySpecificProvider,
	TopicsProvider
} from '.';
import { KeyboardShortcutsProvider } from '../features/keyboard-shortcuts';
import { useGlobalShortcuts } from '../features/keyboard-shortcuts/hooks/useGlobalShortcuts';
import { ShortcutHelpDialog } from '../features/keyboard-shortcuts/components/ShortcutHelpDialog';
import { CommandPaletteDialog } from '../features/keyboard-shortcuts/components/CommandPaletteDialog';

function ProviderComposer({ contexts, children }) {
	return contexts.reduceRight(
		(children, parent) =>
			React.cloneElement(parent, {
				children: children
			}),
		children
	);
}

const KeyboardShortcutsShell = ({
	children
}: {
	children?: React.ReactNode;
}) => {
	useGlobalShortcuts(true);
	return (
		<>
			{children}
			<ShortcutHelpDialog />
			<CommandPaletteDialog />
		</>
	);
};

/** Must sit after UserDataProvider so preferences can isolate by userId. */
const KeyboardShortcutsRoot = ({
	children
}: {
	children?: React.ReactNode;
}) => (
	<KeyboardShortcutsProvider>
		<KeyboardShortcutsShell>{children}</KeyboardShortcutsShell>
	</KeyboardShortcutsProvider>
);

function ContextProvider({ children }) {
	return (
		<ProviderComposer
			contexts={[
				<ConsultantListProvider />,
				<ConsultingTypesProvider />,
				<TopicsProvider />,
				<NotificationsProvider />,
				<UpdateSessionListProvider />,
				<UserDataProvider />,
				<AgencySpecificProvider />,
				<WebsocketConnectionDeactivatedProvider />,
				<SessionsDataProvider />,
				<ServerSettingsProvider />,
				<ModalProvider />,
				<KeyboardShortcutsRoot />
			]}
		>
			{children}
		</ProviderComposer>
	);
}

export { ContextProvider };
