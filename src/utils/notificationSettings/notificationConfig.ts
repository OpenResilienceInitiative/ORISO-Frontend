/**
 * Per-area notification configuration (Figma "Configure your notifications",
 * issue #576; harmonised model 2026-07-22). Three areas — Anfragen, Gespräche
 * and Zeitkritisch (time-critical: calls + appointments) — each with its own
 * set of notification kinds. Every kind carries three channels: banner
 * (browser popup), sound (+ volume) and email. This REPLACES the old flat
 * per-family toggle list (drafts never notify; system stays a single global
 * switch outside the tabs). Pure and serialisable — persisted in the same
 * cross-device settings store as the other preferences.
 */
import type { SoundId } from './model';

export const NOTIFICATION_AREAS = [
	'requests',
	'conversations',
	'timeCritical'
] as const;
export type NotificationArea = (typeof NOTIFICATION_AREAS)[number];

/** No area is disabled any more — Zeitkritisch is live (calls ring today). */
export const DISABLED_AREAS: ReadonlyArray<NotificationArea> = [];

export const NOTIFICATION_KINDS = [
	'new',
	'teamDiscussion',
	'standard',
	'liveChat',
	'mention',
	'handover',
	'call',
	'appointment'
] as const;
export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];

/** Which kinds (rows) each area tab shows — the harmonised layout. */
export const AREA_KINDS: Record<
	NotificationArea,
	ReadonlyArray<NotificationKind>
> = {
	// "Team-Besprechung" (team-only side discussion of an open enquiry) lives
	// with the enquiry, so its @-mentions are Anfrage mentions too.
	requests: ['new', 'teamDiscussion', 'standard', 'mention'],
	conversations: ['standard', 'liveChat', 'mention', 'handover'],
	timeCritical: ['call', 'appointment']
};

/**
 * Banner behaviour per kind. 'persistent' uses the Notification API's
 * `requireInteraction` (stays until dismissed) — honoured by Chromium;
 * Firefox/Safari fall back to a temporary banner (#576 Safari review).
 */
export type BannerMode = 'off' | 'temporary' | 'persistent';
export const BANNER_MODES: ReadonlyArray<BannerMode> = [
	'off',
	'temporary',
	'persistent'
];

export interface KindConfig {
	/** Browser popup / OS banner for this kind. */
	banner: BannerMode;
	sound: SoundId;
	email: boolean;
	/** Playback volume 0..1 for this kind (adjusted by the up/down arrows). */
	volume: number;
}

export const VOLUME_STEP = 0.25;
export const DEFAULT_VOLUME = 0.5;

/** Clamp a volume into [0, 1] and round to the arrow step. */
export const clampVolume = (v: number): number =>
	Math.max(0, Math.min(1, Math.round(v / VOLUME_STEP) * VOLUME_STEP));

export type NotificationConfig = Record<
	NotificationArea,
	Record<NotificationKind, KindConfig>
>;

const kind = (partial: Partial<KindConfig> = {}): KindConfig => ({
	banner: 'temporary',
	sound: 'none',
	email: true,
	volume: DEFAULT_VOLUME,
	...partial
});

const areaDefaults = (): Record<NotificationKind, KindConfig> => ({
	// Events that need attention get one short tone (ton-2, 0.3 s; selectable in the UI) out of the box (#1211);
	// 'standard' (ongoing chatter) stays silent. Stored user choices still win.
	new: kind({ sound: 'ton-2' }),
	// Counsellor-only row (the Anfragen tab); same short tone the old
	// Gespräche "Neue Anfrage" row had for team posts (#1857).
	teamDiscussion: kind({ sound: 'ton-2' }),
	standard: kind(),
	// A live-chat seeker is waiting right now, so this row rings out of the
	// box (FE#1470). Only a counsellor's live-chat messages land here.
	liveChat: kind({ sound: 'ton-1', email: false }),
	mention: kind({ sound: 'ton-2', email: false }),
	handover: kind({ sound: 'ton-2' }),
	// Calls keep ringing out of the box — the dedicated ring tone.
	call: kind({ sound: 'ring', email: false }),
	appointment: kind({ sound: 'ton-2' })
});

export const DEFAULT_NOTIFICATION_CONFIG: NotificationConfig = {
	requests: {
		...areaDefaults(),
		// A new enquiry waits for someone to take it, so its row rings out
		// of the box (FE#1435). Only the Anfragen tab's "Neue Anfrage" row.
		new: kind({ sound: 'ton-1' })
	},
	conversations: areaDefaults(),
	timeCritical: areaDefaults()
};

const isArea = (v: unknown): v is NotificationArea =>
	NOTIFICATION_AREAS.includes(v as NotificationArea);
const isKind = (v: unknown): v is NotificationKind =>
	NOTIFICATION_KINDS.includes(v as NotificationKind);

/** Tolerant parse: keep known area/kind values, fall back to defaults otherwise. */
export const parseNotificationConfig = (raw: unknown): NotificationConfig => {
	const source = (raw ?? {}) as Record<string, any>;
	const result = {} as NotificationConfig;
	for (const area of NOTIFICATION_AREAS) {
		const areaSrc = (source[area] ?? {}) as Record<string, any>;
		result[area] = {} as Record<NotificationKind, KindConfig>;
		for (const kindName of NOTIFICATION_KINDS) {
			// The team discussion used to share Gespräche → "Neue Anfrage":
			// carry a saved choice of that row over to the new row once. After
			// the first save the new row has its own stored value.
			const legacy =
				area === 'requests' && kindName === 'teamDiscussion'
					? source.conversations?.new
					: undefined;
			const kindSrc = (areaSrc[kindName] ?? legacy ?? {}) as Record<
				string,
				any
			>;
			const fallback = DEFAULT_NOTIFICATION_CONFIG[area][kindName];
			result[area][kindName] = {
				// legacy boolean (pre-3-state) parses tolerantly
				banner:
					typeof kindSrc.banner === 'boolean'
						? kindSrc.banner
							? 'temporary'
							: 'off'
						: BANNER_MODES.includes(kindSrc.banner)
							? (kindSrc.banner as BannerMode)
							: fallback.banner,
				sound:
					typeof kindSrc.sound === 'string'
						? (kindSrc.sound as SoundId)
						: fallback.sound,
				email:
					typeof kindSrc.email === 'boolean'
						? kindSrc.email
						: fallback.email,
				volume:
					typeof kindSrc.volume === 'number'
						? clampVolume(kindSrc.volume)
						: fallback.volume
			};
		}
	}
	return result;
};

/* ------------------------------------------------------------------ *
 * Event → (area, kind) mapping — how a backend event finds its row in
 * the config tabs. Kept here so playback, banner gate and UI share one
 * truth.
 * ------------------------------------------------------------------ */

/** Families that never notify on ANY channel (feed/timeline only). */
export const NEVER_NOTIFY_FAMILIES: ReadonlyArray<string> = ['drafts'];

export const areaForFamily = (family: string): NotificationArea => {
	if (family === 'requests') {
		return 'requests';
	}
	if (family === 'appointments' || family === 'calls') {
		return 'timeCritical';
	}
	// messages, handover, system → "Gespräch"
	return 'conversations';
};

/** Arrival events — something genuinely NEW begins (row "Neu"). */
const NEW_KIND_EVENTS: ReadonlyArray<string> = [
	'request.new',
	'waiting_room.client.joined'
];

/** A post in an enquiry's team discussion (Team-Besprechung). */
export const TEAM_DISCUSSION_EVENT = 'team.discussion.new';

export const kindForEvent = (
	family: string,
	eventType: string,
	isMention: boolean
): NotificationKind => {
	if (family === 'calls') {
		return 'call';
	}
	if (family === 'appointments') {
		return 'appointment';
	}
	if (family === 'handover') {
		return 'handover';
	}
	if (isMention) {
		return 'mention';
	}
	if (NEW_KIND_EVENTS.includes(eventType)) {
		return 'new';
	}
	return 'standard';
};

/** The settings row (tab + kind) one concrete event is governed by. */
export const areaKindForEvent = (
	family: string,
	eventType: string,
	isMention: boolean
): { area: NotificationArea; kind: NotificationKind } =>
	eventType === TEAM_DISCUSSION_EVENT
		? {
				area: 'requests',
				kind: isMention ? 'mention' : 'teamDiscussion'
			}
		: {
				area: areaForFamily(family),
				kind: kindForEvent(family, eventType, isMention)
			};

/** The configured banner/sound/email/volume entry for one concrete event. */
export const soundSettingForEvent = (
	config: NotificationConfig,
	family: string,
	eventType: string,
	isMention: boolean
): KindConfig => {
	const { area, kind } = areaKindForEvent(family, eventType, isMention);
	return config[area][kind];
};

/** Immutably set one field of one area+kind. */
export const setKindField = <K extends keyof KindConfig>(
	config: NotificationConfig,
	area: NotificationArea,
	kind: NotificationKind,
	field: K,
	value: KindConfig[K]
): NotificationConfig => {
	if (!isArea(area) || !isKind(kind)) {
		return config;
	}
	return {
		...config,
		[area]: {
			...config[area],
			[kind]: { ...config[area][kind], [field]: value }
		}
	};
};
