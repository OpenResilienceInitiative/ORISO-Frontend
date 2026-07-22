/**
 * Notification sound playback (issue #576). Decoupled from the OS popup: the
 * decision of WHICH sound to play for an event is pure and testable; the actual
 * Audio playback and rate-limit live behind it.
 */
import incomingNotification from '../../resources/audio/incomingNotification.mp3';
import incomingCall from '../../resources/audio/incomingCall.mp3';
import ton1 from '../../resources/audio/notifications/ton-1.mp3';
import ton2 from '../../resources/audio/notifications/ton-2.mp3';
import ton3 from '../../resources/audio/notifications/ton-3.mp3';
import ton4 from '../../resources/audio/notifications/ton-4.mp3';
import ton5 from '../../resources/audio/notifications/ton-5.mp3';
import ton6 from '../../resources/audio/notifications/ton-6.mp3';
import ton7 from '../../resources/audio/notifications/ton-7.mp3';
import ton8 from '../../resources/audio/notifications/ton-8.mp3';
import ton9 from '../../resources/audio/notifications/ton-9.mp3';
import ton10 from '../../resources/audio/notifications/ton-10.mp3';
import ton11 from '../../resources/audio/notifications/ton-11.mp3';
import ton12 from '../../resources/audio/notifications/ton-12.mp3';
import { EventFamily } from '../../components/notificationsCenter/eventDescriptors/types';
import {
	isNotificationSuppressed,
	LocalDeviceNotificationSettings,
	OrisoNotificationSettings,
	SoundId
} from './model';
import { soundSettingForEvent } from './notificationConfig';

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
const TONE_ASSETS: Record<string, string> = {
	'ton-1': ton1,
	'ton-2': ton2,
	'ton-3': ton3,
	'ton-4': ton4,
	'ton-5': ton5,
	'ton-6': ton6,
	'ton-7': ton7,
	'ton-8': ton8,
	'ton-9': ton9,
	'ton-10': ton10,
	'ton-11': ton11,
	'ton-12': ton12
};

export const soundAssetFor = (soundId: SoundId): string | null => {
	if (soundId in TONE_ASSETS) {
		return TONE_ASSETS[soundId];
	}
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

/* ------------------------------------------------------------------ *
 * Safari audio unlock. Safari's autoplay policy rejects play() calls
 * that don't originate from a user gesture — but an element that WAS
 * played from a gesture may be replayed programmatically later. We
 * prime one shared element with a silent WAV on the first gesture and
 * reuse it for every event sound. Chromium/Firefox work either way.
 * ------------------------------------------------------------------ */

// 44-byte silent WAV (0 samples) — no network, no audible output.
const SILENT_WAV =
	'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=';

let sharedAudio: HTMLAudioElement | null = null;

/** Prime the shared element — call from within a user gesture. */
export const primeAudioPlayback = (): void => {
	if (!('Audio' in window) || sharedAudio) {
		return;
	}
	sharedAudio = new Audio(SILENT_WAV);
	sharedAudio.play().catch(() => undefined);
};

/**
 * One-time listeners that prime audio on the first pointer/keyboard
 * gesture. Returns a cleanup function. Install once at app level.
 */
export const installAudioUnlock = (
	target: EventTarget = window
): (() => void) => {
	const remove = () => {
		target.removeEventListener('pointerdown', unlock, true);
		target.removeEventListener('keydown', unlock, true);
	};
	const unlock = () => {
		primeAudioPlayback();
		remove();
	};
	target.addEventListener('pointerdown', unlock, true);
	target.addEventListener('keydown', unlock, true);
	return remove;
};

/**
 * Play the configured notification sound for an event — independent of window
 * focus and browser-notification permission. The sound and volume come from
 * the per-area config dialog (area×kind, issue #576); calls keep their
 * dedicated ring. Silenced by the same gate that fronts every surface (DND,
 * per-conversation level, mute, family-off), and rate-limited so bursts
 * don't rattle.
 */
export const playNotificationSound = (
	settings: OrisoNotificationSettings,
	device: LocalDeviceNotificationSettings,
	family: EventFamily,
	eventType: string,
	isMention: boolean,
	now: number = Date.now()
): void => {
	if (isNotificationSuppressed(settings, device, family)) {
		return;
	}
	let asset: string | null;
	let volume = DEFAULT_VOLUME;
	if (family === 'calls') {
		asset = incomingCall;
	} else {
		const kindConfig = soundSettingForEvent(
			settings.notificationConfig,
			family,
			eventType,
			isMention
		);
		asset = soundAssetFor(kindConfig.sound);
		volume = kindConfig.volume;
	}
	if (!asset || !('Audio' in window)) {
		return;
	}
	if (!throttle(now)) {
		return;
	}
	// Reuse the gesture-primed element when we have one (Safari), else a
	// fresh element (fine in Chromium/Firefox).
	const audio = sharedAudio ?? new Audio();
	audio.src = asset;
	audio.muted = false;
	audio.volume = Math.max(0, Math.min(1, volume));
	audio.play().catch(() => undefined);
};
