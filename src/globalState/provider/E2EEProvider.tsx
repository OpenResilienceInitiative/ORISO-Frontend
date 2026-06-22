import * as React from 'react';
import {
	createContext,
	useState,
	useEffect,
	useCallback,
	useContext
} from 'react';
import { importRSAKey } from '../../utils/encryptionHelpers';
import { RocketChatGlobalSettingsContext } from './RocketChatGlobalSettingsProvider';
import {
	SETTING_E2E_ENABLE,
	IBooleanSetting
} from '../../api/apiRocketChatSettingsPublic';
import {
	resolveIsE2eeEnabled,
	STORAGE_KEY_E2EE_DISABLED
} from '../../utils/e2eeSettings';

export { STORAGE_KEY_E2EE_DISABLED };

interface E2EEContextProps {
	key: string;
	reloadPrivateKey: () => void;
	isE2eeEnabled: boolean;
	e2EEReady: boolean;
}

export const E2EEContext = createContext<E2EEContextProps>(null);

export function E2EEProvider(props) {
	const [key, setKey] = useState(null);
	const [isE2eeEnabled, setIsE2eeEnabled] = useState(false);
	const [e2EEReady, setE2EEReady] = useState(false);
	const { settingsReady, getSetting } = useContext(
		RocketChatGlobalSettingsContext
	);

	const reloadPrivateKey = useCallback(() => {
		const privateKey = sessionStorage.getItem('private_key');
		if (!privateKey) {
			return;
		}
		importRSAKey(JSON.parse(privateKey), ['decrypt']).then(setKey);
	}, []);

	useEffect(() => {
		reloadPrivateKey();
	}, [reloadPrivateKey]);

	useEffect(() => {
		if (!settingsReady) {
			return;
		}

		// MATRIX MIGRATION: Keep frontend custom E2EE enabled
		// Matrix rooms are NOT using Matrix native E2EE (to avoid conflicts with frontend encryption)
		// The frontend uses its own custom encryption (enc. prefix) which Element displays as plaintext
		setIsE2eeEnabled(
			resolveIsE2eeEnabled(
				getSetting<IBooleanSetting>(SETTING_E2E_ENABLE)?.value === true,
				localStorage.getItem(STORAGE_KEY_E2EE_DISABLED),
				process.env.NODE_ENV
			)
		);
		setE2EEReady(true);
	}, [getSetting, settingsReady]);

	return (
		<E2EEContext.Provider
			value={{ key, reloadPrivateKey, isE2eeEnabled, e2EEReady }}
		>
			{props.children}
		</E2EEContext.Provider>
	);
}
