export const LIVE_CHAT_AVAILABILITY_STORAGE_KEY = 'oriso_liveChatAvailability';
export const LIVE_CHAT_AVAILABILITY_CHANGE_EVENT =
	'oriso:liveChatAvailabilityChange';

/**
 * FE-H05: this key was previously namespaced to the old provider. Consultants
 * who set their preference before the rename still carry the legacy key, so
 * adopt it once instead of silently resetting them to unavailable.
 */
const LEGACY_STORAGE_KEY = 'caritas_liveChatAvailability';

const adoptLegacyPreference = (): boolean => {
	const legacyValue = localStorage.getItem(LEGACY_STORAGE_KEY);
	if (legacyValue === null) {
		return false;
	}

	localStorage.removeItem(LEGACY_STORAGE_KEY);
	if (legacyValue === '1') {
		localStorage.setItem(LIVE_CHAT_AVAILABILITY_STORAGE_KEY, '1');
		return true;
	}
	return false;
};

/** This is a desired preference only; visible active state comes from the API. */
export const readLiveChatAvailabilityPreference = (): boolean => {
	try {
		if (localStorage.getItem(LIVE_CHAT_AVAILABILITY_STORAGE_KEY) === '1') {
			return true;
		}
		return adoptLegacyPreference();
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
		localStorage.removeItem(LEGACY_STORAGE_KEY);
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
