import { useCallback, useContext, useSyncExternalStore } from 'react';
import { useMediaQuery } from '@mui/material';
import { UserDataContext } from '../../globalState/context/UserDataContext';
import './menuEffects.scss';

const CHANGE_EVENT = 'oriso:menu-effects-change';
const memory = new Map<string, boolean>();
const storageKey = (userId?: string) =>
	`oriso.menuEffects.v1:${encodeURIComponent(userId || '__anonymous__')}`;

export const readMenuEffects = (userId?: string): boolean => {
	const key = storageKey(userId);
	if (memory.has(key)) return memory.get(key)!;
	try {
		return window.localStorage.getItem(key) !== 'false';
	} catch {
		return true;
	}
};

export const saveMenuEffects = (enabled: boolean, userId?: string): void => {
	const key = storageKey(userId);
	try {
		window.localStorage.setItem(key, String(enabled));
		memory.delete(key);
	} catch {
		// Keep the control usable when browser storage is unavailable.
		memory.set(key, enabled);
	}
	window.dispatchEvent(new Event(CHANGE_EVENT));
};

const subscribe = (listener: () => void) => {
	window.addEventListener(CHANGE_EVENT, listener);
	window.addEventListener('storage', listener);
	return () => {
		window.removeEventListener(CHANGE_EVENT, listener);
		window.removeEventListener('storage', listener);
	};
};

/** Browser-local display preference, isolated by the signed-in account. */
export const useMenuEffects = () => {
	const userId = useContext(UserDataContext)?.userData?.userId;
	const snapshot = useCallback(() => readMenuEffects(userId), [userId]);
	const enabled = useSyncExternalStore(subscribe, snapshot, () => true);
	const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
	const setEnabled = useCallback(
		(value: boolean) => saveMenuEffects(value, userId),
		[userId]
	);
	return { enabled, motionEnabled: enabled && !reducedMotion, setEnabled };
};
