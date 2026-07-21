/**
 * Notification sound playback (issue #576). Decoupled from the OS popup: the
 * decision of WHICH sound to play for an event is pure and testable; the actual
 * Audio playback and rate-limit live behind it.
 */
import incomingNotification from '../../resources/audio/incomingNotification.mp3';
import incomingCall from '../../resources/audio/incomingCall.mp3';
import { EventFamily } from '../../components/notificationsCenter/eventDescriptors/types';
import {
	isNotificationSuppressed,
	LocalDeviceNotificationSettings,
	OrisoNotificationSettings,
	SoundId
} from './model';

/**
 * The SoundId to play for one event: the mention slot for @-mentions (with
 * 'default' inheriting the message slot), otherwise the message slot.
 */
export const resolveEventSound = (
	settings: OrisoNotificationSettings,
	isMention: boolean
): SoundId => {
	if (isMention) {
		const mention = settings.sounds.mention;
		return mention === 'default' ? settings.sounds.message : mention;
	}
	return settings.sounds.message;
};

/**
 * Maps a SoundId to an audio asset URL, or null for silence. Assets are
 * placeholders for now (only two exist) — swap the map when a curated library
 * lands; the choice model and UI already carry the distinct ids.
 */
export const soundAssetFor = (soundId: SoundId): string | null => {
	switch (soundId) {
		case 'chime':
		case 'ding':
		case 'soft':
			return incomingNotification;
		case 'none':
		case 'default':
		default:
			return null;
	}
};

/** The audio asset for a whole family (calls get their own sound, Slack-style). */
export const assetForEvent = (
	settings: OrisoNotificationSettings,
	family: EventFamily,
	isMention: boolean
): string | null => {
	if (family === 'calls') {
		return incomingCall;
	}
	return soundAssetFor(resolveEventSound(settings, isMention));
};

/**
 * A minimum-gap throttle so a burst of events plays at most one sound per
 * window. Pure and time-injectable.
 */
export const createSoundThrottle = (minGapMs: number) => {
	let last = -Infinity;
	return (now: number): boolean => {
		if (now - last >= minGapMs) {
			last = now;
			return true;
		}
		return false;
	};
};

const DEFAULT_VOLUME = 0.5;
const throttle = createSoundThrottle(2000);

/**
 * Play the configured notification sound for an event — independent of window
 * focus and browser-notification permission. Silenced by the same gate that
 * fronts every surface (DND, per-conversation level, mute, family-off), and
 * rate-limited so bursts don't rattle.
 */
export const playNotificationSound = (
	settings: OrisoNotificationSettings,
	device: LocalDeviceNotificationSettings,
	family: EventFamily,
	isMention: boolean,
	now: number = Date.now()
): void => {
	if (isNotificationSuppressed(settings, device, family)) {
		return;
	}
	const asset = assetForEvent(settings, family, isMention);
	if (!asset || !('Audio' in window)) {
		return;
	}
	if (!throttle(now)) {
		return;
	}
	const audio = new Audio(asset);
	audio.volume = DEFAULT_VOLUME;
	audio.play().catch(() => undefined);
};
