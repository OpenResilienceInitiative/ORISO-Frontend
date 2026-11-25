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
import { PersonalDisplayProvider } from '../features/personal-display/PersonalDisplayProvider';
import { KeyboardShortcutsProvider } from '../features/keyboard-shortcuts';
import { useGlobalShortcuts } from '../features/keyboard-shortcuts/hooks/useGlobalShortcuts';
import { ShortcutHelpDialog } from '../features/keyboard-shortcuts/components/ShortcutHelpDialog';
import { CommandPaletteDialog } from '../features/keyboard-shortcuts/components/CommandPaletteDialog';
import { useLoginHandoverActive } from '../components/app/loginHandover';

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
	// The window listener ignores `inert`, and the palette is a native modal
	// that escapes it: no shortcuts while the sign-in handover covers the
	// page (#2272).
	const isHandingOver = useLoginHandoverActive();
	useGlobalShortcuts(!isHandingOver);
	return (
		<>
			{children}
			<ShortcutHelpDialog />
			<CommandPaletteDialog />
		</>
	);
};

/** Must sit after UserDataProvider so preferences can isolate by userId. */
/** Exported for tests. */
export const KeyboardShortcutsRoot = ({
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
				<PersonalDisplayProvider />,
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
