import * as React from 'react';
import { createContext, useMemo } from 'react';
import { ExtendedSessionInterface } from '..';

type ActiveSessionContextProps = {
	children?: React.ReactNode;
	activeSession: ExtendedSessionInterface | null;
	reloadActiveSession?: () => void;
	readActiveSession?: () => void;
};

export const ActiveSessionContext =
	createContext<ActiveSessionContextProps>(null);

export const ActiveSessionProvider: React.FC<ActiveSessionContextProps> = ({
	children,
	activeSession,
	reloadActiveSession,
	readActiveSession
}) => {
	const contextValue = useMemo(
		() => ({ activeSession, reloadActiveSession, readActiveSession }),
		[activeSession, reloadActiveSession, readActiveSession]
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
