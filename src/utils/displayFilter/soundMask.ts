/**
 * Per-kind sound mute (#1377, Frank 2026-09-16: "Ton" column). The event's
 * session is looked up in the registry the lists publish; the effective
 * filter of that section decides whether the kind is muted. Unknown
 * sessions are never muted — the area sound settings stay in charge.
 */
import {
	isKindMuted,
	kindSoundOverride
} from '../../components/displayFilter/displayFilterTypes';
import type { SoundId } from '../notificationSettings/model';
import { OrisoDisplayFilters, resolveEffective } from './model';
import { sessionKindRegistry } from './sessionKindRegistry';

/** The tone the user chose for the event's session kind, if any. */
export const soundOverrideForEvent = (
	filters: OrisoDisplayFilters,
	sessionId: string | number | null | undefined
): SoundId | undefined => {
	const entry = sessionKindRegistry.lookup(sessionId);
	if (!entry) {
		return undefined;
	}
	const tone = kindSoundOverride(
		resolveEffective(filters, entry.section),
		entry.kind
	);
	return tone === 'none' ? undefined : tone;
};

export const isEventMutedByKind = (
	filters: OrisoDisplayFilters,
	sessionId: string | number | null | undefined
): boolean => {
	const entry = sessionKindRegistry.lookup(sessionId);
	if (!entry) {
		return false;
	}
	return isKindMuted(resolveEffective(filters, entry.section), entry.kind);
};
