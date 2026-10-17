import { useEffect, useState } from 'react';
import { apiGetIsUsernameAvailable } from '../../../api/apiGetIsUsernameAvailable';

/** Typing pauses this long before the backend is asked. */
export const USERNAME_AVAILABILITY_DEBOUNCE_MS = 350;

export interface UsernameAvailability {
	/** `true` until the backend says the User-ID is taken. */
	isAvailable: boolean;
	/** The backend answered for exactly this User-ID. */
	checked: boolean;
	/** The backend could not be asked; nothing is known. */
	failed: boolean;
}

/**
 * Whether a User-ID is still free — the backend is the real uniqueness gate.
 * Shared by the registration and the call entry (#1386), so both open their
 * gate on the same answer. The result belongs to the User-ID it was asked
 * for: a newer entry is never "checked" by an older answer.
 */
export const useUsernameAvailability = (
	username: string,
	/** Only ask for User-IDs the registration's own rule accepts. */
	enabled: boolean,
	check: (username: string) => Promise<boolean> = apiGetIsUsernameAvailable
): UsernameAvailability => {
	const [result, setResult] = useState<{
		username: string;
		available: boolean;
		failed: boolean;
	} | null>(null);

	useEffect(() => {
		if (!enabled) return;
		let canceled = false;
		const timeout = window.setTimeout(async () => {
			try {
				const available = await check(username);
				if (!canceled)
					setResult({ username, available, failed: false });
			} catch {
				if (!canceled) {
					setResult({ username, available: true, failed: true });
				}
			}
		}, USERNAME_AVAILABILITY_DEBOUNCE_MS);
		return () => {
			canceled = true;
			window.clearTimeout(timeout);
		};
	}, [username, enabled, check]);

	const current = enabled && result?.username === username ? result : null;
	return {
		isAvailable: current?.available ?? true,
		checked: Boolean(current) && !current!.failed,
		failed: Boolean(current?.failed)
	};
};
