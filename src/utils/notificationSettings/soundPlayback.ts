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

/** Minimal shape the announce selector needs from a feed item. */
export interface AnnounceableEvent {
	id: string;
	readAt?: string | null;
}

/**
 * Decide whether a feed refresh should announce (play a sound for) its newest
 * event, given the id last announced. Pure, so the *trigger* — not just the
 * playback — is testable.
 *
 * Keys on the newest event slot (feed[0]) by identity, NOT the first unread.
 * Keying on the first unread re-announces an older, already-present backlog
 * event the moment a newer one above it is read (#576): reading your inbox
 * top-down would ping a sound for every unread beneath. Tracking the top slot
 * means only a genuinely newer event announces, and read-state churn below it
 * stays silent.
 *
 * Returns the event to announce (the new top slot, if still unread) or null,
 * plus the marker to persist next.
 */
export const selectEventToAnnounce = <T extends AnnounceableEvent>(
	feed: ReadonlyArray<T>,
	lastAnnouncedId: string | null
): { announce: T | null; nextMarker: string } => {
	const newest = feed[0] ?? null;
	// First load only seeds the marker — never announce backlog on mount.
	if (lastAnnouncedId === null) {
		return { announce: null, nextMarker: newest ? newest.id : '' };
	}
	if (!newest || newest.id === lastAnnouncedId) {
		return { announce: null, nextMarker: lastAnnouncedId };
	}
	// A brand-new top event advances the marker; it only sounds if it is still
	// unread (a new-but-already-read top event, e.g. the user is in that
	// conversation, stays silent).
	return { announce: newest.readAt ? null : newest, nextMarker: newest.id };
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
