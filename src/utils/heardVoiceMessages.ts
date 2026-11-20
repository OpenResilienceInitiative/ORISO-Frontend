/**
 * Which voice messages were played on this device (#1140), so an old recording
 * waits for Play instead of loading again whenever it scrolls into view. Holds
 * media addresses only, never content. Losing it only means a message loads a
 * little earlier than it had to.
 */
const STORAGE_KEY = 'oriso.heardVoiceMessages';
const MAX_REMEMBERED = 500;

const readHeard = (): string[] => {
	try {
		const stored = JSON.parse(
			window.localStorage.getItem(STORAGE_KEY) ?? '[]'
		);
		return Array.isArray(stored) ? stored : [];
	} catch {
		return [];
	}
};

export const isVoiceMessageHeard = (mediaUrl: string): boolean =>
	readHeard().includes(mediaUrl);

export const markVoiceMessageHeard = (mediaUrl: string): void => {
	const heard = readHeard().filter((url) => url !== mediaUrl);
	try {
		window.localStorage.setItem(
			STORAGE_KEY,
			JSON.stringify([...heard, mediaUrl].slice(-MAX_REMEMBERED))
		);
	} catch {
		// Private window or full storage: the message just loads again next time.
	}
};
