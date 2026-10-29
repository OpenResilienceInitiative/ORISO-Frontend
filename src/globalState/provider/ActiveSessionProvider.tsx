import type { AgencyConversationPolicy } from '../interfaces/ConversationFeatureSettings';
import * as React from 'react';
import { createContext, useMemo } from 'react';
import { ExtendedSessionInterface } from '..';

type ActiveSessionContextProps = {
	children?: React.ReactNode;
	activeSession: ExtendedSessionInterface | null;
	/** The reload's promise, when the provider has one to hand back. */
	reloadActiveSession?: () => void | Promise<unknown>;
	readActiveSession?: () => void;
	avatarMembers?: UserService.Schemas.ChatMemberResponseDTO[];
	agencyFeaturePolicy?: AgencyConversationPolicy;
};

export const ActiveSessionContext =
	createContext<ActiveSessionContextProps>(null);

export const ActiveSessionProvider: React.FC<ActiveSessionContextProps> = ({
	children,
	activeSession,
	reloadActiveSession,
	readActiveSession,
	avatarMembers,
	agencyFeaturePolicy
}) => {
	const contextValue = useMemo(
		() => ({
			activeSession,
			reloadActiveSession,
			readActiveSession,
			avatarMembers,
			agencyFeaturePolicy
		}),
		[
			activeSession,
			reloadActiveSession,
			readActiveSession,
			avatarMembers,
			agencyFeaturePolicy
		]
	);

	// Expose active session globally for CallManager to access
	React.useEffect(() => {
		(window as any).__activeSessionContext = contextValue;
	}, [contextValue]);

	return (
		<ActiveSessionContext.Provider value={contextValue}>
			{children}
		</ActiveSessionContext.Provider>
	);
};
