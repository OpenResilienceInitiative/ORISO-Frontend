export const LIVE_CHAT_AVAILABILITY_STORAGE_KEY =
	'caritas_liveChatAvailability';
export const LIVE_CHAT_AVAILABILITY_CHANGE_EVENT =
	'caritas:liveChatAvailabilityChange';

/** This is a desired preference only; visible active state comes from the API. */
export const readLiveChatAvailabilityPreference = (): boolean => {
	try {
		return localStorage.getItem(LIVE_CHAT_AVAILABILITY_STORAGE_KEY) === '1';
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
