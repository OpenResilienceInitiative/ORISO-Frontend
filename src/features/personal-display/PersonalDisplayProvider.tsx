import * as React from 'react';
import {
	createContext,
	useContext,
	useEffect,
	useLayoutEffect,
	useState,
	useSyncExternalStore
} from 'react';
import {
	AUTHORITIES,
	hasUserAuthority
} from '../../globalState/helpers/stateHelpers';
import { UserDataContext } from '../../globalState/context/UserDataContext';
import {
	getAuthenticatedPreferenceIdentity,
	subscribeToAuthenticatedTenant
} from '../../utils/authenticatedTenant';
import {
	DEFAULT_DISPLAY,
	DEVICE_DARK_BRAND_KEY,
	DisplayPreferences,
	displayStorageKey,
	parseDisplayPreferences
} from './preferences';

const DARK = '(prefers-color-scheme: dark)';
const CHANGE = 'oriso:personal-display-change';

const subscribeToScheme = (listener: () => void) => {
	const query = window.matchMedia(DARK);
	query.addEventListener('change', listener);
	return () => query.removeEventListener('change', listener);
};
const systemDark = () => window.matchMedia(DARK).matches;

const read = (key: string | null) => {
	if (!key) return null;
	try {
		return window.localStorage.getItem(key);
	} catch {
		return null;
	}
};

const subscribeToPreferences = (listener: () => void) => {
	window.addEventListener(CHANGE, listener);
	window.addEventListener('storage', listener);
	return () => {
		window.removeEventListener(CHANGE, listener);
		window.removeEventListener('storage', listener);
	};
};

interface PersonalDisplay {
	preferences: DisplayPreferences;
	scheme?: 'light' | 'dark';
	available: boolean;
	showAskerEntry: boolean;
	pending: boolean;
	setHostActive: (active: boolean) => void;
	update: (preferences: DisplayPreferences) => void;
}

const Context = createContext<PersonalDisplay>({
	preferences: DEFAULT_DISPLAY,
	available: false,
	showAskerEntry: false,
	pending: false,
	setHostActive: () => {},
	update: () => {}
});

export const PersonalDisplayProvider = ({
	children
}: React.PropsWithChildren) => {
	const [hostActive, setHostActive] = useState(false);
	const { userData } = useContext(UserDataContext);
	const account = useSyncExternalStore(
		subscribeToAuthenticatedTenant,
		getAuthenticatedPreferenceIdentity
	);
	const isConsultant = hasUserAuthority(
		AUTHORITIES.CONSULTANT_DEFAULT,
		userData
	);
	const isAsker = hasUserAuthority(AUTHORITIES.ASKER_DEFAULT, userData);
	const identity = isAsker || isConsultant ? account : null;
	const [resolved, setResolved] = useState<{
		identity: string;
		key: string | null;
	}>();
	const [temporary, setTemporary] = useState<{
		identity: string;
		value: DisplayPreferences;
	}>();
	const current =
		identity && resolved?.identity === identity ? resolved : null;
	const key = current?.key ?? null;

	useEffect(() => {
		setTemporary(undefined);
		if (!identity) {
			setResolved(undefined);
			return;
		}
		let active = true;
		displayStorageKey(identity)
			.catch(() => null)
			.then((key) => {
				if (active) setResolved({ identity, key });
			});
		return () => {
			active = false;
		};
	}, [identity]);

	const stored = useSyncExternalStore(subscribeToPreferences, () =>
		read(key)
	);
	const preferences =
		identity && temporary?.identity === identity
			? temporary.value
			: parseDisplayPreferences(stored);
	const dark = useSyncExternalStore(subscribeToScheme, systemDark);
	const available = Boolean(current) && hostActive;
	const scheme = available
		? preferences.scheme === 'system'
			? dark
				? 'dark'
				: 'light'
			: preferences.scheme
		: undefined;

	const update = (value: DisplayPreferences) => {
		if (
			!current ||
			getAuthenticatedPreferenceIdentity() !== current.identity
		)
			return;
		try {
			window.localStorage.setItem(DEVICE_DARK_BRAND_KEY, value.darkBrand);
		} catch {
			// Only the sign-in page reads this; the personal save goes on.
		}
		try {
			if (key) {
				window.localStorage.setItem(key, JSON.stringify(value));
				setTemporary(undefined);
				window.dispatchEvent(new Event(CHANGE));
				return;
			}
		} catch {
			// The controls also work in a browser that blocks persistent storage.
		}
		setTemporary({ identity: current.identity, value });
	};

	return (
		<Context.Provider
			value={{
				preferences,
				scheme,
				available,
				showAskerEntry: available && isAsker && !isConsultant,
				pending: Boolean(identity && !current),
				setHostActive,
				update
			}}
		>
			{children}
		</Context.Provider>
	);
};

export const usePersonalDisplay = () => useContext(Context);

// The authenticated app subtree owns when personal choices affect the
// document. Public routes never mount the display host.
export const usePersonalDisplayHost = (active = true) => {
	const display = usePersonalDisplay();
	const { setHostActive } = display;
	useLayoutEffect(() => {
		setHostActive(active);
		return () => setHostActive(false);
	}, [active, setHostActive]);
	return display;
};
