import { useCallback, useContext, useSyncExternalStore } from 'react';
import { useMediaQuery } from '@mui/material';
import { UserDataContext } from '../../globalState/context/UserDataContext';
import './menuEffects.scss';

const CHANGE_EVENT = 'oriso:menu-effects-change';
const memory = new Map<string, boolean>();
// FNV-1a: the key must not reveal which accounts used a shared device.
const hashId = (value: string) => {
	let hash = 0x811c9dc5;
	for (let index = 0; index < value.length; index++) {
		hash ^= value.charCodeAt(index);
		hash = Math.imul(hash, 0x01000193);
	}
	return (hash >>> 0).toString(36);
};
const storageKey = (userId?: string) =>
	`oriso.menuEffects.v2:${userId ? hashId(userId) : '__anonymous__'}`;

const LEGACY_PREFIX = 'oriso.menuEffects.v1:';
let legacyDropped = false;

/** v1 keys held the raw account id; the preference is not worth migrating. */
export const dropLegacyMenuEffectKeys = (): void => {
	try {
		Object.keys(window.localStorage)
			.filter((key) => key.startsWith(LEGACY_PREFIX))
			.forEach((key) => window.localStorage.removeItem(key));
	} catch {
		// Storage unavailable: nothing was written there either.
	}
};

export const readMenuEffects = (userId?: string): boolean => {
	if (!legacyDropped) {
		legacyDropped = true;
		dropLegacyMenuEffectKeys();
	}
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
