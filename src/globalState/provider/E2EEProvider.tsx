import * as React from 'react';
import { createContext } from 'react';
import { STORAGE_KEY_E2EE_DISABLED } from '../../utils/e2eeSettings';

export { STORAGE_KEY_E2EE_DISABLED };

interface E2EEContextProps {
	key: string;
	reloadPrivateKey: () => void;
	isE2eeEnabled: boolean;
	e2EEReady: boolean;
}

/**
 * Room encryption is handled entirely by Matrix (see ADR-004).
 * The context stays so chat components keep a single switch-off point;
 * Matrix room encryption is intentionally NOT enabled here (ADR-004).
 */
const E2EE_CONTEXT_VALUE: E2EEContextProps = {
	key: null,
	reloadPrivateKey: () => {},
	isE2eeEnabled: false,
	e2EEReady: true
};

export const E2EEContext = createContext<E2EEContextProps>(E2EE_CONTEXT_VALUE);

export function E2EEProvider(props) {
	return (
		<E2EEContext.Provider value={E2EE_CONTEXT_VALUE}>
			{props.children}
		</E2EEContext.Provider>
	);
}
