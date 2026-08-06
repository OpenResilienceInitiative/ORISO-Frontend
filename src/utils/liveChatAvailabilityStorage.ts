export const LIVE_CHAT_AVAILABILITY_STORAGE_KEY = 'oriso_liveChatAvailability';
export const LIVE_CHAT_AVAILABILITY_CHANGE_EVENT =
	'oriso:liveChatAvailabilityChange';

/**
 * Keys written by builds before the Caritas fork was renamed (FE-H05, #178).
 * Read for backwards compatibility and dropped on the next write, so a
 * consultant who was available before the update stays available after it.
 */
export const LEGACY_LIVE_CHAT_AVAILABILITY_STORAGE_KEY =
	'caritas_liveChatAvailability';

/** This is a desired preference only; visible active state comes from the API. */
export const readLiveChatAvailabilityPreference = (): boolean => {
	try {
		return (
			localStorage.getItem(LIVE_CHAT_AVAILABILITY_STORAGE_KEY) === '1' ||
			localStorage.getItem(LEGACY_LIVE_CHAT_AVAILABILITY_STORAGE_KEY) ===
				'1'
		);
	} catch {
		return false;
	}
};

export const persistLiveChatAvailabilityPreference = (
	active: boolean
): void => {
	try {
		if (active) {
			localStorage.setItem(LIVE_CHAT_AVAILABILITY_STORAGE_KEY, '1');
		} else {
			localStorage.removeItem(LIVE_CHAT_AVAILABILITY_STORAGE_KEY);
		}
		localStorage.removeItem(LEGACY_LIVE_CHAT_AVAILABILITY_STORAGE_KEY);
	} catch {
		/* Storage errors do not change the backend-acknowledged state. */
	}
	window.dispatchEvent(
		new CustomEvent(LIVE_CHAT_AVAILABILITY_CHANGE_EVENT, {
			detail: { active }
		})
	);
};

export const clearLiveChatAvailabilityPreference = (): void => {
	persistLiveChatAvailabilityPreference(false);
};
