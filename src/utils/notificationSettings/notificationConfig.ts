/**
 * Per-area notification configuration (Figma "Configure your notifications",
 * issue #576). Three areas, each with three notification kinds; every kind
 * carries a chosen sound and a "send by email" flag. Pure and serialisable —
 * persisted in the same cross-device settings store as the other preferences.
 */
import { SoundId } from './model';

export const NOTIFICATION_AREAS = [
	'requests',
	'conversations',
	'appointments'
] as const;
export type NotificationArea = (typeof NOTIFICATION_AREAS)[number];

/** Appointments are designed but not wired to backend events yet — disabled. */
export const DISABLED_AREAS: ReadonlyArray<NotificationArea> = ['appointments'];

export const NOTIFICATION_KINDS = ['new', 'standard', 'mention'] as const;
export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];

export interface KindConfig {
	sound: SoundId;
	email: boolean;
}

export type NotificationConfig = Record<
	NotificationArea,
	Record<NotificationKind, KindConfig>
>;

const defaultKind = (email: boolean): KindConfig => ({ sound: 'none', email });

const defaultArea = (): Record<NotificationKind, KindConfig> => ({
	new: defaultKind(true),
	standard: defaultKind(true),
	mention: defaultKind(false)
});

export const DEFAULT_NOTIFICATION_CONFIG: NotificationConfig = {
	requests: defaultArea(),
	conversations: defaultArea(),
	appointments: defaultArea()
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
		for (const kind of NOTIFICATION_KINDS) {
			const kindSrc = (areaSrc[kind] ?? {}) as Record<string, any>;
			const fallback = DEFAULT_NOTIFICATION_CONFIG[area][kind];
			result[area][kind] = {
				sound:
					typeof kindSrc.sound === 'string'
						? (kindSrc.sound as SoundId)
						: fallback.sound,
				email:
					typeof kindSrc.email === 'boolean'
						? kindSrc.email
						: fallback.email
			};
		}
	}
	return result;
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
